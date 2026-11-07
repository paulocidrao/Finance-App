import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import { useNetworkStatus } from '@/utils/network-status'
import { getSummary, type HomeSummary } from './home.service'
import {
  getCategoryExpenses,
  HOME_CATEGORY_SUMMARY_QUERY_KEY,
} from './home.service'
import {
  createTransaction,
  type NewTransactionInput,
} from '@/views/transactions/transactions.service'

const HOME_SUMMARY_QUERY_KEY = ['home', 'summary'] as const

const MONTHS_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)

  return `${MONTHS_LONG[monthNumber - 1]} de ${year}`
}

const emptySummary: HomeSummary = {
  periodLabel: '',
  balance: 0,
  income: 0,
  expenses: 0,
  transactionsCount: 0,
  transactions: [],
  categories: [],
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const percentageFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatSignedAmount(value: number) {
  const sign = value >= 0 ? '+' : '−'
  return `${sign} ${currencyFormatter.format(Math.abs(value))}`
}

function formatPercentage(value: number) {
  return `${percentageFormatter.format(value)}%`
}

export function useHomeController() {
  const { isOnline } = useNetworkStatus()
  const queryClient = useQueryClient()
  const isNewTransactionOpen = ref(false)
  const selectedMonth = ref(getMonthKey(new Date()))
  const selectedMonthLabel = computed(() => getMonthLabel(selectedMonth.value))
  const monthOptions = computed(() => {
    const current = new Date()

    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(current.getFullYear(), current.getMonth() - index, 1)
      const value = getMonthKey(date)

      return { value, label: getMonthLabel(value) }
    })
  })
  const summaryQuery = useQuery({
    queryKey: computed(() => [...HOME_SUMMARY_QUERY_KEY, selectedMonth.value]),
    queryFn: () => getSummary(selectedMonth.value),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
  const categorySummaryQuery = useQuery({
    queryKey: computed(() => [
      ...HOME_CATEGORY_SUMMARY_QUERY_KEY,
      selectedMonth.value,
    ]),
    queryFn: () => getCategoryExpenses(selectedMonth.value),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  function setMonth(value: unknown): void {
    if (typeof value === 'string' && monthOptions.value.some((month) => month.value === value)) {
      selectedMonth.value = value
    }
  }
  const summary = computed(() => {
    const currentSummary = summaryQuery.data.value ?? emptySummary
    const categories = categorySummaryQuery.data.value

    return categories ? { ...currentSummary, categories } : currentSummary
  })

  function openNewTransaction(): void {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.')
      return
    }
    isNewTransactionOpen.value = true
  }

  async function addTransaction(payload: NewTransactionInput): Promise<void> {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.')
      return
    }
    try {
      await createTransaction(payload)
      await queryClient.invalidateQueries({ queryKey: HOME_SUMMARY_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: HOME_CATEGORY_SUMMARY_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })

      toast.success(payload.type === 'income' ? 'Entrada registrada' : 'Despesa registrada', {
        description: `“${payload.description}” foi adicionada ao período.`,
      })
    } catch {
      toast.error('Não foi possível registrar a transação', {
        description: 'Tente novamente em instantes.',
      })
    }
  }

  return {
    isOnline,
    summary,
    selectedMonth,
    selectedMonthLabel,
    monthOptions,
    setMonth,
    isSummaryLoading: summaryQuery.isPending,
    summaryError: summaryQuery.error,
    isSummaryError: summaryQuery.isError || categorySummaryQuery.isError,
    refetchSummary: () => Promise.all([summaryQuery.refetch(), categorySummaryQuery.refetch()]),
    isNewTransactionOpen,
    openNewTransaction,
    addTransaction,
    formatCurrency,
    formatSignedAmount,
    formatPercentage,
  }
}
