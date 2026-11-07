import { computed, nextTick, reactive, ref, watch } from 'vue'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import { isAxiosError } from 'axios'
import { toast } from 'vue-sonner'
import { useNetworkStatus } from '@/utils/network-status'
import {
  categoriesQueryKey,
  CATEGORIES_QUERY_KEY,
  createCategory,
  deleteCategory as deleteCategoryRequest,
  getCategoriesByType,
  type Category,
  type CategoryType,
  updateCategory,
} from './categories.service'
import {
  CATEGORY_NAME_MAX_LENGTH,
  duplicatedNameMessage,
  validateCategoryName,
  type CategoryFormErrors,
  type CategoryFormValues,
} from './categories.validation'

export type CategoryTypeFilter = 'all' | CategoryType
export type CategoriesViewState = 'loading' | 'error' | 'empty' | 'no-results' | 'ready'

export const CATEGORIES_PAGE_SIZE = 8
export const CATEGORY_SEARCH_ID = 'category-search'
export const CATEGORY_NAME_ID = 'category-name'
export const CATEGORY_DELETE_ACK_ID = 'category-delete-ack'

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

// Busca sem diferenciar maiúsculas nem acentos: "saude" encontra "Saúde".
function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim()
}

function errorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

async function focusElement(id: string): Promise<void> {
  await nextTick()
  document.getElementById(id)?.focus()
}

export function useCategoriesController() {
  const { isOnline } = useNetworkStatus()
  const queryClient = useQueryClient()

  function canMutate(): boolean {
    if (isOnline.value) return true
    toast.error('Você está offline. Conecte-se para salvar alterações.')
    return false
  }

  // ── Filtros e paginação ─────────────────────────────────────────────────
  // O tipo é filtrado no servidor (GET /categories?type=). A API atual não
  // aceita busca nem paginação, então essas duas são feitas aqui.
  const search = ref('')
  const typeFilter = ref<CategoryTypeFilter>('all')
  const page = ref(1)

  const selectedType = computed(() =>
    typeFilter.value === 'all' ? undefined : typeFilter.value,
  )

  const categoriesQuery = useQuery({
    queryKey: computed(() => categoriesQueryKey(selectedType.value)),
    queryFn: () => getCategoriesByType(selectedType.value),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // Mantém a lista anterior na tela enquanto a do novo tipo carrega.
    placeholderData: keepPreviousData,
  })

  const filteredCategories = computed(() => {
    const term = normalizeText(search.value)
    const list = categoriesQuery.data.value ?? []
    return term ? list.filter((category) => normalizeText(category.name).includes(term)) : list
  })
  const total = computed(() => filteredCategories.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / CATEGORIES_PAGE_SIZE)))
  const categories = computed(() => {
    const start = (page.value - 1) * CATEGORIES_PAGE_SIZE
    return filteredCategories.value.slice(start, start + CATEGORIES_PAGE_SIZE)
  })
  const hasFilters = computed(() => search.value.trim() !== '' || typeFilter.value !== 'all')

  const viewState = computed<CategoriesViewState>(() => {
    if (categoriesQuery.isPending.value) return 'loading'
    if (categoriesQuery.isError.value) return 'error'
    if (categories.value.length === 0) return hasFilters.value ? 'no-results' : 'empty'
    return 'ready'
  })
  const isRefreshing = computed(
    () => categoriesQuery.isFetching.value && !categoriesQuery.isPending.value,
  )

  watch(search, () => {
    page.value = 1
  })

  // Depois de excluir o último item de uma página, volta para a última existente.
  watch(totalPages, (lastPage) => {
    if (page.value > lastPage) page.value = lastPage
  })

  const rangeLabel = computed(() => {
    if (total.value === 0) return 'Nenhuma categoria'
    const first = (page.value - 1) * CATEGORIES_PAGE_SIZE + 1
    const last = first + categories.value.length - 1
    return `Mostrando ${first}–${last} de ${pluralize(total.value, 'categoria', 'categorias')}`
  })

  // Anunciado por leitores de tela (aria-live) quando a lista muda.
  const statusMessage = computed(() => {
    if (viewState.value === 'loading') return 'Carregando categorias…'
    if (viewState.value === 'error') return 'Não foi possível carregar as categorias.'
    if (isRefreshing.value) return 'Atualizando categorias…'
    if (viewState.value === 'no-results') return 'Nenhuma categoria encontrada com esses filtros.'
    return `${pluralize(total.value, 'categoria encontrada', 'categorias encontradas')}.`
  })

  function setTypeFilter(value: unknown): void {
    // O ToggleGroup emite '' quando o item ativo é clicado de novo: ignoramos.
    if (value !== 'all' && value !== 'income' && value !== 'expense') return
    typeFilter.value = value
    page.value = 1
  }

  function clearFilters(): void {
    search.value = ''
    typeFilter.value = 'all'
    page.value = 1
    void focusElement(CATEGORY_SEARCH_ID)
  }

  function retry(): void {
    void categoriesQuery.refetch()
  }

  function refreshCategories(): Promise<void> {
    // Prefixo comum: atualiza as listas por tipo e a dos formulários de transação.
    return queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY })
  }

  // A API diferencia maiúsculas ("Mercado" ≠ "mercado"); a tela não deixa criar
  // as duas. Usa a lista do tipo escolhido (do cache, ou buscada na hora).
  async function isDuplicatedName(name: string, type: CategoryType, ignoreId?: string) {
    const sameType = await queryClient.fetchQuery({
      queryKey: categoriesQueryKey(type),
      queryFn: () => getCategoriesByType(type),
      staleTime: 30 * 1000,
    })
    const wanted = name.toLocaleLowerCase('pt-BR')
    return sameType.some(
      (category) => category.id !== ignoreId && category.name.toLocaleLowerCase('pt-BR') === wanted,
    )
  }

  // ── Formulário de criar/editar ──────────────────────────────────────────
  const isFormOpen = ref(false)
  const editingCategory = ref<Category | null>(null)
  const form = reactive<CategoryFormValues>({ name: '', type: 'expense' })
  const errors = reactive<CategoryFormErrors>({})
  const isNameTouched = ref(false)
  const submitError = ref('')
  const isSubmitting = ref(false)

  const isEditing = computed(() => editingCategory.value !== null)
  const nameLength = computed(() => form.name.trim().length)

  function validateName(): void {
    const message = validateCategoryName(form.name)
    if (message) errors.name = message
    else delete errors.name
  }

  watch(
    () => form.name,
    () => {
      submitError.value = ''
      if (isNameTouched.value) validateName()
    },
  )

  function resetForm(category: Category | null): void {
    editingCategory.value = category
    form.name = category?.name ?? ''
    form.type =
      category?.type ?? (typeFilter.value === 'all' ? 'expense' : typeFilter.value)
    delete errors.name
    isNameTouched.value = false
    submitError.value = ''
  }

  function openCreateCategory(): void {
    if (!canMutate()) return
    resetForm(null)
    isFormOpen.value = true
  }

  function openEditCategory(category: Category): void {
    if (!canMutate()) return
    resetForm(category)
    isFormOpen.value = true
  }

  function handleNameBlur(): void {
    isNameTouched.value = true
    validateName()
  }

  function setFormType(value: unknown): void {
    if (isEditing.value) return
    if (value !== 'income' && value !== 'expense') return
    form.type = value
    // Um nome duplicado numa despesa pode estar livre em entradas.
    if (isNameTouched.value) validateName()
    submitError.value = ''
  }

  async function submitCategory(): Promise<void> {
    if (!canMutate()) return
    if (isSubmitting.value) return

    isNameTouched.value = true
    validateName()
    submitError.value = ''
    if (errors.name) {
      await focusElement(CATEGORY_NAME_ID)
      return
    }

    const name = form.name.trim()
    const editing = editingCategory.value

    if (editing && editing.name === name) {
      isFormOpen.value = false
      return
    }

    isSubmitting.value = true
    try {
      const type = editing?.type ?? form.type
      const isDuplicated = await isDuplicatedName(name, type, editing?.id)
      if (!canMutate()) return
      if (isDuplicated) {
        errors.name = duplicatedNameMessage(type)
        await focusElement(CATEGORY_NAME_ID)
        return
      }

      if (editing) {
        await updateCategory(editing.id, name)
        toast.success('Categoria atualizada', { description: `“${name}” foi salva.` })
      } else {
        await createCategory(name, form.type)
        toast.success('Categoria criada', { description: `“${name}” foi adicionada.` })
      }
      isFormOpen.value = false
      await refreshCategories()
    } catch (error) {
      const status = errorStatus(error)
      if (status === 409) {
        errors.name = duplicatedNameMessage(form.type)
        await focusElement(CATEGORY_NAME_ID)
      } else if (status === 404) {
        submitError.value = 'Essa categoria não existe mais. Feche o formulário para atualizar a lista.'
        void refreshCategories()
      } else if (status === 400) {
        submitError.value = `Confira o nome: ele precisa ter de 1 a ${CATEGORY_NAME_MAX_LENGTH} caracteres.`
      } else {
        submitError.value =
          'Não foi possível salvar a categoria. Verifique sua conexão e tente novamente.'
      }
    } finally {
      isSubmitting.value = false
    }
  }

  // ── Exclusão com confirmação ────────────────────────────────────────────
  const isDeleteDialogOpen = ref(false)
  const categoryPendingDelete = ref<Category | null>(null)
  const isDeleteBlocked = ref(false)
  const isDeleting = ref(false)
  const deleteError = ref('')
  let deletedSuccessfully = false

  // A API não informa quantas transações a categoria tem: o bloqueio só é
  // conhecido quando ela recusa a exclusão com 409.
  const blockedDeleteMessage = computed(() => {
    const category = categoryPendingDelete.value
    if (!category) return ''
    return `“${category.name}” tem transações vinculadas. Mova ou exclua essas transações antes de excluir a categoria.`
  })

  function requestDeleteCategory(category: Category): void {
    if (!canMutate()) return
    categoryPendingDelete.value = category
    isDeleteBlocked.value = false
    deleteError.value = ''
    deletedSuccessfully = false
    isDeleteDialogOpen.value = true
  }

  async function confirmDeleteCategory(): Promise<void> {
    if (!canMutate()) return
    const category = categoryPendingDelete.value
    if (!category || isDeleting.value || isDeleteBlocked.value) return

    isDeleting.value = true
    deleteError.value = ''
    try {
      await deleteCategoryRequest(category.id)
      deletedSuccessfully = true
      isDeleteDialogOpen.value = false
      toast.success('Categoria excluída', { description: `“${category.name}” foi removida.` })
      await refreshCategories()
    } catch (error) {
      const status = errorStatus(error)
      if (status === 409) {
        isDeleteBlocked.value = true
        // O botão Excluir sai do diálogo; o foco vai para "Entendi".
        await focusElement(CATEGORY_DELETE_ACK_ID)
      } else if (status === 404) {
        deletedSuccessfully = true
        isDeleteDialogOpen.value = false
        toast.info('Essa categoria já tinha sido excluída.')
        void refreshCategories()
      } else {
        deleteError.value = 'Não foi possível excluir. Verifique sua conexão e tente novamente.'
      }
    } finally {
      isDeleting.value = false
    }
  }

  // O botão que abriu o diálogo some junto com a categoria excluída; o foco
  // vai para a busca em vez de se perder no <body>.
  function handleDeleteDialogCloseAutoFocus(event: Event): void {
    if (!deletedSuccessfully) return
    event.preventDefault()
    void focusElement(CATEGORY_SEARCH_ID)
  }

  return {
    isOnline,
    // lista
    search,
    typeFilter,
    page,
    categories,
    total,
    totalPages,
    viewState,
    isRefreshing,
    rangeLabel,
    statusMessage,
    setTypeFilter,
    clearFilters,
    retry,
    // formulário
    isFormOpen,
    isEditing,
    form,
    errors,
    nameLength,
    submitError,
    isSubmitting,
    openCreateCategory,
    openEditCategory,
    handleNameBlur,
    setFormType,
    submitCategory,
    // exclusão
    isDeleteDialogOpen,
    categoryPendingDelete,
    isDeleteBlocked,
    blockedDeleteMessage,
    isDeleting,
    deleteError,
    requestDeleteCategory,
    confirmDeleteCategory,
    handleDeleteDialogCloseAutoFocus,
  }
}
