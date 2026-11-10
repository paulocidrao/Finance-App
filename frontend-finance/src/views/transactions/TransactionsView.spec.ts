import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  controller: null as null | Record<string, unknown>,
}))

vi.mock('./transactions.controller', () => ({
  TRANSACTIONS_SEARCH_ID: 'transactions-search',
  useTransactionsController: () => mocks.controller,
}))

import TransactionsView from './TransactionsView.vue'

const NewTransactionDialogStub = defineComponent({
  name: 'NewTransactionDialog',
  props: { open: Boolean },
  emits: ['created', 'update:open'],
  setup() {
    return () => null
  },
})

const EditTransactionDialogStub = defineComponent({
  name: 'EditTransactionDialog',
  props: {
    open: Boolean,
    transaction: { type: Object, default: null },
    saving: Boolean,
    serverError: String,
  },
  emits: ['saved', 'deleted', 'update:open', 'closeAutoFocus'],
  setup() {
    return () => null
  },
})

type Transaction = {
  id: number
  date: string
  createdAt: string
  description: string
  category: string
  categoryId?: string | null
  type: 'income' | 'expense'
  amount: number
}

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

const transactions = [
  createTransaction(),
  createTransaction({
    id: 2,
    description: 'Salário',
    category: 'Salário',
    type: 'income',
    amount: 7500,
  }),
]

function createController() {
  return {
    isOnline: ref(true),
    search: ref(''),
    categoryFilter: ref('all'),
    typeFilter: ref('all'),
    page: ref(1),
    pageSize: 8,
    categories: ['Alimentação', 'Lazer', 'Salário'],
    periodLabel: ref('novembro de 2026'),
    selectedMonth: ref('2026-11'),
    monthOptions: ref([
      { value: '2026-11', label: 'novembro de 2026' },
      { value: '2026-10', label: 'outubro de 2026' },
    ]),
    categoryLabel: ref('Todas'),
    viewState: ref('ready'),
    isRefreshing: ref(false),
    statusMessage: ref('Mostrando 1–2 de 2 transações'),
    retry: vi.fn(),
    clearFilters: vi.fn(),
    filteredTransactions: ref(transactions),
    paginatedTransactions: ref(transactions),
    rangeLabel: ref('Mostrando 1–2 de 2 transações'),
    selectedTransaction: ref<Transaction | null>(null),
    isDetailsOpen: ref(false),
    transactionPendingDelete: ref<Transaction | null>(null),
    isDeleteDialogOpen: ref(false),
    isDeleting: ref(false),
    deleteError: ref(''),
    isNewTransactionOpen: ref(false),
    isEditTransactionOpen: ref(false),
    isSavingEdit: ref(false),
    editError: ref(''),
    formatDate: vi.fn((value: string) => `data:${value}`),
    formatLongDate: vi.fn((value: string) => `data-longa:${value}`),
    formatCreatedAt: vi.fn((value: string) => `criada:${value}`),
    formatSignedAmount: vi.fn((transaction: Transaction) =>
      transaction.type === 'income'
        ? `+ R$ ${transaction.amount}`
        : `− R$ ${transaction.amount}`,
    ),
    setCategoryFilter: vi.fn(),
    setTypeFilter: vi.fn(),
    setMonth: vi.fn(),
    openNewTransaction: vi.fn(),
    addTransaction: vi.fn(),
    openDetails: vi.fn(),
    handleCloseAutoFocus: vi.fn(),
    editTransaction: vi.fn(),
    saveEditedTransaction: vi.fn(),
    deleteEditedTransaction: vi.fn(),
    requestDeleteTransaction: vi.fn(),
    setDeleteDialogOpen: vi.fn(),
    confirmDeleteTransaction: vi.fn(),
  }
}

function mountView() {
  return mount(TransactionsView, {
    attachTo: document.body,
    global: {
      stubs: {
        NewTransactionDialog: NewTransactionDialogStub,
        EditTransactionDialog: EditTransactionDialogStub,
      },
    },
  })
}

describe('TransactionsView', () => {
  let controller: ReturnType<typeof createController>

  beforeEach(() => {
    controller = createController()
    mocks.controller = controller as unknown as Record<string, unknown>
  })

  it('renderiza o cabeçalho, filtros e a tabela', () => {
    const wrapper = mountView()

    expect(wrapper.get('h1').text()).toBe('Transações')
    expect(wrapper.get('#transactions-search').attributes('aria-label')).toBe(
      'Buscar por descrição',
    )
    expect(wrapper.text()).toContain('Categoria: Todas')
    expect(wrapper.text()).toContain('novembro de 2026')
    expect(wrapper.text()).toContain('Salário')
    expect(wrapper.text()).toContain('Mercado do mês')
    expect(wrapper.text()).toContain('Entrada')
    expect(wrapper.text()).toContain('Despesa')
  })

  it('exibe o status para leitores de tela', () => {
    const wrapper = mountView()

    const status = wrapper.get('[role="status"]')
    expect(status.text()).toBe('Mostrando 1–2 de 2 transações')
    expect(status.attributes('aria-live')).toBe('polite')
  })

  it('renderiza esqueletos no carregamento', async () => {
    controller.viewState.value = 'loading'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.get('[data-slot="table-container"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.findAll('tbody tr')).toHaveLength(8)
    expect(wrapper.text()).not.toContain('Mercado do mês')
  })

  it('mostra o erro de carregamento e tenta novamente', async () => {
    controller.viewState.value = 'error'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Não foi possível carregar as transações')
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Tentar novamente'))
    await retry!.trigger('click')

    expect(controller.retry).toHaveBeenCalledOnce()
  })

  it('mostra o período vazio e abre o formulário de nova transação', async () => {
    controller.viewState.value = 'empty'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Nenhuma transação em novembro de 2026')
    const create = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Nova transação'))
    await create!.trigger('click')

    expect(controller.openNewTransaction).toHaveBeenCalledOnce()
  })

  it('mostra que os filtros não retornaram resultados e limpa os filtros', async () => {
    controller.viewState.value = 'no-results'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Nenhuma transação encontrada')
    const clear = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Limpar filtros'))
    await clear!.trigger('click')

    expect(controller.clearFilters).toHaveBeenCalledOnce()
  })

  it('atualiza a busca pelo v-model', async () => {
    const wrapper = mountView()

    await wrapper.get('#transactions-search').setValue('mercado')

    expect(controller.search.value).toBe('mercado')
  })

  it('abre os detalhes ao clicar ou pressionar Enter na linha', async () => {
    const wrapper = mountView()
    const rows = wrapper.findAll('tbody tr')

    await rows[0].trigger('click')
    expect(controller.openDetails).toHaveBeenCalledWith(transactions[0])

    await rows[1].trigger('keydown', { key: 'Enter' })
    expect(controller.openDetails).toHaveBeenCalledWith(transactions[1])

    await rows[1].trigger('keydown', { key: ' ' })
    expect(controller.openDetails).toHaveBeenCalledTimes(3)
  })

  it('atualiza o filtro de categoria pelo select', () => {
    const wrapper = mountView()
    const selects = wrapper.findAllComponents({ name: 'Select' })

    selects[0].vm.$emit('update:modelValue', 'Lazer')
    expect(controller.setCategoryFilter).toHaveBeenCalledWith('Lazer')

    selects[1].vm.$emit('update:modelValue', '2026-10')
    expect(controller.setMonth).toHaveBeenCalledWith('2026-10')
  })

  it('atualiza o filtro de tipo pelo toggle group', () => {
    const wrapper = mountView()
    const toggle = wrapper.findComponent({ name: 'ToggleGroup' })

    toggle.vm.$emit('update:modelValue', 'income')

    expect(controller.setTypeFilter).toHaveBeenCalledWith('income')
  })

  it('mostra o intervalo e a paginação quando há resultados', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Mostrando 1–2 de 2 transações')
    expect(wrapper.findComponent({ name: 'Pagination' }).exists()).toBe(true)
  })

  it('marca a tabela como ocupada durante a atualização', async () => {
    controller.isRefreshing.value = true
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.get('[data-slot="table-container"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('tbody').classes()).toContain('opacity-60')
  })

  it('abre os detalhes da transação selecionada no painel lateral', async () => {
    controller.selectedTransaction.value = transactions[0]
    controller.isDetailsOpen.value = true
    mountView()
    await flushPromises()

    expect(document.body.textContent).toContain('Detalhes da transação')
    expect(document.body.textContent).toContain('Mercado do mês')
    expect(document.body.textContent).toContain('data-longa:2026-11-09')
    expect(document.body.textContent).toContain('criada:2026-11-09T12:00:00Z')
    expect(document.body.textContent).toContain('Editar transação')
  })

  it('exibe erro de exclusão no diálogo de confirmação', async () => {
    controller.transactionPendingDelete.value = transactions[0]
    controller.isDeleteDialogOpen.value = true
    controller.deleteError.value = 'Não foi possível excluir.'
    mountView()
    await flushPromises()

    expect(document.body.textContent).toContain('Excluir transação?')
    expect(document.body.textContent).toContain('Mercado do mês')
    expect(document.body.textContent).toContain('Não foi possível excluir.')
  })

  it('repassa os eventos do diálogo de nova transação', () => {
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

  it('repassa os eventos do diálogo de edição', () => {
    const wrapper = mountView()
    const dialog = wrapper.findComponent(EditTransactionDialogStub)
    const payload = {
      type: 'income' as const,
      amount: 10,
      description: 'Café',
      category: 'cat-1',
      date: '2026-11-09',
    }

    dialog.vm.$emit('saved', payload)
    expect(controller.saveEditedTransaction).toHaveBeenCalledWith(payload)

    dialog.vm.$emit('deleted')
    expect(controller.deleteEditedTransaction).toHaveBeenCalledOnce()
  })
})
