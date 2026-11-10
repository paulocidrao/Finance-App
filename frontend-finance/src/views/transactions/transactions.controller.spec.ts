import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  refetch: vi.fn(),
  queryClient: {
    invalidateQueries: vi.fn(),
    getQueryData: vi.fn(),
  },
  getTransactions: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getCategories: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  isOnline: { value: true },
}))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => mocks.queryClient,
}))
vi.mock('@/views/categories/categories.service', () => ({
  CATEGORIES_QUERY_KEY: ['categories'],
}))
vi.mock('./transactions.service', () => ({
  getTransactions: mocks.getTransactions,
  createTransaction: mocks.createTransaction,
  updateTransaction: mocks.updateTransaction,
  deleteTransaction: mocks.deleteTransaction,
  transactionsService: {
    getCategories: mocks.getCategories,
  },
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

import type { NewTransactionInput, Transaction } from './transactions.service'
import { TRANSACTIONS_SEARCH_ID, useTransactionsController } from './transactions.controller'

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    date: '2026-11-09',
    createdAt: '2026-11-09T12:00:00Z',
    description: 'Mercado do mês',
    category: 'Alimentação',
    categoryId: 'cat-food',
    type: 'expense',
    amount: 486.3,
    ...overrides,
  }
}

function createTransactions(): Transaction[] {
  return [
    createTransaction({ id: 1, description: 'Salário', category: 'Salário', type: 'income', amount: 7500 }),
    createTransaction({ id: 2, description: 'Mercado do mês' }),
    createTransaction({ id: 3, description: 'Uber', category: 'Transporte', amount: 32.9 }),
    createTransaction({ id: 4, description: 'Freelance site', category: 'Outras entradas', type: 'income', amount: 950 }),
    createTransaction({ id: 5, description: 'Aluguel', category: 'Moradia', amount: 1850 }),
    createTransaction({ id: 6, description: 'Cinema', category: 'Lazer', amount: 58 }),
    createTransaction({ id: 7, description: 'Spotify', category: 'Lazer', amount: 21.9 }),
    createTransaction({ id: 8, description: 'Farmácia', category: 'Saúde', amount: 74.2 }),
    createTransaction({ id: 9, description: 'Café', category: 'Alimentação', amount: 12 }),
    createTransaction({ id: 10, description: 'Combustível', category: 'Transporte', amount: 210 }),
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

const networkError = { isAxiosError: true }

function createController(data: Transaction[] = createTransactions()) {
  const query = createQuery<Transaction[]>(data)
  mocks.useQuery.mockReset()
  mocks.useQuery.mockReturnValue(query)
  return { controller: useTransactionsController(), query }
}

const payload: NewTransactionInput = {
  type: 'expense',
  amount: 42.5,
  description: 'Café',
  category: 'cat-food',
  date: '2026-11-09',
}

describe('useTransactionsController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T12:00:00'))

    mocks.isOnline.value = true
    mocks.refetch.mockResolvedValue(undefined)
    mocks.queryClient.invalidateQueries.mockResolvedValue(undefined)
    mocks.queryClient.getQueryData.mockReturnValue([
      { id: 'cat-food', name: 'Alimentação' },
      { id: 'cat-fun', name: 'Lazer' },
    ])
    mocks.createTransaction.mockResolvedValue(createTransaction())
    mocks.updateTransaction.mockResolvedValue(createTransaction({ description: 'Café' }))
    mocks.deleteTransaction.mockResolvedValue(undefined)
    mocks.getCategories.mockReturnValue(['Salário', 'Alimentação', 'Transporte'])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('começa no mês atual com as categorias e a primeira página', () => {
    const { controller } = createController()

    expect(controller.selectedMonth.value).toBe('2026-11')
    expect(controller.periodLabel.value).toBe('novembro de 2026')
    expect(controller.monthOptions.value).toHaveLength(12)
    expect(controller.categories).toEqual(['Salário', 'Alimentação', 'Transporte'])
    expect(controller.page.value).toBe(1)
    expect(controller.pageSize).toBe(8)
  })

  it('só aceita meses existentes nas opções', () => {
    const { controller } = createController()

    controller.setMonth('2026-10')
    expect(controller.selectedMonth.value).toBe('2026-10')

    controller.setMonth('2026-99')
    expect(controller.selectedMonth.value).toBe('2026-10')

    controller.setMonth(1)
    expect(controller.selectedMonth.value).toBe('2026-10')
  })

  it('busca descrições sem diferenciar maiúsculas nem acentos', async () => {
    const { controller } = createController()

    controller.search.value = 'cafe'
    await vi.waitFor(() => expect(controller.filteredTransactions.value).toHaveLength(1))
    expect(controller.filteredTransactions.value[0].description).toBe('Café')

    controller.search.value = 'MERCADO'
    await vi.waitFor(() => expect(controller.filteredTransactions.value).toHaveLength(1))

    controller.search.value = 'nao-existe'
    await vi.waitFor(() => expect(controller.filteredTransactions.value).toHaveLength(0))
  })

  it('filtra por categoria e por tipo', () => {
    const { controller } = createController()

    controller.setCategoryFilter('Lazer')
    expect(controller.categoryLabel.value).toBe('Lazer')
    expect(controller.filteredTransactions.value.map((item) => item.id)).toEqual([6, 7])

    controller.setTypeFilter('income')
    expect(controller.filteredTransactions.value).toHaveLength(0)

    controller.setCategoryFilter('all')
    expect(controller.filteredTransactions.value.map((item) => item.id)).toEqual([1, 4])
  })

  it('ignora filtros de categoria e tipo inválidos', () => {
    const { controller } = createController()

    controller.setCategoryFilter(42)
    controller.setTypeFilter('other')

    expect(controller.categoryFilter.value).toBe('all')
    expect(controller.typeFilter.value).toBe('all')
  })

  it('pagina em blocos de 8 itens e calcula o rótulo do intervalo', () => {
    const { controller } = createController()

    expect(controller.paginatedTransactions.value).toHaveLength(8)
    expect(controller.rangeLabel.value).toBe('Mostrando 1–8 de 10 transações')

    controller.page.value = 2
    expect(controller.paginatedTransactions.value.map((item) => item.id)).toEqual([9, 10])
    expect(controller.rangeLabel.value).toBe('Mostrando 9–10 de 10 transações')
  })

  it('volta para a primeira página quando um filtro muda', async () => {
    const { controller } = createController()
    controller.page.value = 2

    controller.search.value = 'a'
    await vi.waitFor(() => expect(controller.page.value).toBe(1))
  })

  it('não deixa a página passar do total de páginas', async () => {
    const { controller, query } = createController()
    controller.page.value = 2

    query.data.value = [createTransaction({ id: 1 })]
    await nextTick()
    expect(controller.page.value).toBe(1)
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
    query.data.value = createTransactions()
    expect(controller.viewState.value).toBe('ready')
  })

  it('indica atualização em segundo plano', async () => {
    const { controller, query } = createController()
    await vi.waitFor(() => expect(controller.isRefreshing.value).toBe(false))

    query.isFetching.value = true
    expect(controller.isRefreshing.value).toBe(true)

    query.isPending.value = true
    expect(controller.isRefreshing.value).toBe(false)
  })

  it('descreve o estado atual para leitores de tela', () => {
    const { controller, query } = createController()

    query.isPending.value = true
    expect(controller.statusMessage.value).toBe('Carregando transações…')

    query.isPending.value = false
    query.isError.value = true
    expect(controller.statusMessage.value).toBe('Não foi possível carregar as transações.')

    query.isError.value = false
    query.data.value = []
    expect(controller.statusMessage.value).toBe('Nenhuma transação em novembro de 2026.')

    controller.search.value = 'nada'
    expect(controller.statusMessage.value).toBe(
      'Nenhuma transação encontrada com esses filtros.',
    )

    controller.clearFilters()
    query.data.value = createTransactions()
    expect(controller.statusMessage.value).toBe('Mostrando 1–8 de 10 transações')

    query.isFetching.value = true
    expect(controller.statusMessage.value).toBe('Atualizando transações…')
  })

  it('limpa filtros e tenta novamente', () => {
    const { controller } = createController()
    controller.search.value = 'x'
    controller.categoryFilter.value = 'Lazer'
    controller.typeFilter.value = 'income'

    controller.clearFilters()
    expect(controller.search.value).toBe('')
    expect(controller.categoryFilter.value).toBe('all')
    expect(controller.typeFilter.value).toBe('all')

    controller.retry()
    expect(mocks.refetch).toHaveBeenCalledOnce()
  })

  it('abre detalhes da transação', () => {
    const { controller } = createController()
    const transaction = createTransaction()

    controller.openDetails(transaction)

    expect(controller.selectedTransaction.value).toEqual(transaction)
    expect(controller.isDetailsOpen.value).toBe(true)
  })

  it('não abre o formulário novo offline', () => {
    mocks.isOnline.value = false
    const { controller } = createController()

    controller.openNewTransaction()

    expect(controller.isNewTransactionOpen.value).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Você está offline. Conecte-se para salvar alterações.',
    )
  })

  it('abre o formulário novo online', () => {
    const { controller } = createController()

    controller.openNewTransaction()

    expect(controller.isNewTransactionOpen.value).toBe(true)
  })

  it('registra uma transação, limpa filtros e atualiza os caches', async () => {
    const { controller } = createController()
    controller.search.value = 'café'
    controller.categoryFilter.value = 'Alimentação'
    controller.typeFilter.value = 'expense'
    controller.page.value = 2

    await controller.addTransaction(payload)

    expect(mocks.createTransaction).toHaveBeenCalledWith(payload)
    expect(controller.search.value).toBe('')
    expect(controller.categoryFilter.value).toBe('all')
    expect(controller.typeFilter.value).toBe('all')
    expect(controller.page.value).toBe(1)
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['transactions'],
    })
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['home', 'summary'],
    })
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['home', 'summary', 'by-category'],
    })
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Despesa registrada', {
      description: '“Café” foi adicionada ao período.',
    })
  })

  it('não registra transação offline', async () => {
    mocks.isOnline.value = false
    const { controller } = createController()

    await controller.addTransaction(payload)

    expect(mocks.createTransaction).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalled()
  })

  it('avisa quando o registro falha', async () => {
    mocks.createTransaction.mockRejectedValue(new Error('falhou'))
    const { controller } = createController()

    await controller.addTransaction(payload)

    expect(mocks.toastError).toHaveBeenCalledWith('Não foi possível registrar a transação', {
      description: 'Tente novamente em instantes.',
    })
  })

  it('não edita offline', () => {
    mocks.isOnline.value = false
    const { controller } = createController()

    controller.editTransaction(createTransaction())

    expect(controller.isEditTransactionOpen.value).toBe(false)
    expect(mocks.toastError).toHaveBeenCalled()
  })

  it('abre a edição da transação', () => {
    const { controller } = createController()
    const transaction = createTransaction()

    controller.editTransaction(transaction)

    expect(controller.selectedTransaction.value).toEqual(transaction)
    expect(controller.isEditTransactionOpen.value).toBe(true)
    expect(controller.editError.value).toBe('')
  })

  it('salva a edição usando o nome da categoria do cache', async () => {
    mocks.updateTransaction.mockResolvedValue(
      createTransaction({
        id: 7,
        description: 'Café',
        type: 'income',
        amount: payload.amount,
        date: payload.date,
      }),
    )
    const { controller } = createController()
    const transaction = createTransaction({ id: 7 })
    controller.selectedTransaction.value = transaction
    controller.isEditTransactionOpen.value = true

    await controller.saveEditedTransaction({ ...payload, category: 'cat-fun', type: 'income' })

    expect(mocks.updateTransaction).toHaveBeenCalledWith(7, {
      ...payload,
      category: 'cat-fun',
      type: 'income',
    })
    expect(controller.selectedTransaction.value).toMatchObject({
      id: 7,
      categoryId: 'cat-fun',
      category: 'Lazer',
      type: 'income',
      amount: payload.amount,
    })
    expect(controller.isEditTransactionOpen.value).toBe(false)
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Transação atualizada', {
      description: '“Café” foi atualizada.',
    })
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalled()
  })

  it('não salva sem transação selecionada ou enquanto já salva', async () => {
    const { controller } = createController()

    await controller.saveEditedTransaction(payload)
    expect(mocks.updateTransaction).not.toHaveBeenCalled()

    controller.selectedTransaction.value = createTransaction()
    controller.isSavingEdit.value = true
    await controller.saveEditedTransaction(payload)
    expect(mocks.updateTransaction).not.toHaveBeenCalled()
  })

  it('fecha a edição quando a transação já foi excluída (404)', async () => {
    mocks.updateTransaction.mockRejectedValue(httpError(404))
    const { controller } = createController()
    controller.selectedTransaction.value = createTransaction()
    controller.isEditTransactionOpen.value = true
    controller.isDetailsOpen.value = true

    await controller.saveEditedTransaction(payload)

    expect(controller.isEditTransactionOpen.value).toBe(false)
    expect(controller.isDetailsOpen.value).toBe(false)
    expect(mocks.toastInfo).toHaveBeenCalledWith('Essa transação já tinha sido excluída.')
  })

  it('mostra mensagens específicas para 400, falha de rede e erro genérico', async () => {
    const { controller } = createController()
    controller.selectedTransaction.value = createTransaction()

    mocks.updateTransaction.mockRejectedValueOnce(httpError(400))
    await controller.saveEditedTransaction(payload)
    expect(controller.editError.value).toBe(
      'Não foi possível salvar com os dados informados. Revise os campos e tente novamente.',
    )

    mocks.updateTransaction.mockRejectedValueOnce(networkError)
    await controller.saveEditedTransaction(payload)
    expect(controller.editError.value).toBe(
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    )

    mocks.updateTransaction.mockRejectedValueOnce(new Error('erro'))
    await controller.saveEditedTransaction(payload)
    expect(controller.editError.value).toBe(
      'Não foi possível salvar as alterações. Tente novamente em instantes.',
    )
    expect(controller.isSavingEdit.value).toBe(false)
  })

  it('pede confirmação para excluir e abre o diálogo', () => {
    const { controller } = createController()
    const transaction = createTransaction()

    controller.requestDeleteTransaction(transaction)

    expect(controller.transactionPendingDelete.value).toEqual(transaction)
    expect(controller.isDeleteDialogOpen.value).toBe(true)
    expect(controller.deleteError.value).toBe('')
  })

  it('repassa a exclusão do diálogo de edição', () => {
    const { controller } = createController()
    const transaction = createTransaction()
    controller.selectedTransaction.value = transaction

    controller.deleteEditedTransaction()

    expect(controller.transactionPendingDelete.value).toEqual(transaction)
    expect(controller.isDeleteDialogOpen.value).toBe(true)
  })

  it('bloqueia o fechamento do diálogo enquanto exclui', async () => {
    let finishDelete!: () => void
    mocks.deleteTransaction.mockReturnValue(
      new Promise<void>((resolve) => {
        finishDelete = resolve
      }),
    )
    const { controller } = createController()
    controller.transactionPendingDelete.value = createTransaction()
    controller.isDeleteDialogOpen.value = true

    const deleting = controller.confirmDeleteTransaction()
    expect(controller.isDeleting.value).toBe(true)

    controller.setDeleteDialogOpen(false)
    expect(controller.isDeleteDialogOpen.value).toBe(true)

    finishDelete()
    await deleting
    expect(controller.isDeleteDialogOpen.value).toBe(false)
  })

  it('exclui a transação, fecha os painéis e devolve o foco à busca', async () => {
    document.body.innerHTML = `<input id="${TRANSACTIONS_SEARCH_ID}" />`
    const { controller } = createController()
    const transaction = createTransaction()
    controller.selectedTransaction.value = transaction
    controller.isDetailsOpen.value = true
    controller.isEditTransactionOpen.value = true
    controller.transactionPendingDelete.value = transaction
    controller.isDeleteDialogOpen.value = true

    await controller.confirmDeleteTransaction()

    expect(mocks.deleteTransaction).toHaveBeenCalledWith(transaction.id)
    expect(controller.isDeleteDialogOpen.value).toBe(false)
    expect(controller.isDetailsOpen.value).toBe(false)
    expect(controller.isEditTransactionOpen.value).toBe(false)
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Transação excluída', {
      description: '“Mercado do mês” foi removida.',
    })
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalled()

    const event = { preventDefault: vi.fn() }
    controller.handleCloseAutoFocus(event as unknown as Event)
    await nextTick()
    expect(event.preventDefault).toHaveBeenCalled()
    expect(document.activeElement?.id).toBe(TRANSACTIONS_SEARCH_ID)
  })

  it('trata a exclusão de uma transação que já não existe (404)', async () => {
    mocks.deleteTransaction.mockRejectedValue(httpError(404))
    const { controller } = createController()
    const transaction = createTransaction()
    controller.transactionPendingDelete.value = transaction
    controller.isDeleteDialogOpen.value = true

    await controller.confirmDeleteTransaction()

    expect(controller.isDeleteDialogOpen.value).toBe(false)
    expect(mocks.toastInfo).toHaveBeenCalledWith('Essa transação já tinha sido excluída.')
  })

  it('mostra erro de rede e erro genérico ao excluir', async () => {
    const { controller } = createController()
    const transaction = createTransaction()
    controller.transactionPendingDelete.value = transaction
    controller.isDeleteDialogOpen.value = true

    mocks.deleteTransaction.mockRejectedValueOnce(networkError)
    await controller.confirmDeleteTransaction()
    expect(controller.deleteError.value).toBe(
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    )
    expect(controller.isDeleteDialogOpen.value).toBe(true)

    mocks.deleteTransaction.mockRejectedValueOnce(new Error('erro'))
    await controller.confirmDeleteTransaction()
    expect(controller.deleteError.value).toBe(
      'Não foi possível excluir. Tente novamente em instantes.',
    )
    expect(controller.isDeleting.value).toBe(false)
  })

  it('não exclui offline nem sem transação pendente', async () => {
    mocks.isOnline.value = false
    const { controller } = createController()
    controller.transactionPendingDelete.value = createTransaction()

    await controller.confirmDeleteTransaction()
    expect(mocks.deleteTransaction).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalled()

    mocks.isOnline.value = true
    controller.transactionPendingDelete.value = null
    await controller.confirmDeleteTransaction()
    expect(mocks.deleteTransaction).not.toHaveBeenCalled()
  })

  it('não move o foco quando a exclusão não aconteceu', () => {
    const { controller } = createController()
    const event = { preventDefault: vi.fn() }

    controller.handleCloseAutoFocus(event as unknown as Event)

    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('formata datas e valores', () => {
    const { controller } = createController()
    const transaction = createTransaction({ date: '2026-11-09', type: 'expense', amount: 486.3 })

    expect(controller.formatDate('2026-11-09')).toBe('9 nov 2026')
    expect(controller.formatLongDate('2026-11-09')).toBe('9 de novembro de 2026')
    expect(controller.formatCreatedAt('2026-11-09T12:00:00Z')).toMatch(
      /^09\/11\/2026 às \d{2}:\d{2}$/,
    )
    expect(controller.formatCreatedAt('data-invalida')).toBe('data-invalida')
    expect(controller.formatSignedAmount(transaction)).toMatch(/^− R\$\s486,30$/)
    expect(
      controller.formatSignedAmount(createTransaction({ type: 'income', amount: 10 })),
    ).toMatch(/^\+ R\$\s10,00$/)
  })
})
