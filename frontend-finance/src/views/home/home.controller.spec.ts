import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  queryClient: {
    invalidateQueries: vi.fn(),
  },
  getSummary: vi.fn(),
  getCategoryExpenses: vi.fn(),
  createTransaction: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  isOnline: { value: true },
}))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => mocks.queryClient,
}))
vi.mock('./home.service', () => ({
  getSummary: mocks.getSummary,
  getCategoryExpenses: mocks.getCategoryExpenses,
  HOME_CATEGORY_SUMMARY_QUERY_KEY: ['home', 'summary', 'by-category'],
}))
vi.mock('@/views/transactions/transactions.service', () => ({
  createTransaction: mocks.createTransaction,
}))
vi.mock('@/utils/network-status', () => ({
  useNetworkStatus: () => ({ isOnline: mocks.isOnline }),
}))
vi.mock('vue-sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

import { useHomeController } from './home.controller'
import type { HomeSummary } from './home.service'

function normalizeCurrency(value: string) {
  return value.replace(/\u00a0/g, ' ')
}

function createSummary(): HomeSummary {
  return {
    periodLabel: 'Novembro de 2026',
    balance: 3218.1,
    income: 8450,
    expenses: 5231.9,
    transactionsCount: 5,
    transactions: [],
    categories: [],
  }
}

function createQuery<T>(initial: T | null) {
  return {
    data: ref<T | null>(initial),
    isPending: ref(false),
    isError: ref(false),
    error: ref<unknown>(null),
    isFetching: ref(false),
    refetch: vi.fn().mockResolvedValue(undefined),
  }
}

describe('useHomeController', () => {
  let summaryQuery: ReturnType<typeof createQuery<HomeSummary>>
  let categoryQuery: ReturnType<typeof createQuery<HomeSummary['categories']>>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T12:00:00'))

    mocks.isOnline.value = true
    summaryQuery = createQuery<HomeSummary>(createSummary())
    categoryQuery = createQuery<HomeSummary['categories']>([])
    mocks.useQuery.mockReset()
    mocks.useQuery.mockReturnValueOnce(summaryQuery).mockReturnValue(categoryQuery)
    mocks.queryClient.invalidateQueries.mockResolvedValue(undefined)
    mocks.createTransaction.mockResolvedValue({})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('começa no mês atual e oferece os últimos 12 meses', () => {
    const controller = useHomeController()

    expect(controller.selectedMonth.value).toBe('2026-11')
    expect(controller.selectedMonthLabel.value).toBe('novembro de 2026')
    expect(controller.monthOptions.value).toHaveLength(12)
    expect(controller.monthOptions.value[0]).toEqual({
      value: '2026-11',
      label: 'novembro de 2026',
    })
    expect(controller.monthOptions.value[11]).toEqual({
      value: '2025-12',
      label: 'dezembro de 2025',
    })
  })

  it('só aceita meses presentes na lista de opções', () => {
    const controller = useHomeController()

    controller.setMonth('2026-10')
    expect(controller.selectedMonth.value).toBe('2026-10')

    controller.setMonth('2026-99')
    expect(controller.selectedMonth.value).toBe('2026-10')

    controller.setMonth(202610)
    expect(controller.selectedMonth.value).toBe('2026-10')
  })

  it('expõe o resumo e substitui as categorias pelas da consulta dedicada', () => {
    const summary = createSummary()
    summaryQuery.data.value = summary
    categoryQuery.data.value = [
      { name: 'Moradia', amount: 1850, percentage: 35.4 },
      { name: 'Lazer', amount: 500, percentage: 9.5, tone: 'muted' },
    ]

    const controller = useHomeController()

    expect(controller.summary.value).toEqual({
      ...summary,
      categories: categoryQuery.data.value,
    })
  })

  it('usa um resumo vazio quando ainda não há dados', () => {
    summaryQuery.data.value = null
    categoryQuery.data.value = null

    const controller = useHomeController()

    expect(controller.summary.value).toEqual({
      periodLabel: '',
      balance: 0,
      income: 0,
      expenses: 0,
      transactionsCount: 0,
      transactions: [],
      categories: [],
    })
  })

  it('reflete os estados de carregamento, erro e nova tentativa', () => {
    const controller = useHomeController()

    summaryQuery.isPending.value = true
    expect(controller.isSummaryLoading.value).toBe(true)
    expect(controller.isCategoriesLoading.value).toBe(true)
    expect(controller.isSummaryError.value).toBe(false)

    summaryQuery.isPending.value = false
    categoryQuery.isPending.value = false
    categoryQuery.isError.value = true
    expect(controller.isCategoriesLoading.value).toBe(false)
    expect(controller.isSummaryError.value).toBe(true)

    summaryQuery.isFetching.value = true
    expect(controller.isRetrying.value).toBe(true)
  })

  it('recarrega as duas consultas', async () => {
    const controller = useHomeController()

    await controller.refetchSummary()

    expect(summaryQuery.refetch).toHaveBeenCalledOnce()
    expect(categoryQuery.refetch).toHaveBeenCalledOnce()
  })

  it('não abre o formulário novo quando está offline', () => {
    mocks.isOnline.value = false
    const controller = useHomeController()

    controller.openNewTransaction()

    expect(controller.isNewTransactionOpen.value).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Você está offline. Conecte-se para salvar alterações.',
    )
  })

  it('abre o formulário novo quando está online', () => {
    const controller = useHomeController()

    controller.openNewTransaction()

    expect(controller.isNewTransactionOpen.value).toBe(true)
  })

  it('não registra transação offline', async () => {
    mocks.isOnline.value = false
    const controller = useHomeController()

    await controller.addTransaction({
      type: 'expense',
      amount: 10,
      description: 'Café',
      category: 'cat-1',
      date: '2026-11-09',
    })

    expect(mocks.createTransaction).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalled()
  })

  it('registra uma entrada e invalida resumo, categorias e transações', async () => {
    const controller = useHomeController()

    await controller.addTransaction({
      type: 'income',
      amount: 950,
      description: 'Freelance',
      category: 'cat-1',
      date: '2026-11-09',
    })

    expect(mocks.createTransaction).toHaveBeenCalledOnce()
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['home', 'summary'],
    })
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['home', 'summary', 'by-category'],
    })
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['transactions'],
    })
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Entrada registrada', {
      description: '“Freelance” foi adicionada ao período.',
    })
  })

  it('usa a mensagem de despesa registrada', async () => {
    const controller = useHomeController()

    await controller.addTransaction({
      type: 'expense',
      amount: 42,
      description: 'Mercado',
      category: 'cat-2',
      date: '2026-11-09',
    })

    expect(mocks.toastSuccess).toHaveBeenCalledWith('Despesa registrada', {
      description: '“Mercado” foi adicionada ao período.',
    })
  })

  it('avisa quando o registro falha', async () => {
    mocks.createTransaction.mockRejectedValue(new Error('falhou'))
    const controller = useHomeController()

    await controller.addTransaction({
      type: 'expense',
      amount: 42,
      description: 'Mercado',
      category: 'cat-2',
      date: '2026-11-09',
    })

    expect(mocks.toastError).toHaveBeenCalledWith('Não foi possível registrar a transação', {
      description: 'Tente novamente em instantes.',
    })
  })

  it('formata moeda, valores com sinal e percentuais', () => {
    const controller = useHomeController()

    expect(normalizeCurrency(controller.formatCurrency(1234.5))).toBe('R$ 1.234,50')
    expect(normalizeCurrency(controller.formatSignedAmount(10))).toBe('+ R$ 10,00')
    expect(normalizeCurrency(controller.formatSignedAmount(-10))).toBe('− R$ 10,00')
    expect(controller.formatPercentage(12.34)).toBe('12,3%')
  })
})
