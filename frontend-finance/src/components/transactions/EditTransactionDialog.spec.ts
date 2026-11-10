import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  refetch: vi.fn(),
  getCategories: vi.fn(),
  isOnline: null as null | { value: boolean },
  toastError: vi.fn(),
}))

vi.mock('@tanstack/vue-query', () => ({ useQuery: mocks.useQuery }))
vi.mock('@/views/categories/categories.service', () => ({
  CATEGORIES_QUERY_KEY: ['categories'],
  getCategories: mocks.getCategories,
}))
vi.mock('@/utils/network-status', () => ({
  useNetworkStatus: () => ({ isOnline: mocks.isOnline }),
}))
vi.mock('vue-sonner', () => ({
  toast: { error: mocks.toastError },
}))

import type { Transaction } from '@/views/transactions/transactions.service'
import EditTransactionDialog from './EditTransactionDialog.vue'

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 7,
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

const categories = [
  { id: 'cat-food', name: 'Alimentação', type: 'expense' },
  { id: 'cat-home', name: 'Moradia', type: 'expense' },
  { id: 'cat-salary', name: 'Salário', type: 'income' },
]

const slotComponent = (name: string) =>
  defineComponent({
    name,
    setup(_props, { slots }) {
      return () => h('div', { 'data-stub': name }, slots.default?.())
    },
  })

const DialogStub = defineComponent({
  name: 'Dialog',
  props: { open: Boolean },
  emits: ['update:open'],
  setup(props, { slots }) {
    return () => (props.open ? h('div', { 'data-test': 'dialog' }, slots.default?.()) : null)
  },
})

const DialogContentStub = defineComponent({
  name: 'DialogContent',
  emits: ['closeAutoFocus'],
  setup(_props, { slots }) {
    return () => h('div', { 'data-test': 'dialog-content' }, slots.default?.())
  },
})

const TabsStub = defineComponent({
  name: 'Tabs',
  props: { modelValue: String },
  emits: ['update:modelValue'],
  setup(_props, { slots }) {
    return () => h('div', { 'data-test': 'tabs' }, slots.default?.())
  },
})

const TabsTriggerStub = defineComponent({
  name: 'TabsTrigger',
  props: { value: String },
  setup(props, { slots }) {
    return () =>
      h('button', { type: 'button', 'data-value': props.value }, slots.default?.())
  },
})

const SelectStub = defineComponent({
  name: 'Select',
  props: { modelValue: String, disabled: Boolean },
  emits: ['update:modelValue'],
  setup(_props, { slots }) {
    return () => h('div', { 'data-test': 'select' }, slots.default?.())
  },
})

const SelectValueStub = defineComponent({
  name: 'SelectValue',
  props: { placeholder: String },
  setup(props) {
    return () => h('span', props.placeholder)
  },
})

function createQuery(data: typeof categories | null = categories) {
  const query = {
    data: ref<typeof categories | null>(data),
    isPending: ref(false),
    isError: ref(false),
    refetch: mocks.refetch,
  }
  mocks.useQuery.mockReset()
  mocks.useQuery.mockReturnValue(query)
  return query
}

function mountDialog(options: {
  open?: boolean
  transaction?: Transaction | null
  saving?: boolean
  serverError?: string
} = {}) {
  return mount(EditTransactionDialog, {
    attachTo: document.body,
    props: {
      open: options.open ?? true,
      transaction: options.transaction ?? createTransaction(),
      saving: options.saving ?? false,
      serverError: options.serverError ?? '',
    },
    global: {
      stubs: {
        Dialog: DialogStub,
        DialogContent: DialogContentStub,
        DialogHeader: slotComponent('DialogHeader'),
        DialogTitle: slotComponent('DialogTitle'),
        DialogDescription: slotComponent('DialogDescription'),
        DialogFooter: slotComponent('DialogFooter'),
        Tabs: TabsStub,
        TabsList: slotComponent('TabsList'),
        TabsTrigger: TabsTriggerStub,
        Select: SelectStub,
        SelectTrigger: slotComponent('SelectTrigger'),
        SelectContent: slotComponent('SelectContent'),
        SelectValue: SelectValueStub,
        SelectItem: slotComponent('SelectItem'),
      },
    },
  })
}

async function openWithTransaction(wrapper: ReturnType<typeof mountDialog>) {
  await wrapper.setProps({ open: true })
  await nextTick()
}

describe('EditTransactionDialog', () => {
  beforeEach(() => {
    mocks.isOnline = ref(true)
    mocks.refetch.mockResolvedValue(undefined)
    createQuery()
  })

  it('preenche o formulário com a transação ao abrir', async () => {
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)

    expect((wrapper.get('#edit-transaction-amount').element as HTMLInputElement).value).toBe(
      '486,30',
    )
    expect(
      (wrapper.get('#edit-transaction-description').element as HTMLInputElement).value,
    ).toBe('Mercado do mês')
    expect((wrapper.get('#edit-transaction-date').element as HTMLInputElement).value).toBe(
      '2026-11-09',
    )
    expect(wrapper.findComponent(SelectStub).props('modelValue')).toBe('cat-food')
    expect(wrapper.text()).toContain('9 de novembro de 2026')
  })

  it('renderiza o alerta de erro do servidor', () => {
    const wrapper = mountDialog({ serverError: 'Não foi possível salvar.' })

    expect(wrapper.get('[role="alert"]').text()).toContain('Não foi possível salvar.')
  })

  it('emite o payload salvo com os dados do formulário', async () => {
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('saved')).toEqual([
      [
        {
          type: 'expense',
          amount: 486.3,
          description: 'Mercado do mês',
          category: 'cat-food',
          date: '2026-11-09',
        },
      ],
    ])
  })

  it('valida os campos e foca o primeiro inválido', async () => {
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)

    await wrapper.get('#edit-transaction-amount').setValue('')
    await wrapper.get('#edit-transaction-description').setValue('')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.text()).toContain('Informe o valor.')
    expect(wrapper.text()).toContain('Informe uma descrição.')
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(document.activeElement?.id).toBe('edit-transaction-amount')
  })

  it('valida a descrição ao sair do campo', async () => {
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)

    await wrapper.get('#edit-transaction-description').setValue('')
    await wrapper.get('#edit-transaction-description').trigger('blur')

    expect(wrapper.text()).toContain('Informe uma descrição.')
  })

  it('não salva enquanto a requisição está em andamento', async () => {
    const wrapper = mountDialog({ open: false, saving: true })
    await openWithTransaction(wrapper)

    expect(wrapper.get('button[type="submit"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.text()).toContain('Salvando…')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('não salva offline e avisa', async () => {
    mocks.isOnline!.value = false
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)

    await wrapper.get('form').trigger('submit')

    expect(mocks.toastError).toHaveBeenCalledWith(
      'Você está offline. Conecte-se para salvar alterações.',
    )
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.text()).toContain('Você está offline. Conecte-se para salvar ou excluir.')
  })

  it('emite a exclusão pelo botão', async () => {
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)

    const remove = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Excluir'))
    await remove!.trigger('click')

    expect(wrapper.emitted('deleted')).toHaveLength(1)
  })

  it('não exclui offline', async () => {
    mocks.isOnline!.value = false
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)

    const remove = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Excluir'))
    expect(remove?.attributes('disabled')).toBeDefined()
    await remove!.trigger('click')

    expect(wrapper.emitted('deleted')).toBeUndefined()
  })

  it('troca o tipo e escolhe uma categoria compatível', async () => {
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)

    wrapper.findComponent(TabsStub).vm.$emit('update:modelValue', 'income')
    await nextTick()

    expect(wrapper.findComponent(SelectStub).props('modelValue')).toBe('cat-salary')
  })

  it('atualiza a categoria selecionada', async () => {
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)

    wrapper.findComponent(SelectStub).vm.$emit('update:modelValue', 'cat-home')
    await nextTick()

    expect(wrapper.findComponent(SelectStub).props('modelValue')).toBe('cat-home')
  })

  it('explica quando as categorias do tipo estão vazias', async () => {
    createQuery([])
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)

    expect(wrapper.text()).toContain('Nenhuma categoria de despesa')
    expect(wrapper.text()).toContain('Você ainda não tem categorias de despesa.')
    expect(wrapper.get('a').text()).toBe('Criar categoria')
  })

  it('mostra o erro de categorias e tenta novamente', async () => {
    const query = createQuery(null)
    query.isError.value = true
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)

    expect(wrapper.text()).toContain('Categorias indisponíveis')
    expect(wrapper.text()).toContain('Não foi possível carregar as categorias.')

    const retry = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Tentar novamente'))
    await retry!.trigger('click')

    expect(mocks.refetch).toHaveBeenCalledOnce()
  })

  it('bloqueia o fechamento durante o salvamento', async () => {
    const wrapper = mountDialog({ open: false, saving: true })
    await openWithTransaction(wrapper)

    wrapper.findComponent(DialogStub).vm.$emit('update:open', false)
    expect(wrapper.emitted('update:open')).toBeUndefined()

    await wrapper.setProps({ saving: false })
    wrapper.findComponent(DialogStub).vm.$emit('update:open', false)
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('repassa o pedido de foco ao fechar', () => {
    const wrapper = mountDialog()
    const event = new Event('focus')

    wrapper.findComponent(DialogContentStub).vm.$emit('closeAutoFocus', event)

    expect(wrapper.emitted('closeAutoFocus')).toEqual([[event]])
  })

  it('abre o seletor de data nativo', async () => {
    const showPicker = vi.fn()
    const wrapper = mountDialog({ open: false })
    await openWithTransaction(wrapper)
    const input = wrapper.get('#edit-transaction-date').element as HTMLInputElement
    input.showPicker = showPicker

    await wrapper.get('#edit-transaction-date').element.parentElement!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )

    expect(showPicker).toHaveBeenCalledOnce()
  })
})
