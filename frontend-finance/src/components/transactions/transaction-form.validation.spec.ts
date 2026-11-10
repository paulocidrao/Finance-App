import { describe, expect, it } from 'vitest'
import {
  AMOUNT_MAX,
  DESCRIPTION_MAX_LENGTH,
  validateTransactionField,
  type TransactionFormValues,
} from './transaction-form.validation'

const values: TransactionFormValues = {
  amount: '',
  description: '',
  category: '',
  date: '',
}

function withValues(overrides: Partial<TransactionFormValues>): TransactionFormValues {
  return { ...values, ...overrides }
}

describe('validateTransactionField', () => {
  it('valida o valor', () => {
    expect(validateTransactionField('amount', values)).toBe('Informe o valor.')
    expect(validateTransactionField('amount', withValues({ amount: 'abc' }))).toBe(
      'Informe um valor maior que zero, como 49,90.',
    )
    expect(validateTransactionField('amount', withValues({ amount: '49,90' }))).toBeUndefined()
    expect(
      validateTransactionField('amount', withValues({ amount: String(AMOUNT_MAX + 1) }))
        ?.replace(/\u00a0/g, ' '),
    ).toBe('O valor máximo é R$ 21.474.836,47.')
  })

  it('valida a descrição', () => {
    expect(validateTransactionField('description', values)).toBe('Informe uma descrição.')
    expect(
      validateTransactionField(
        'description',
        withValues({ description: 'a'.repeat(DESCRIPTION_MAX_LENGTH + 1) }),
      ),
    ).toBe('Use no máximo 80 caracteres.')
    expect(
      validateTransactionField('description', withValues({ description: '  Café  ' })),
    ).toBeUndefined()
  })

  it('exige uma categoria', () => {
    expect(validateTransactionField('category', values)).toBe('Selecione uma categoria.')
    expect(
      validateTransactionField('category', withValues({ category: 'cat-1' })),
    ).toBeUndefined()
  })

  it('valida a data ISO', () => {
    expect(validateTransactionField('date', values)).toBe('Informe a data.')
    expect(validateTransactionField('date', withValues({ date: '09/11/2026' }))).toBe(
      'Informe uma data válida.',
    )
    expect(validateTransactionField('date', withValues({ date: '2026-02-30' }))).toBe(
      'Informe uma data válida.',
    )
    expect(validateTransactionField('date', withValues({ date: '2026-11-09' }))).toBeUndefined()
  })
})
