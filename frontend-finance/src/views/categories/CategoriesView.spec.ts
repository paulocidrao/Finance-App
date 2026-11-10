import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  controller: null as null | Record<string, unknown>,
}))

vi.mock('./categories.controller', () => ({
  CATEGORIES_PAGE_SIZE: 8,
  CATEGORY_DELETE_ACK_ID: 'category-delete-ack',
  CATEGORY_NAME_ID: 'category-name',
  CATEGORY_SEARCH_ID: 'category-search',
  useCategoriesController: () => mocks.controller,
}))

import CategoriesView from './CategoriesView.vue'

type Category = {
  id: string
  userId: string
  name: string
  type: 'expense' | 'income'
  transactionCount: number
  createdAt: string
  updatedAt: string
}

function createCategory(overrides: Partial<Category> = {}): Category {
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
  createCategory({ id: '1', name: 'Mercado', type: 'expense' }),
  createCategory({ id: '2', name: 'Salário', type: 'income' }),
  createCategory({ id: '3', name: 'Lazer', type: 'expense' }),
]

function createController() {
  return {
    isOnline: ref(true),
    search: ref(''),
    typeFilter: ref('all'),
    page: ref(1),
    categories: ref(categories),
    total: ref(3),
    totalPages: ref(1),
    viewState: ref('ready'),
    isRefreshing: ref(false),
    rangeLabel: ref('Mostrando 1–3 de 3 categorias'),
    statusMessage: ref('3 categorias encontradas.'),
    setTypeFilter: vi.fn(),
    clearFilters: vi.fn(),
    retry: vi.fn(),
    isFormOpen: ref(false),
    isEditing: ref(false),
    form: reactive({ name: '', type: 'expense' }),
    errors: reactive<{ name?: string }>({}),
    nameLength: ref(0),
    submitError: ref(''),
    isSubmitting: ref(false),
    openCreateCategory: vi.fn(),
    openEditCategory: vi.fn(),
    handleNameBlur: vi.fn(),
    setFormType: vi.fn(),
    submitCategory: vi.fn(),
    isDeleteDialogOpen: ref(false),
    categoryPendingDelete: ref<Category | null>(null),
    isDeleteBlocked: ref(false),
    blockedDeleteMessage: ref(''),
    isDeleting: ref(false),
    deleteError: ref(''),
    requestDeleteCategory: vi.fn(),
    confirmDeleteCategory: vi.fn(),
    handleDeleteDialogCloseAutoFocus: vi.fn(),
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

const AlertDialogStub = defineComponent({
  name: 'AlertDialog',
  props: { open: Boolean },
  emits: ['update:open'],
  setup(props, { slots }) {
    return () =>
      props.open ? h('div', { 'data-test': 'alert-dialog' }, slots.default?.()) : null
  },
})

function mountView() {
  return mount(CategoriesView, {
    global: {
      stubs: {
        Dialog: DialogStub,
        DialogContent: slotComponent('DialogContent'),
        DialogHeader: slotComponent('DialogHeader'),
        DialogTitle: slotComponent('DialogTitle'),
        DialogDescription: slotComponent('DialogDescription'),
        DialogFooter: slotComponent('DialogFooter'),
        DialogClose: slotComponent('DialogClose'),
        AlertDialog: AlertDialogStub,
        AlertDialogContent: slotComponent('AlertDialogContent'),
        AlertDialogHeader: slotComponent('AlertDialogHeader'),
        AlertDialogTitle: slotComponent('AlertDialogTitle'),
        AlertDialogDescription: slotComponent('AlertDialogDescription'),
        AlertDialogFooter: slotComponent('AlertDialogFooter'),
        AlertDialogCancel: defineComponent({
          name: 'AlertDialogCancel',
          setup(_props, { slots, attrs }) {
            return () => h('button', attrs, slots.default?.())
          },
        }),
      },
    },
  })
}

describe('CategoriesView', () => {
  let controller: ReturnType<typeof createController>

  beforeEach(() => {
    controller = createController()
    mocks.controller = controller as unknown as Record<string, unknown>
  })

  it('renderiza o cabeçalho, a busca e a lista', () => {
    const wrapper = mountView()

    expect(wrapper.get('h1').text()).toBe('Categorias')
    expect(wrapper.get('#category-search').attributes('placeholder')).toBe(
      'Buscar pelo nome',
    )
    expect(wrapper.text()).toContain('Mercado')
    expect(wrapper.text()).toContain('Salário')
    expect(wrapper.text()).toContain('Lazer')
    expect(wrapper.text()).toContain('Despesa')
    expect(wrapper.text()).toContain('Entrada')
    expect(wrapper.text()).toContain('Mostrando 1–3 de 3 categorias')
  })

  it('expõe o status para leitores de tela', () => {
    const wrapper = mountView()

    const status = wrapper.get('[role="status"]')
    expect(status.text()).toBe('3 categorias encontradas.')
    expect(status.attributes('aria-live')).toBe('polite')
  })

  it('faz o bind da busca e limpa com Escape', async () => {
    const wrapper = mountView()
    const input = wrapper.get('#category-search')

    await input.setValue('mercado')
    expect(controller.search.value).toBe('mercado')

    await input.trigger('keydown', { key: 'Escape' })
    expect(controller.search.value).toBe('')
  })

  it('atualiza o filtro de tipo', () => {
    const wrapper = mountView()
    const toggle = wrapper.findComponent({ name: 'ToggleGroup' })

    toggle.vm.$emit('update:modelValue', 'income')

    expect(controller.setTypeFilter).toHaveBeenCalledWith('income')
  })

  it('abre a criação de categoria', async () => {
    const wrapper = mountView()

    const create = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Nova categoria'))
    await create!.trigger('click')

    expect(controller.openCreateCategory).toHaveBeenCalledOnce()
  })

  it('renderiza esqueletos no carregamento', async () => {
    controller.viewState.value = 'loading'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.get('ul').attributes('aria-busy')).toBe('true')
    expect(wrapper.findAll('li')).toHaveLength(8)
  })

  it('mostra o erro e tenta novamente', async () => {
    controller.viewState.value = 'error'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Não foi possível carregar as categorias')
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Tentar novamente'))
    await retry!.trigger('click')

    expect(controller.retry).toHaveBeenCalledOnce()
  })

  it('mostra o estado vazio e cria a primeira categoria', async () => {
    controller.viewState.value = 'empty'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Nenhuma categoria ainda')
    const create = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Criar primeira categoria'))
    await create!.trigger('click')

    expect(controller.openCreateCategory).toHaveBeenCalledOnce()
  })

  it('mostra que os filtros não retornaram resultados e limpa', async () => {
    controller.viewState.value = 'no-results'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Nenhuma categoria encontrada')
    const clear = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Limpar filtros'))
    await clear!.trigger('click')

    expect(controller.clearFilters).toHaveBeenCalledOnce()
  })

  it('indica atualização em segundo plano', async () => {
    controller.isRefreshing.value = true
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Atualizando…')
    expect(wrapper.get('ul[role="list"]').classes()).toContain('opacity-60')
    expect(wrapper.get('ul[role="list"]').attributes('aria-busy')).toBe('true')
  })

  it('chama a edição e a exclusão de uma categoria da lista', async () => {
    const wrapper = mountView()
    const category = categories[0]
    const edit = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Editar Mercado'))
    const remove = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Excluir Mercado'))

    await edit!.trigger('click')
    expect(controller.openEditCategory).toHaveBeenCalledWith(category)

    await remove!.trigger('click')
    expect(controller.requestDeleteCategory).toHaveBeenCalledWith(category)
  })

  it('desabilita as ações quando está offline', async () => {
    controller.isOnline.value = false
    const wrapper = mountView()
    await nextTick()

    const edit = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Editar Mercado'))
    const remove = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Excluir Mercado'))

    expect(edit?.attributes('disabled')).toBeDefined()
    expect(remove?.attributes('disabled')).toBeDefined()
  })

  it('renderiza o formulário de criação e envia os dados', async () => {
    controller.isFormOpen.value = true
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.get('[data-test="dialog"]').text()).toContain('Nova categoria')
    expect(wrapper.get('#category-name').attributes('placeholder')).toBe('Ex.: Educação')
    expect(wrapper.text()).toContain('0/40')

    await wrapper.get('#category-name').setValue('Educação')
    expect(controller.form.name).toBe('Educação')

    await wrapper.get('form').trigger('submit')
    expect(controller.submitCategory).toHaveBeenCalledOnce()
  })

  it('renderiza erros e o contador de caracteres', async () => {
    controller.isFormOpen.value = true
    controller.errors.name = 'Informe o nome da categoria.'
    controller.nameLength.value = 41
    controller.submitError.value = 'Não foi possível salvar.'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Informe o nome da categoria.')
    expect(wrapper.text()).toContain('41/40')
    expect(wrapper.text()).toContain('Não foi possível salvar.')
  })

  it('mostra o título de edição e desabilita o tipo', async () => {
    controller.isFormOpen.value = true
    controller.isEditing.value = true
    controller.form.name = 'Mercado'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.get('[data-test="dialog"]').text()).toContain('Editar categoria')
    expect(wrapper.get('[data-test="dialog"]').text()).toContain(
      'O tipo não pode ser alterado',
    )
  })

  it('confirma a exclusão no diálogo', async () => {
    controller.isDeleteDialogOpen.value = true
    controller.categoryPendingDelete.value = categories[0]
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.get('[data-test="alert-dialog"]').text()).toContain('Excluir categoria?')
    expect(wrapper.text()).toContain('“Mercado” será removida.')

    const confirm = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Excluir')
    await confirm!.trigger('click')

    expect(controller.confirmDeleteCategory).toHaveBeenCalledOnce()
  })

  it('mostra o bloqueio de exclusão e o botão Entendi', async () => {
    controller.isDeleteDialogOpen.value = true
    controller.isDeleteBlocked.value = true
    controller.blockedDeleteMessage.value =
      '“Mercado” tem transações vinculadas. Mova ou exclua essas transações antes de excluir a categoria.'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.get('[data-test="alert-dialog"]').text()).toContain(
      'Não é possível excluir',
    )
    expect(wrapper.text()).toContain('tem transações vinculadas')
    expect(wrapper.get('#category-delete-ack').text()).toBe('Entendi')
  })

  it('mostra o erro de exclusão', async () => {
    controller.isDeleteDialogOpen.value = true
    controller.categoryPendingDelete.value = categories[0]
    controller.deleteError.value = 'Não foi possível excluir.'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.get('[role="alert"]').text()).toContain('Não foi possível excluir.')
  })
})
