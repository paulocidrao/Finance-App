import { parseAmount } from './new-transaction.service'

export interface TransactionFormValues {
  amount: string
  description: string
  category: string
  date: string
}

export type TransactionField = keyof TransactionFormValues
export type TransactionFormErrors = Partial<Record<TransactionField, string>>

/** Ordem dos campos na tela (usada para focar o primeiro erro). */
export const TRANSACTION_FIELDS: readonly TransactionField[] = [
  'amount',
  'description',
  'category',
  'date',
]

// O backend aceita até 120 caracteres; o formulário de nova transação usa 80.
export const DESCRIPTION_MAX_LENGTH = 80

// amountCents é um Int no Postgres (máximo 2.147.483.647 centavos).
export const AMOUNT_MAX = 21_474_836.47

const amountFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function validateTransactionField(
  field: TransactionField,
  values: TransactionFormValues,
): string | undefined {
  switch (field) {
    case 'amount': {
      if (!values.amount.trim()) return 'Informe o valor.'
      const amount = parseAmount(values.amount)
      if (amount === null) return 'Informe um valor maior que zero, como 49,90.'
      if (amount > AMOUNT_MAX) return `O valor máximo é ${amountFormatter.format(AMOUNT_MAX)}.`
      return undefined
    }
    case 'description': {
      const description = values.description.trim()
      if (!description) return 'Informe uma descrição.'
      if (description.length > DESCRIPTION_MAX_LENGTH) {
        return `Use no máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`
      }
      return undefined
    }
    case 'category':
      return values.category ? undefined : 'Selecione uma categoria.'
    case 'date': {
      if (!values.date) return 'Informe a data.'
      if (!isValidIsoDate(values.date)) return 'Informe uma data válida.'
      return undefined
    }
  }
}
