import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  controller: null as null | Record<string, unknown>,
}))

vi.mock('./user.controller', () => ({
  useUserController: () => mocks.controller,
}))

import UserView from './UserView.vue'

type Profile = {
  name: string
  email: string
  initials: string
  memberSince: string
}

function createController() {
  const logout = vi.fn()
  return {
    profile: ref<Profile>({
      name: 'Maria Silva',
      email: 'maria@exemplo.com',
      initials: 'MS',
      memberSince: '2025-03-14',
    }),
    details: ref([
      { label: 'Nome', value: 'Maria Silva' },
      { label: 'E-mail', value: 'maria@exemplo.com' },
      { label: 'Membro desde', value: '14/03/2025' },
    ]),
    viewState: ref('ready'),
    isProfileLoading: ref(false),
    profileError: ref(null),
    isLoggingOut: ref(false),
    retry: vi.fn(),
    logout,
  }
}

const slotComponent = (name: string) =>
  defineComponent({
    name,
    setup(_props, { slots }) {
      return () => h('div', { 'data-stub': name }, slots.default?.())
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
  return mount(UserView, {
    global: {
      stubs: {
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

describe('UserView', () => {
  let controller: ReturnType<typeof createController>

  beforeEach(() => {
    controller = createController()
    mocks.controller = controller as unknown as Record<string, unknown>
  })

  it('renderiza os dados do perfil', () => {
    const wrapper = mountView()

    expect(wrapper.get('h1').text()).toBe('Perfil')
    expect(wrapper.text()).toContain('Maria Silva')
    expect(wrapper.text()).toContain('maria@exemplo.com')
    expect(wrapper.text()).toContain('MS')
    expect(wrapper.text()).toContain('Membro desde')
    expect(wrapper.text()).toContain('14/03/2025')
    expect(wrapper.text()).toContain('Sair da conta')
  })

  it('renderiza o esqueleto de carregamento', async () => {
    controller.viewState.value = 'loading'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.get('[aria-label="Carregando perfil"]').attributes('aria-busy')).toBe(
      'true',
    )
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('mostra o erro e tenta carregar novamente', async () => {
    controller.viewState.value = 'error'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Não foi possível carregar o perfil')
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Tentar novamente'))
    await retry!.trigger('click')

    expect(controller.retry).toHaveBeenCalledOnce()
  })

  it('mostra o estado vazio e atualiza o perfil', async () => {
    controller.viewState.value = 'empty'
    const wrapper = mountView()
    await nextTick()

    expect(wrapper.text()).toContain('Perfil sem dados')
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Atualizar perfil'))
    await retry!.trigger('click')

    expect(controller.retry).toHaveBeenCalledOnce()
  })

  it('abre o diálogo de confirmação e encerra a sessão', async () => {
    controller.logout.mockResolvedValue(true)
    const wrapper = mountView()

    const trigger = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Sair da conta'))
    await trigger!.trigger('click')
    await nextTick()

    expect(wrapper.get('[data-test="alert-dialog"]').text()).toContain('Encerrar sessão?')

    const confirm = wrapper
      .findAll('button')
      .filter((button) => button.text().includes('Sair da conta'))
      .at(-1)
    await confirm!.trigger('click')
    await flushPromises()

    expect(controller.logout).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-test="alert-dialog"]').exists()).toBe(false)
  })

  it('mantém o diálogo aberto quando o logout falha', async () => {
    controller.logout.mockResolvedValue(false)
    const wrapper = mountView()

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Sair da conta'))!
      .trigger('click')
    await nextTick()

    const confirm = wrapper
      .findAll('button')
      .filter((button) => button.text().includes('Sair da conta'))
      .at(-1)
    await confirm!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="alert-dialog"]').exists()).toBe(true)
  })

  it('desabilita o botão de sair durante o encerramento', async () => {
    controller.isLoggingOut.value = true
    const wrapper = mountView()
    await nextTick()

    const trigger = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Sair da conta'))
    expect(trigger?.attributes('disabled')).toBeDefined()
  })
})
