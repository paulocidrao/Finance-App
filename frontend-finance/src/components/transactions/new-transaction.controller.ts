import { computed, reactive, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import {
  CATEGORIES_QUERY_KEY,
  getCategories,
} from '@/views/categories/categories.service'
import type {
  NewTransactionInput,
  TransactionType,
} from '@/views/transactions/transactions.service'
import { formatLongDate, getTodayDate, normalizeAmountInput, parseAmount } from './new-transaction.service'

interface NewTransactionForm {
  type: TransactionType
  amount: string
  description: string
  category: string
  date: string
}

export function useNewTransactionController() {
  const categoriesQuery = useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
  const categories = computed(() =>
    (categoriesQuery.data.value ?? []).filter((category) => category.type === form.type),
  )
  const form = reactive<NewTransactionForm>({
    type: 'expense',
    amount: '',
    description: '',
    category: '',
    date: getTodayDate(),
  })
  const error = ref('')

  const submitLabel = computed(() =>
    form.type === 'income' ? 'Salvar entrada' : 'Salvar despesa',
  )

  watch(
    () => form.type,
    () => {
      form.category = categories.value[0]?.id ?? ''
      error.value = ''
    },
  )
  watch(categories, (options) => {
    if (!options.some((category) => category.id === form.category)) {
      form.category = options[0]?.id ?? ''
    }
  })

  function setType(value: unknown): void {
    if (value === 'income' || value === 'expense') {
      form.type = value
    }
  }

  function reset(): void {
    form.type = 'expense'
    form.amount = ''
    form.description = ''
    form.category = categories.value[0]?.id ?? ''
    form.date = getTodayDate()
    error.value = ''
  }

  function normalizeAmount(): void {
    form.amount = normalizeAmountInput(form.amount)
  }

  function buildPayload(): NewTransactionInput | null {
    const amount = parseAmount(form.amount)
    const description = form.description.trim()

    if (amount === null) {
      error.value = 'Informe um valor maior que zero.'
      return null
    }

    if (!description) {
      error.value = 'Informe uma descrição.'
      return null
    }

    if (!form.category) {
      error.value = 'Selecione uma categoria.'
      return null
    }

    if (!form.date) {
      error.value = 'Informe uma data.'
      return null
    }

    error.value = ''

    return {
      type: form.type,
      amount,
      description,
      category: form.category,
      date: form.date,
    }
  }

  return {
    form,
    categories,
    submitLabel,
    error,
    setType,
    reset,
    normalizeAmount,
    buildPayload,
    formatLongDate,
  }
}
