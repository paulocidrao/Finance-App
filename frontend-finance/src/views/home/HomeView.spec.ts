import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  controller: null as null | Record<string, unknown>,
}))

vi.mock('./home.controller', () => ({
  useHomeController: () => mocks.controller,
}))

import HomeView from './HomeView.vue'

const NewTransactionDialogStub = defineComponent({
  name: 'NewTransactionDialog',
  props: { open: Boolean },
  emits: ['created', 'update:open'],
  setup() {
    return () => null
  },
})

type Summary = {
  periodLabel: string
  balance: number
  income: number
  expenses: number
  transactionsCount: number
  transactions: Array<{
    id: number
    description: string
    category: string
    date: string
    amount: number
  }>
  categories: Array<{
    name: string
    amount: number
    percentage: number
    tone?: 'primary' | 'muted'
  }>
}

function createSummary(): Summary {
  return {
    periodLabel: 'Novembro de 2026',
    balance: 3218.1,
    income: 8450,
    expenses: 5231.9,
    transactionsCount: 5,
    transactions: [
      {
        id: 1,
        description: 'Salário',
        category: 'Salário',
        date: '28 nov',
        amount: 7500,
      },
      {
        id: 2,
        description: 'Mercado do mês',
        category: 'Alimentação',
        date: '27 nov',
        amount: -486.3,
      },
    ],
    categories: [
      { name: 'Moradia', amount: 1850, percentage: 35.4 },
      { name: 'Sem categoria', amount: 1001, percentage: 19.1, tone: 'muted' },
    ],
  }
}

function createController() {
  return {
    isOnline: ref(true),
    summary: ref(createSummary()),
    selectedMonth: ref('2026-11'),
    selectedMonthLabel: ref('novembro de 2026'),
    monthOptions: ref([
      { value: '2026-11', label: 'novembro de 2026' },
      { value: '2026-10', label: 'outubro de 2026' },
    ]),
    setMonth: vi.fn(),
    isSummaryLoading: ref(false),
    isSummaryError: ref(false),
    refetchSummary: vi.fn(),
    isCategoriesLoading: ref(false),
    isRetrying: ref(false),
    isNewTransactionOpen: ref(false),
    openNewTransaction: vi.fn(),
    addTransaction: vi.fn(),
    formatCurrency: vi.fn((value: number) => `R$ ${value.toFixed(2)}`),
    formatSignedAmount: vi.fn((value: number) =>
      value >= 0 ? `+ R$ ${value.toFixed(2)}` : `− R$ ${Math.abs(value).toFixed(2)}`,
    ),
    formatPercentage: vi.fn((value: number) => `${value}%`),
  }
}

function mountView() {
  return mount(HomeView, {
    global: {
      stubs: {
        NewTransactionDialog: NewTransactionDialogStub,
      },
    },
  })
}

describe('HomeView', () => {
  let controller: ReturnType<typeof createController>

  beforeEach(() => {
    controller = createController()
    mocks.controller = controller as unknown as Record<string, unknown>
  })

  it('renderiza o resumo financeiro do período', () => {
    const wrapper = mountView()

    expect(wrapper.get('h1').text()).toBe('Seu dinheiro, em foco')
    expect(wrapper.text()).toContain('novembro de 2026')
    expect(wrapper.text()).toContain('R$ 3218.10')
    expect(wrapper.text()).toContain('R$ 8450.00')
    expect(wrapper.text()).toContain('R$ 5231.90')
    expect(wrapper.text()).toContain('5 transações')
    expect(wrapper.text()).toContain('Saldo do período')
    expect(wrapper.text()).toContain('Entradas menos despesas')
  })

  it('renderiza a atividade recente em tabela e em lista mobile', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Salário')
    expect(wrapper.text()).toContain('Mercado do mês')
    expect(wrapper.text()).toContain('+ R$ 7500.00')
    expect(wrapper.text()).toContain('− R$ 486.30')
    expect(wrapper.text()).toContain('Ver todas')
  })

  it('mostra o estado vazio de atividade recente e permite adicionar', async () => {
    controller.summary.value = { ...createSummary(), transactions: [] }
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Tudo começa com um registro')
    const addButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Adicionar transação'))
    expect(addButton).toBeDefined()
    await addButton!.trigger('click')

    expect(controller.openNewTransaction).toHaveBeenCalledOnce()
  })

  it('renderiza as despesas por categoria', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Despesas por categoria')
    expect(wrapper.text()).toContain('Moradia')
    expect(wrapper.text()).toContain('35.4%')
    expect(wrapper.text()).toContain('Sem categoria')
    expect(wrapper.findAll('[data-slot="progress"]')).toHaveLength(2)
  })

  it('mostra o estado vazio das categorias', async () => {
    controller.summary.value = { ...createSummary(), categories: [] }
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Sem despesas por enquanto')
  })

  it('mostra o esqueleto enquanto o resumo carrega', async () => {
    controller.isSummaryLoading.value = true
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(wrapper.text()).not.toContain('Saldo do período')
    expect(wrapper.text()).not.toContain('Salário')
  })

  it('mostra o esqueleto das categorias separadamente', async () => {
    controller.isCategoriesLoading.value = true
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Despesas por categoria')
    expect(wrapper.text()).not.toContain('Moradia')
  })

  it('exibe o erro do resumo e tenta novamente', async () => {
    controller.isSummaryError.value = true
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Não foi possível carregar seu resumo')
    expect(wrapper.text()).toContain('Confira sua conexão e tente novamente.')

    const retry = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Tentar novamente'))
    await retry!.trigger('click')

    expect(controller.refetchSummary).toHaveBeenCalledOnce()
  })

  it('desabilita as ações de criação quando está offline', async () => {
    controller.isOnline.value = false
    const wrapper = mountView()
    await nextTick()

    const newTransaction = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Nova transação'))
    expect(newTransaction?.attributes('disabled')).toBeDefined()
  })

  it('abre o formulário de nova transação pelo cabeçalho', async () => {
    const wrapper = mountView()

    const newTransaction = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Nova transação'))
    await newTransaction!.trigger('click')

    expect(controller.openNewTransaction).toHaveBeenCalledOnce()
  })

  it('repassa o evento de transação criada pelo diálogo', () => {
    const wrapper = mountView()
    const payload = {
      type: 'expense' as const,
      amount: 10,
      description: 'Café',
      category: 'cat-1',
      date: '2026-11-09',
    }

    wrapper.findComponent(NewTransactionDialogStub).vm.$emit('created', payload)

    expect(controller.addTransaction).toHaveBeenCalledWith(payload)
  })
})
