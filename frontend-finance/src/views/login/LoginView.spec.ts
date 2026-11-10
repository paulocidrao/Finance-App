import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  controller: null as null | Record<string, unknown>,
}))

vi.mock('./login.controller', () => ({
  LOGIN_FIELD_IDS: { email: 'login-email', password: 'login-password' },
  LOGIN_SUBMIT_ID: 'login-submit',
  useLoginController: () => mocks.controller,
}))

import LoginView from './LoginView.vue'

type ControllerMock = {
  isOnline: ReturnType<typeof ref<boolean>>
  form: { email: string; password: string }
  errors: { email?: string; password?: string }
  backendError: ReturnType<typeof ref<string>>
  isSubmitting: ReturnType<typeof ref<boolean>>
  isPasswordVisible: ReturnType<typeof ref<boolean>>
  handleBlur: ReturnType<typeof vi.fn>
  handleSubmit: ReturnType<typeof vi.fn>
  togglePasswordVisibility: ReturnType<typeof vi.fn>
}

function createController(): ControllerMock {
  return {
    isOnline: ref(true),
    form: reactive({ email: '', password: '' }),
    errors: reactive<{ email?: string; password?: string }>({}),
    backendError: ref(''),
    isSubmitting: ref(false),
    isPasswordVisible: ref(false),
    handleBlur: vi.fn(),
    handleSubmit: vi.fn(),
    togglePasswordVisibility: vi.fn(),
  }
}

function mountView() {
  return mount(LoginView)
}

describe('LoginView', () => {
  let controller: ControllerMock

  beforeEach(() => {
    controller = createController()
    mocks.controller = controller as unknown as Record<string, unknown>
  })

  it('renderiza o formulário de login acessível', () => {
    const wrapper = mountView()

    expect(wrapper.get('h2').text()).toBe('Bem-vindo de volta')
    expect(wrapper.get('form').attributes('novalidate')).toBeDefined()
    expect(wrapper.get('#login-email').attributes('type')).toBe('email')
    expect(wrapper.get('#login-password').attributes('type')).toBe('password')
    expect(wrapper.get('#login-submit').text()).toContain('Entrar')
    expect(wrapper.text()).toContain('Ainda não tem conta?')
    expect(wrapper.get('a').text()).toBe('Criar conta')
  })

  it('faz o bind do formulário e chama o controller ao sair dos campos', async () => {
    const wrapper = mountView()

    await wrapper.get('#login-email').setValue('nome@exemplo.com')
    await wrapper.get('#login-password').setValue('segredo')
    await wrapper.get('#login-email').trigger('blur')
    await wrapper.get('#login-password').trigger('blur')

    expect(controller.form.email).toBe('nome@exemplo.com')
    expect(controller.form.password).toBe('segredo')
    expect(controller.handleBlur).toHaveBeenNthCalledWith(1, 'email')
    expect(controller.handleBlur).toHaveBeenNthCalledWith(2, 'password')
  })

  it('envia o formulário pelo submit', async () => {
    const wrapper = mountView()

    expect(wrapper.get('#login-submit').attributes('type')).toBe('submit')

    await wrapper.get('form').trigger('submit')
    expect(controller.handleSubmit).toHaveBeenCalledOnce()
  })

  it('exibe os erros de validação e associa cada um ao campo', async () => {
    const wrapper = mountView()
    controller.errors.email = 'Informe seu e-mail.'
    controller.errors.password = 'Informe sua senha.'
    await nextTick()

    expect(wrapper.text()).toContain('Informe seu e-mail.')
    expect(wrapper.text()).toContain('Informe sua senha.')
    expect(wrapper.get('#login-email').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#login-email').attributes('aria-describedby')).toBe(
      'login-email-error',
    )
    expect(wrapper.get('#login-password').attributes('aria-invalid')).toBe('true')
  })

  it('exibe o erro do backend em um alerta', async () => {
    const wrapper = mountView()
    controller.backendError.value = 'E-mail ou senha inválidos.'
    await nextTick()

    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('E-mail ou senha inválidos.')
    expect(alert.attributes('aria-live')).toBe('assertive')
  })

  it('alterna a visibilidade da senha pelo botão', async () => {
    const wrapper = mountView()

    const toggle = wrapper.get('button[aria-label="Mostrar senha"]')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('#login-password').attributes('type')).toBe('password')

    await toggle.trigger('click')
    expect(controller.togglePasswordVisibility).toHaveBeenCalledOnce()

    controller.isPasswordVisible.value = true
    await nextTick()

    expect(wrapper.get('button[aria-label="Ocultar senha"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(wrapper.get('#login-password').attributes('type')).toBe('text')
  })

  it('desabilita o envio offline ou enquanto está enviando', async () => {
    const wrapper = mountView()

    controller.isOnline.value = false
    await nextTick()
    expect(wrapper.get('#login-submit').attributes('disabled')).toBeDefined()
    expect(wrapper.get('form').attributes('aria-busy')).toBe('false')

    controller.isOnline.value = true
    controller.isSubmitting.value = true
    await nextTick()

    expect(wrapper.get('#login-submit').attributes('disabled')).toBeDefined()
    expect(wrapper.get('form').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('#login-submit').text()).toContain('Entrando…')
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
  })
})
