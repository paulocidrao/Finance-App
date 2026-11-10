import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  getCategories: vi.fn(),
}))

vi.mock('@tanstack/vue-query', () => ({ useQuery: mocks.useQuery }))
vi.mock('@/views/categories/categories.service', () => ({
  CATEGORIES_QUERY_KEY: ['categories'],
  getCategories: mocks.getCategories,
}))

import type { Category } from '@/views/categories/categories.service'
import { useNewTransactionController } from './new-transaction.controller'

function createCategory(overrides: Partial<Category>): Category {
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

const categories = [
  createCategory({ id: 'cat-food', name: 'Alimentação', type: 'expense' }),
  createCategory({ id: 'cat-home', name: 'Moradia', type: 'expense' }),
  createCategory({ id: 'cat-salary', name: 'Salário', type: 'income' }),
]

function createController(data: Category[] = categories) {
  const query = {
    data: ref<Category[] | null>(data),
    isPending: ref(false),
    isError: ref(false),
  }
  mocks.useQuery.mockReset()
  mocks.useQuery.mockReturnValue(query)
  return { controller: useNewTransactionController(), query }
}

describe('useNewTransactionController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('começa como despesa, com a data de hoje e sem categoria', () => {
    const { controller } = createController([])

    expect(controller.form.type).toBe('expense')
    expect(controller.form.amount).toBe('')
    expect(controller.form.description).toBe('')
    expect(controller.form.category).toBe('')
    expect(controller.form.date).toBe('2026-11-09')
    expect(controller.submitLabel.value).toBe('Salvar despesa')
  })

  it('seleciona a primeira categoria do tipo quando os dados chegam', async () => {
    const { controller, query } = createController([])
    query.data.value = categories
    await nextTick()

    expect(controller.categories.value.map((category) => category.id)).toEqual([
      'cat-food',
      'cat-home',
    ])
    expect(controller.form.category).toBe('cat-food')
  })

  it('troca a categoria ao mudar o tipo', async () => {
    const { controller, query } = createController([])
    query.data.value = categories
    await nextTick()
    expect(controller.form.category).toBe('cat-food')

    controller.setType('income')
    await nextTick()

    expect(controller.form.type).toBe('income')
    expect(controller.submitLabel.value).toBe('Salvar entrada')
    expect(controller.categories.value.map((category) => category.id)).toEqual(['cat-salary'])
    expect(controller.form.category).toBe('cat-salary')
  })

  it('ignora tipos inválidos', () => {
    const { controller } = createController()

    controller.setType('other')

    expect(controller.form.type).toBe('expense')
  })

  it('reset volta ao estado inicial e limpa o erro', () => {
    const { controller } = createController()
    controller.form.type = 'income'
    controller.form.amount = '10'
    controller.form.description = 'Café'
    controller.form.category = 'cat-salary'
    controller.form.date = '2026-01-01'
    controller.error.value = 'erro'

    controller.reset()

    expect(controller.form).toEqual({
      type: 'expense',
      amount: '',
      description: '',
      category: 'cat-food',
      date: '2026-11-09',
    })
    expect(controller.error.value).toBe('')
  })

  it('normaliza o valor digitado', () => {
    const { controller } = createController()
    controller.form.amount = '1234,5'

    controller.normalizeAmount()

    expect(controller.form.amount.replace(/\u00a0/g, ' ')).toBe('1.234,50')
  })

  it('valida o valor antes de montar o payload', () => {
    const { controller } = createController()
    controller.form.amount = '0'
    controller.form.description = 'Café'
    controller.form.category = 'cat-food'

    expect(controller.buildPayload()).toBeNull()
    expect(controller.error.value).toBe('Informe um valor maior que zero.')
  })

  it('exige descrição, categoria e data', () => {
    const { controller } = createController()

    controller.form.amount = '10'
    expect(controller.buildPayload()).toBeNull()
    expect(controller.error.value).toBe('Informe uma descrição.')

    controller.form.description = 'Café'
    controller.form.category = ''
    expect(controller.buildPayload()).toBeNull()
    expect(controller.error.value).toBe('Selecione uma categoria.')

    controller.form.category = 'cat-food'
    controller.form.date = ''
    expect(controller.buildPayload()).toBeNull()
    expect(controller.error.value).toBe('Informe uma data.')
  })

  it('monta o payload com a descrição aparada', () => {
    const { controller } = createController()
    controller.form.amount = '49,90'
    controller.form.description = '  Café  '
    controller.form.category = 'cat-food'
    controller.form.date = '2026-11-09'
    controller.error.value = 'erro antigo'

    const payload = controller.buildPayload()

    expect(payload).toEqual({
      type: 'expense',
      amount: 49.9,
      description: 'Café',
      category: 'cat-food',
      date: '2026-11-09',
    })
    expect(controller.error.value).toBe('')
  })

  it('reaproveita o formatador de data por extenso', () => {
    const { controller } = createController()

    expect(controller.formatLongDate('2026-11-09')).toBe('9 de novembro de 2026')
    expect(controller.formatLongDate('')).toBe('Selecione uma data')
  })
})
