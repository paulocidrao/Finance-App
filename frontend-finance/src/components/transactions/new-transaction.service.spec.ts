import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCategories: vi.fn(),
}))

vi.mock('@/views/categories/categories.service', () => ({
  categoriesService: {
    getCategories: mocks.getCategories,
  },
}))

import {
  formatLongDate,
  getCategoryOptions,
  getTodayDate,
  normalizeAmountInput,
  parseAmount,
} from './new-transaction.service'

describe('new-transaction.service', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T12:00:00'))
    mocks.getCategories.mockReturnValue([
      { id: '1', name: 'Alimentação', type: 'expense' },
      { id: '2', name: 'Salário', type: 'income' },
      { id: '3', name: 'Lazer', type: 'expense' },
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getTodayDate', () => {
    it('devolve a data local no formato ISO', () => {
      expect(getTodayDate()).toBe('2026-11-09')
    })
  })

  describe('parseAmount', () => {
    it('interpreta valores com vírgula decimal', () => {
      expect(parseAmount('49,90')).toBe(49.9)
      expect(parseAmount('R$ 1.234,56')).toBe(1234.56)
    })

    it('interpreta pontos como separador decimal ou de milhar', () => {
      expect(parseAmount('1234.56')).toBe(1234.56)
      expect(parseAmount('1.234')).toBe(1234)
      expect(parseAmount('1.234.567')).toBe(1234567)
    })

    it('arredonda para duas casas decimais', () => {
      expect(parseAmount('10,005')).toBe(10.01)
    })

    it('devolve null para valores vazios, inválidos ou não positivos', () => {
      expect(parseAmount('')).toBeNull()
      expect(parseAmount('   ')).toBeNull()
      expect(parseAmount('abc')).toBeNull()
      expect(parseAmount('0')).toBeNull()
      expect(parseAmount('-5')).toBeNull()
    })
  })

  describe('normalizeAmountInput', () => {
    it('formata um valor válido', () => {
      expect(normalizeAmountInput('49,9').replace(/\u00a0/g, ' ')).toBe('49,90')
      expect(normalizeAmountInput('1234,5').replace(/\u00a0/g, ' ')).toBe('1.234,50')
    })

    it('mantém o texto aparado quando o valor é inválido', () => {
      expect(normalizeAmountInput('  abc  ')).toBe('abc')
    })
  })

  describe('formatLongDate', () => {
    it('formata a data por extenso', () => {
      expect(formatLongDate('2026-11-09')).toBe('9 de novembro de 2026')
      expect(formatLongDate('2026-01-01')).toBe('1 de janeiro de 2026')
    })

    it('trata data vazia ou mês inválido', () => {
      expect(formatLongDate('')).toBe('Selecione uma data')
      expect(formatLongDate('2026-13-01')).toBe('2026-13-01')
    })
  })

  describe('getCategoryOptions', () => {
    it('devolve apenas os nomes das categorias do tipo', () => {
      expect(getCategoryOptions('expense')).toEqual(['Alimentação', 'Lazer'])
      expect(getCategoryOptions('income')).toEqual(['Salário'])
    })
  })
})
