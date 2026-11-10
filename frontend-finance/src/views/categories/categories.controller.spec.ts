import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  refetch: vi.fn(),
  queryClient: {
    fetchQuery: vi.fn(),
    invalidateQueries: vi.fn(),
  },
  getCategoriesByType: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  isOnline: { value: true },
}))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => mocks.queryClient,
  keepPreviousData: vi.fn(),
}))
vi.mock('./categories.service', () => ({
  CATEGORIES_QUERY_KEY: ['categories'],
  categoriesQueryKey: (type?: string) =>
    type ? ['categories', 'type', type] : ['categories'],
  getCategoriesByType: mocks.getCategoriesByType,
  createCategory: mocks.createCategory,
  updateCategory: mocks.updateCategory,
  deleteCategory: mocks.deleteCategory,
}))
vi.mock('@/utils/network-status', () => ({
  useNetworkStatus: () => ({ isOnline: mocks.isOnline }),
}))
vi.mock('vue-sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    info: mocks.toastInfo,
  },
}))

import type { Category } from './categories.service'
import {
  CATEGORY_DELETE_ACK_ID,
  CATEGORY_NAME_ID,
  CATEGORY_SEARCH_ID,
  useCategoriesController,
} from './categories.controller'

function createCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Mercado',
    type: 'expense',
    transactionCount: 0,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

function createCategories(): Category[] {
  return [
    createCategory({ id: '1', name: 'Mercado', type: 'expense' }),
    createCategory({ id: '2', name: 'Saúde', type: 'expense' }),
    createCategory({ id: '3', name: 'Salário', type: 'income' }),
    createCategory({ id: '4', name: 'Lazer', type: 'expense' }),
    createCategory({ id: '5', name: 'Transporte', type: 'expense' }),
    createCategory({ id: '6', name: 'Moradia', type: 'expense' }),
    createCategory({ id: '7', name: 'Educação', type: 'expense' }),
    createCategory({ id: '8', name: 'Outras entradas', type: 'income' }),
    createCategory({ id: '9', name: 'Farmácia', type: 'expense' }),
    createCategory({ id: '10', name: 'Spotify', type: 'expense' }),
  ]
}

function createQuery<T>(initial: T | null) {
  return {
    data: ref<T | null>(initial),
    isPending: ref(false),
    isError: ref(false),
    isFetching: ref(false),
    refetch: mocks.refetch,
  }
}

function httpError(status: number) {
  return { isAxiosError: true, response: { status } }
}

function createController(categories: Category[] = createCategories()) {
  const query = createQuery<Category[]>(categories)
  mocks.useQuery.mockReset()
  mocks.useQuery.mockReturnValue(query)
  return { controller: useCategoriesController(), query }
}

describe('useCategoriesController', () => {
  beforeEach(() => {
    mocks.isOnline.value = true
    mocks.refetch.mockResolvedValue(undefined)
    mocks.queryClient.fetchQuery.mockResolvedValue([])
    mocks.queryClient.invalidateQueries.mockResolvedValue(undefined)
    mocks.createCategory.mockResolvedValue(createCategory())
    mocks.updateCategory.mockResolvedValue(createCategory())
    mocks.deleteCategory.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('começa na primeira página sem filtros', () => {
    const { controller } = createController()

    expect(controller.search.value).toBe('')
    expect(controller.typeFilter.value).toBe('all')
    expect(controller.page.value).toBe(1)
    expect(controller.total.value).toBe(10)
    expect(controller.totalPages.value).toBe(2)
  })

  it('filtra por nome sem diferenciar maiúsculas nem acentos', async () => {
    const { controller } = createController()

    controller.search.value = 'saude'
    await nextTick()
    expect(controller.categories.value.map((category) => category.name)).toEqual(['Saúde'])

    controller.search.value = 'MERCADO'
    await nextTick()
    expect(controller.categories.value.map((category) => category.name)).toEqual(['Mercado'])

    controller.search.value = 'nao-existe'
    await nextTick()
    expect(controller.categories.value).toHaveLength(0)
  })

  it('pagina em blocos de 8 e calcula o rótulo do intervalo', async () => {
    const { controller } = createController()

    expect(controller.categories.value).toHaveLength(8)
    expect(controller.rangeLabel.value).toBe('Mostrando 1–8 de 10 categorias')

    controller.page.value = 2
    expect(controller.categories.value.map((category) => category.name)).toEqual([
      'Farmácia',
      'Spotify',
    ])
    expect(controller.rangeLabel.value).toBe('Mostrando 9–10 de 10 categorias')

    controller.search.value = 'mercado'
    await nextTick()
    expect(controller.rangeLabel.value).toBe('Mostrando 1–1 de 1 categoria')
    expect(controller.page.value).toBe(1)
  })

  it('volta para a última página existente quando a lista diminui', async () => {
    const { controller, query } = createController()
    controller.page.value = 2

    query.data.value = [createCategory({ id: '1', name: 'Mercado' })]
    await nextTick()

    expect(controller.page.value).toBe(1)
  })

  it('só aceita filtros de tipo válidos e volta para a primeira página', () => {
    const { controller } = createController()
    controller.page.value = 2

    controller.setTypeFilter('income')
    expect(controller.typeFilter.value).toBe('income')
    expect(controller.page.value).toBe(1)

    controller.page.value = 2
    controller.setTypeFilter('invalid')
    expect(controller.typeFilter.value).toBe('income')
    expect(controller.page.value).toBe(2)

    controller.setTypeFilter('')
    expect(controller.typeFilter.value).toBe('income')

    controller.setTypeFilter('all')
    expect(controller.typeFilter.value).toBe('all')
  })

  it('limpa os filtros e devolve o foco à busca', async () => {
    document.body.innerHTML = `<input id="${CATEGORY_SEARCH_ID}" />`
    const { controller } = createController()
    controller.search.value = 'mercado'
    controller.typeFilter.value = 'expense'
    controller.page.value = 2

    controller.clearFilters()
    await nextTick()

    expect(controller.search.value).toBe('')
    expect(controller.typeFilter.value).toBe('all')
    expect(controller.page.value).toBe(1)
    expect(document.activeElement?.id).toBe(CATEGORY_SEARCH_ID)
  })

  it('recarrega a lista ao tentar novamente', () => {
    const { controller } = createController()

    controller.retry()

    expect(mocks.refetch).toHaveBeenCalledOnce()
  })

  it('calcula o estado da tela', () => {
    const { controller, query } = createController()

    query.isPending.value = true
    expect(controller.viewState.value).toBe('loading')

    query.isPending.value = false
    query.isError.value = true
    expect(controller.viewState.value).toBe('error')

    query.isError.value = false
    query.data.value = []
    expect(controller.viewState.value).toBe('empty')

    controller.search.value = 'nada'
    expect(controller.viewState.value).toBe('no-results')

    controller.clearFilters()
    query.data.value = createCategories()
    expect(controller.viewState.value).toBe('ready')
  })

  it('descreve o estado para leitores de tela', () => {
    const { controller, query } = createController()

    query.isPending.value = true
    expect(controller.statusMessage.value).toBe('Carregando categorias…')

    query.isPending.value = false
    query.isError.value = true
    expect(controller.statusMessage.value).toBe('Não foi possível carregar as categorias.')

    query.isError.value = false
    query.isFetching.value = true
    expect(controller.statusMessage.value).toBe('Atualizando categorias…')

    query.isFetching.value = false
    controller.search.value = 'nada'
    expect(controller.statusMessage.value).toBe(
      'Nenhuma categoria encontrada com esses filtros.',
    )

    controller.clearFilters()
    expect(controller.statusMessage.value).toBe('10 categorias encontradas.')
  })

  it('não abre o formulário de criação offline', () => {
    mocks.isOnline.value = false
    const { controller } = createController()

    controller.openCreateCategory()

    expect(controller.isFormOpen.value).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Você está offline. Conecte-se para salvar alterações.',
    )
  })

  it('abre a criação com o tipo do filtro atual', () => {
    const { controller } = createController()
    controller.setTypeFilter('income')

    controller.openCreateCategory()

    expect(controller.isFormOpen.value).toBe(true)
    expect(controller.isEditing.value).toBe(false)
    expect(controller.form).toEqual({ name: '', type: 'income' })
  })

  it('abre a edição preenchendo os dados da categoria', () => {
    const { controller } = createController()
    const category = createCategory({ name: 'Lazer', type: 'expense' })

    controller.openEditCategory(category)

    expect(controller.isFormOpen.value).toBe(true)
    expect(controller.isEditing.value).toBe(true)
    expect(controller.form).toEqual({ name: 'Lazer', type: 'expense' })
  })

  it('valida o nome no blur e ao digitar depois de visitado', async () => {
    const { controller } = createController()
    controller.openCreateCategory()

    controller.handleNameBlur()
    expect(controller.errors.name).toBe('Informe o nome da categoria.')

    controller.form.name = 'Educação'
    await nextTick()
    expect(controller.errors.name).toBeUndefined()
  })

  it('não permite trocar o tipo ao editar', async () => {
    const { controller } = createController()
    controller.openEditCategory(createCategory({ type: 'expense' }))

    controller.setFormType('income')

    expect(controller.form.type).toBe('expense')
  })

  it('troca o tipo ao criar e revalida o nome visitado', async () => {
    const { controller } = createController()
    controller.openCreateCategory()
    controller.form.name = 'Salário'
    controller.handleNameBlur()

    controller.setFormType('income')
    await nextTick()

    expect(controller.form.type).toBe('income')
    expect(controller.errors.name).toBeUndefined()

    controller.setFormType('other')
    expect(controller.form.type).toBe('income')
  })

  it('não envia offline', async () => {
    mocks.isOnline.value = false
    const { controller } = createController()
    controller.openCreateCategory()
    controller.form.name = 'Nova'

    await controller.submitCategory()

    expect(mocks.createCategory).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalled()
  })

  it('foca o campo de nome quando ele é inválido', async () => {
    document.body.innerHTML = `<input id="${CATEGORY_NAME_ID}" />`
    const { controller } = createController()
    controller.openCreateCategory()

    await controller.submitCategory()

    expect(controller.errors.name).toBe('Informe o nome da categoria.')
    expect(document.activeElement?.id).toBe(CATEGORY_NAME_ID)
    expect(mocks.createCategory).not.toHaveBeenCalled()
  })

  it('fecha a edição quando o nome não mudou', async () => {
    const { controller } = createController()
    const category = createCategory({ name: 'Lazer' })
    controller.openEditCategory(category)

    await controller.submitCategory()

    expect(controller.isFormOpen.value).toBe(false)
    expect(mocks.updateCategory).not.toHaveBeenCalled()
  })

  it('cria uma categoria e atualiza as listas', async () => {
    const { controller } = createController()
    controller.openCreateCategory()
    controller.form.name = '  Educação  '
    controller.form.type = 'expense'

    await controller.submitCategory()

    expect(mocks.createCategory).toHaveBeenCalledWith('Educação', 'expense')
    expect(controller.isFormOpen.value).toBe(false)
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Categoria criada', {
      description: '“Educação” foi adicionada.',
    })
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['categories'],
    })
  })

  it('atualiza o nome de uma categoria existente', async () => {
    const { controller } = createController()
    const category = createCategory({ id: 'cat-1', name: 'Mercado' })
    controller.openEditCategory(category)
    controller.form.name = 'Supermercado'

    await controller.submitCategory()

    expect(mocks.updateCategory).toHaveBeenCalledWith('cat-1', 'Supermercado')
    expect(controller.isFormOpen.value).toBe(false)
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Categoria atualizada', {
      description: '“Supermercado” foi salva.',
    })
  })

  it('bloqueia nomes duplicados do mesmo tipo, sem diferenciar maiúsculas', async () => {
    document.body.innerHTML = `<input id="${CATEGORY_NAME_ID}" />`
    mocks.queryClient.fetchQuery.mockResolvedValue([
      createCategory({ id: 'outra', name: 'mercado' }),
    ])
    const { controller } = createController()
    controller.openCreateCategory()
    controller.form.name = 'Mercado'

    await controller.submitCategory()

    expect(controller.errors.name).toBe(
      'Já existe uma categoria de despesa com esse nome.',
    )
    expect(mocks.createCategory).not.toHaveBeenCalled()
    expect(document.activeElement?.id).toBe(CATEGORY_NAME_ID)
  })

  it('ignora a própria categoria ao verificar duplicidade na edição', async () => {
    mocks.queryClient.fetchQuery.mockResolvedValue([
      createCategory({ id: 'cat-1', name: 'Mercado' }),
    ])
    const { controller } = createController()
    controller.openEditCategory(createCategory({ id: 'cat-1', name: 'Mercado' }))
    controller.form.name = 'Mercado Novo'

    await controller.submitCategory()

    expect(mocks.updateCategory).toHaveBeenCalledWith('cat-1', 'Mercado Novo')
    expect(controller.errors.name).toBeUndefined()
  })

  it('trata os erros da API ao salvar', async () => {
    const { controller } = createController()
    controller.openCreateCategory()
    controller.form.name = 'Nova'

    mocks.createCategory.mockRejectedValueOnce(httpError(409))
    await controller.submitCategory()
    expect(controller.errors.name).toBe(
      'Já existe uma categoria de despesa com esse nome.',
    )

    controller.form.name = 'Outra'
    mocks.createCategory.mockRejectedValueOnce(httpError(404))
    await controller.submitCategory()
    expect(controller.submitError.value).toBe(
      'Essa categoria não existe mais. Feche o formulário para atualizar a lista.',
    )

    controller.form.name = 'Mais uma'
    mocks.createCategory.mockRejectedValueOnce(httpError(400))
    await controller.submitCategory()
    expect(controller.submitError.value).toBe(
      'Confira o nome: ele precisa ter de 1 a 40 caracteres.',
    )

    controller.form.name = 'Última'
    mocks.createCategory.mockRejectedValueOnce(new Error('falha'))
    await controller.submitCategory()
    expect(controller.submitError.value).toBe(
      'Não foi possível salvar a categoria. Verifique sua conexão e tente novamente.',
    )
    expect(controller.isSubmitting.value).toBe(false)
  })

  it('pede confirmação antes de excluir', () => {
    const { controller } = createController()
    const category = createCategory({ name: 'Lazer' })

    controller.requestDeleteCategory(category)

    expect(controller.categoryPendingDelete.value).toEqual(category)
    expect(controller.isDeleteDialogOpen.value).toBe(true)
    expect(controller.isDeleteBlocked.value).toBe(false)
    expect(controller.deleteError.value).toBe('')
  })

  it('monta a mensagem de bloqueio da exclusão', () => {
    const { controller } = createController()
    controller.requestDeleteCategory(createCategory({ name: 'Mercado' }))

    expect(controller.blockedDeleteMessage.value).toBe(
      '“Mercado” tem transações vinculadas. Mova ou exclua essas transações antes de excluir a categoria.',
    )
  })

  it('exclui a categoria e atualiza a lista', async () => {
    const { controller } = createController()
    controller.requestDeleteCategory(createCategory({ id: 'cat-1', name: 'Lazer' }))

    await controller.confirmDeleteCategory()

    expect(mocks.deleteCategory).toHaveBeenCalledWith('cat-1')
    expect(controller.isDeleteDialogOpen.value).toBe(false)
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Categoria excluída', {
      description: '“Lazer” foi removida.',
    })
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['categories'],
    })
  })

  it('bloqueia a exclusão quando a categoria tem transações (409)', async () => {
    document.body.innerHTML = `<button id="${CATEGORY_DELETE_ACK_ID}"></button>`
    mocks.deleteCategory.mockRejectedValue(httpError(409))
    const { controller } = createController()
    controller.requestDeleteCategory(createCategory({ name: 'Mercado' }))

    await controller.confirmDeleteCategory()

    expect(controller.isDeleteBlocked.value).toBe(true)
    expect(controller.isDeleteDialogOpen.value).toBe(true)
    expect(document.activeElement?.id).toBe(CATEGORY_DELETE_ACK_ID)

    await controller.confirmDeleteCategory()
    expect(mocks.deleteCategory).toHaveBeenCalledOnce()
  })

  it('informa quando a categoria já foi excluída (404)', async () => {
    mocks.deleteCategory.mockRejectedValue(httpError(404))
    const { controller } = createController()
    controller.requestDeleteCategory(createCategory({ name: 'Lazer' }))

    await controller.confirmDeleteCategory()

    expect(controller.isDeleteDialogOpen.value).toBe(false)
    expect(mocks.toastInfo).toHaveBeenCalledWith('Essa categoria já tinha sido excluída.')
  })

  it('mantém o diálogo aberto e mostra erro quando a exclusão falha', async () => {
    mocks.deleteCategory.mockRejectedValue(new Error('falha'))
    const { controller } = createController()
    controller.requestDeleteCategory(createCategory())

    await controller.confirmDeleteCategory()

    expect(controller.isDeleteDialogOpen.value).toBe(true)
    expect(controller.deleteError.value).toBe(
      'Não foi possível excluir. Verifique sua conexão e tente novamente.',
    )
    expect(controller.isDeleting.value).toBe(false)
  })

  it('não exclui offline nem sem categoria pendente', async () => {
    mocks.isOnline.value = false
    const { controller } = createController()
    controller.categoryPendingDelete.value = createCategory()

    await controller.confirmDeleteCategory()
    expect(mocks.deleteCategory).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalled()

    mocks.isOnline.value = true
    controller.categoryPendingDelete.value = null
    await controller.confirmDeleteCategory()
    expect(mocks.deleteCategory).not.toHaveBeenCalled()
  })

  it('devolve o foco à busca somente quando a exclusão aconteceu', async () => {
    document.body.innerHTML = `<input id="${CATEGORY_SEARCH_ID}" />`
    const { controller } = createController()
    const event = { preventDefault: vi.fn() }

    controller.handleDeleteDialogCloseAutoFocus(event as unknown as Event)
    expect(event.preventDefault).not.toHaveBeenCalled()

    controller.requestDeleteCategory(createCategory({ id: 'cat-1' }))
    await controller.confirmDeleteCategory()

    controller.handleDeleteDialogCloseAutoFocus(event as unknown as Event)
    await nextTick()

    expect(event.preventDefault).toHaveBeenCalled()
    expect(document.activeElement?.id).toBe(CATEGORY_SEARCH_ID)
  })
})
