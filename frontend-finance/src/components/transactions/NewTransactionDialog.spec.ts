import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  controller: null as null | Record<string, unknown>,
  isOnline: null as null | { value: boolean },
  toastError: vi.fn(),
}))

vi.mock('./new-transaction.controller', () => ({
  useNewTransactionController: () => mocks.controller,
}))
vi.mock('@/utils/network-status', () => ({
  useNetworkStatus: () => ({ isOnline: mocks.isOnline }),
}))
vi.mock('vue-sonner', () => ({
  toast: { error: mocks.toastError },
}))

import NewTransactionDialog from './NewTransactionDialog.vue'

function createController() {
  return {
    form: reactive({
      type: 'expense',
      amount: '',
      description: '',
      category: 'cat-food',
      date: '2026-11-09',
    }),
    categories: ref([
      { id: 'cat-food', name: 'Alimentação', type: 'expense' },
      { id: 'cat-home', name: 'Moradia', type: 'expense' },
    ]),
    submitLabel: ref('Salvar despesa'),
    error: ref(''),
    setType: vi.fn(),
    reset: vi.fn(),
    normalizeAmount: vi.fn(),
    buildPayload: vi.fn(),
    formatLongDate: vi.fn((value: string) => `data:${value}`),
  }
}

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
  props: { modelValue: String },
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

function mountDialog(open = true) {
  return mount(NewTransactionDialog, {
    props: { open },
    global: {
      stubs: {
        Dialog: DialogStub,
        DialogContent: slotComponent('DialogContent'),
        DialogHeader: slotComponent('DialogHeader'),
        DialogTitle: slotComponent('DialogTitle'),
        DialogDescription: slotComponent('DialogDescription'),
        DialogFooter: slotComponent('DialogFooter'),
        DialogClose: slotComponent('DialogClose'),
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

describe('NewTransactionDialog', () => {
  let controller: ReturnType<typeof createController>

  beforeEach(() => {
    controller = createController()
    mocks.controller = controller as unknown as Record<string, unknown>
    mocks.isOnline = ref(true)
    controller.buildPayload.mockReturnValue({
      type: 'expense',
      amount: 49.9,
      description: 'Café',
      category: 'cat-food',
      date: '2026-11-09',
    })
  })

  it('renderiza o formulário quando aberto', () => {
    const wrapper = mountDialog()

    expect(wrapper.get('[data-test="dialog"]').text()).toContain('Nova transação')
    expect(wrapper.text()).toContain('Registre uma entrada ou uma despesa.')
    expect(wrapper.get('#new-transaction-amount').attributes('placeholder')).toBe('0,00')
    expect(wrapper.get('#new-transaction-description')).toBeDefined()
    expect(wrapper.get('#new-transaction-date').attributes('type')).toBe('date')
    expect(wrapper.text()).toContain('data:2026-11-09')
    expect(wrapper.text()).toContain('Salvar despesa')
  })

  it('não renderiza o conteúdo quando fechado', () => {
    const wrapper = mountDialog(false)

    expect(wrapper.find('[data-test="dialog"]').exists()).toBe(false)
  })

  it('faz o bind dos campos do formulário', async () => {
    const wrapper = mountDialog()

    await wrapper.get('#new-transaction-amount').setValue('49,90')
    await wrapper.get('#new-transaction-description').setValue('Café')
    await wrapper.get('#new-transaction-date').setValue('2026-11-10')

    expect(controller.form.amount).toBe('49,90')
    expect(controller.form.description).toBe('Café')
    expect(controller.form.date).toBe('2026-11-10')
  })

  it('normaliza o valor ao sair do campo', async () => {
    const wrapper = mountDialog()

    await wrapper.get('#new-transaction-amount').trigger('blur')

    expect(controller.normalizeAmount).toHaveBeenCalledOnce()
  })

  it('troca o tipo pela aba', async () => {
    const wrapper = mountDialog()

    wrapper.findComponent(TabsStub).vm.$emit('update:modelValue', 'income')

    expect(controller.setType).toHaveBeenCalledWith('income')
  })

  it('reseta o formulário ao abrir', async () => {
    const wrapper = mountDialog(false)

    await wrapper.setProps({ open: true })

    expect(controller.reset).toHaveBeenCalledOnce()
  })

  it('emite a transação criada e fecha o diálogo', async () => {
    const wrapper = mountDialog()

    await wrapper.get('form').trigger('submit')

    expect(controller.buildPayload).toHaveBeenCalledOnce()
    expect(wrapper.emitted('created')).toEqual([
      [
        {
          type: 'expense',
          amount: 49.9,
          description: 'Café',
          category: 'cat-food',
          date: '2026-11-09',
        },
      ],
    ])
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('não emite quando o payload é inválido', async () => {
    controller.buildPayload.mockReturnValue(null)
    const wrapper = mountDialog()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('created')).toBeUndefined()
  })

  it('não envia offline e avisa', async () => {
    mocks.isOnline!.value = false
    const wrapper = mountDialog()
    await nextTick()

    await wrapper.get('form').trigger('submit')

    expect(mocks.toastError).toHaveBeenCalledWith(
      'Você está offline. Conecte-se para salvar alterações.',
    )
    expect(controller.buildPayload).not.toHaveBeenCalled()
    expect(wrapper.emitted('created')).toBeUndefined()
  })

  it('exibe o erro de validação do formulário', async () => {
    controller.error.value = 'Informe uma descrição.'
    const wrapper = mountDialog()
    await nextTick()

    expect(wrapper.get('[role="alert"]').text()).toBe('Informe uma descrição.')
  })

  it('desabilita o envio offline e usa o rótulo do tipo', async () => {
    mocks.isOnline!.value = false
    controller.submitLabel.value = 'Salvar entrada'
    const wrapper = mountDialog()
    await nextTick()

    const submit = wrapper.get('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(submit.text()).toBe('Salvar entrada')
  })

  it('abre o seletor de data nativo ao clicar no campo', async () => {
    const showPicker = vi.fn()
    const wrapper = mountDialog()
    const input = wrapper.get('#new-transaction-date').element as HTMLInputElement
    input.showPicker = showPicker

    await wrapper.get('#new-transaction-date').element.parentElement!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )

    expect(showPicker).toHaveBeenCalledOnce()
  })
})
