import { computed, reactive, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { useNetworkStatus } from '@/utils/network-status'
import {
  CATEGORIES_QUERY_KEY,
  createCategory,
  deleteCategory as deleteCategoryRequest,
  getCategories,
  type Category,
  type CategoryType,
  updateCategory,
} from './categories.service'

interface CategoryForm {
  name: string
  type: CategoryType
}

function formatCount(count: number): string {
  return `${count} ${count === 1 ? 'categoria' : 'categorias'}`
}

export function useCategoriesController() {
  const { isOnline } = useNetworkStatus()
  const queryClient = useQueryClient()
  const categoriesQuery = useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
  const categories = computed(() => categoriesQuery.data.value ?? [])

  const expenseCategories = computed(() =>
    categories.value.filter((category) => category.type === 'expense'),
  )
  const incomeCategories = computed(() =>
    categories.value.filter((category) => category.type === 'income'),
  )

  const categoryGroups = computed(() => [
    {
      type: 'expense' as const,
      title: 'Despesas',
      countLabel: formatCount(expenseCategories.value.length),
      categories: expenseCategories.value,
    },
    {
      type: 'income' as const,
      title: 'Entradas',
      countLabel: formatCount(incomeCategories.value.length),
      categories: incomeCategories.value,
    },
  ])

  const isDialogOpen = ref(false)
  const editingCategory = ref<Category | null>(null)
  const categoryForm = reactive<CategoryForm>({
    name: '',
    type: 'expense',
  })
  const formError = ref('')

  const isEditing = computed(() => editingCategory.value !== null)
  const typeLabel = computed(() =>
    categoryForm.type === 'income' ? 'Entrada' : 'Despesa',
  )

  function openCreateCategory(): void {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.')
      return
    }
    editingCategory.value = null
    categoryForm.name = ''
    categoryForm.type = 'expense'
    formError.value = ''
    isDialogOpen.value = true
  }

  function openEditCategory(category: Category): void {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.')
      return
    }
    editingCategory.value = category
    categoryForm.name = category.name
    categoryForm.type = category.type
    formError.value = ''
    isDialogOpen.value = true
  }

  function setCategoryType(value: unknown): void {
    categoryForm.type = value === 'income' ? 'income' : 'expense'
  }

  async function submitCategory(): Promise<void> {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.')
      return
    }
    const name = categoryForm.name.trim()

    if (!name) {
      formError.value = 'Informe o nome da categoria.'
      return
    }

    const duplicated = categories.value.some(
      (category) =>
        category.id !== editingCategory.value?.id &&
        category.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'),
    )

    if (duplicated) {
      formError.value = 'Já existe uma categoria com esse nome.'
      return
    }

    if (editingCategory.value) {
      const editedId = editingCategory.value.id

      try {
        const updatedCategory = await updateCategory(
          editedId,
          name,
          categoryForm.type,
        )
        const updatedCategories = categories.value.map((category) =>
          category.id === editedId ? updatedCategory : category,
        )
        queryClient.setQueryData(CATEGORIES_QUERY_KEY, updatedCategories)

        toast.success('Categoria atualizada', {
          description: `“${name}” foi atualizada.`,
        })
      } catch {
        formError.value = 'Não foi possível atualizar a categoria. Tente novamente.'
        return
      }
    } else {
      try {
        const newCategory = await createCategory(name, categoryForm.type)
        queryClient.setQueryData(CATEGORIES_QUERY_KEY, [
          ...categories.value,
          newCategory,
        ])

        toast.success('Categoria criada', {
          description: `“${name}” foi adicionada.`,
        })
      } catch {
        formError.value = 'Não foi possível criar a categoria. Tente novamente.'
        return
      }
    }

    isDialogOpen.value = false
  }

  async function deleteCategory(category: Category): Promise<void> {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.')
      return
    }
    if (category.transactionCount > 0) {
      toast.error('Não foi possível excluir', {
        description: `Há transações vinculadas a “${category.name}”.`,
      })
      return
    }

    try {
      await deleteCategoryRequest(category.id)
      const remainingCategories = categories.value.filter(
        (currentCategory) => currentCategory.id !== category.id,
      )
      queryClient.setQueryData(CATEGORIES_QUERY_KEY, remainingCategories)

      toast.success('Categoria excluída', {
        description: `“${category.name}” foi removida.`,
      })
    } catch {
      toast.error('Não foi possível excluir', {
        description: 'Tente novamente em instantes.',
      })
    }
  }

  return {
    isOnline,
    categoryGroups,
    isDialogOpen,
    isEditing,
    categoryForm,
    formError,
    typeLabel,
    openCreateCategory,
    openEditCategory,
    setCategoryType,
    submitCategory,
    deleteCategory,
  }
}
