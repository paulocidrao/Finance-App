import { describe, expect, it } from 'vitest'
import {
  CATEGORY_NAME_MAX_LENGTH,
  duplicatedNameMessage,
  validateCategoryName,
} from './categories.validation'

describe('validateCategoryName', () => {
  it('exige o nome', () => {
    expect(validateCategoryName('')).toBe('Informe o nome da categoria.')
    expect(validateCategoryName('   ')).toBe('Informe o nome da categoria.')
  })

  it('limita o nome ao tamanho máximo do backend', () => {
    expect(validateCategoryName('a'.repeat(CATEGORY_NAME_MAX_LENGTH))).toBeUndefined()
    expect(validateCategoryName('a'.repeat(CATEGORY_NAME_MAX_LENGTH + 1))).toBe(
      'Use no máximo 40 caracteres (hoje são 41).',
    )
  })

  it('ignora espaços nas pontas', () => {
    expect(validateCategoryName('  Mercado  ')).toBeUndefined()
  })
})

describe('duplicatedNameMessage', () => {
  it('usa a palavra do tipo da categoria', () => {
    expect(duplicatedNameMessage('expense')).toBe(
      'Já existe uma categoria de despesa com esse nome.',
    )
    expect(duplicatedNameMessage('income')).toBe(
      'Já existe uma categoria de entrada com esse nome.',
    )
  })
})
