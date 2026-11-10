import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  controller: null as null | Record<string, unknown>,
}))

vi.mock('./signin.controller', () => ({
  SIGNIN_FIELD_IDS: {
    name: 'signin-name',
    email: 'signin-email',
    password: 'signin-password',
    passwordConfirmation: 'signin-password-confirmation',
  },
  SIGNIN_SUBMIT_ID: 'signin-submit',
  useSigninController: () => mocks.controller,
}))

import SigninView from './SigninView.vue'

type FormErrors = Partial<Record<'name' | 'email' | 'password' | 'passwordConfirmation', string>>

type ControllerMock = {
  isOnline: ReturnType<typeof ref<boolean>>
  form: { name: string; email: string; password: string; passwordConfirmation: string }
  errors: FormErrors
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
    form: reactive({ name: '', email: '', password: '', passwordConfirmation: '' }),
    errors: reactive<FormErrors>({}),
    backendError: ref(''),
    isSubmitting: ref(false),
    isPasswordVisible: ref(false),
    handleBlur: vi.fn(),
    handleSubmit: vi.fn(),
    togglePasswordVisibility: vi.fn(),
  }
}

function mountView() {
  return mount(SigninView)
}

describe('SigninView', () => {
  let controller: ControllerMock

  beforeEach(() => {
    controller = createController()
    mocks.controller = controller as unknown as Record<string, unknown>
  })

  it('renderiza o formulário de criação de conta', () => {
    const wrapper = mountView()

    expect(wrapper.get('h2').text()).toBe('Criar conta')
    expect(wrapper.findAll('input')).toHaveLength(4)
    expect(wrapper.get('#signin-name').attributes('autocomplete')).toBe('name')
    expect(wrapper.get('#signin-email').attributes('type')).toBe('email')
    expect(wrapper.get('#signin-password').attributes('type')).toBe('password')
    expect(wrapper.get('#signin-password-confirmation').attributes('type')).toBe('password')
    expect(wrapper.text()).toContain('Mínimo de 8 caracteres.')
    expect(wrapper.get('#signin-submit').text()).toContain('Criar conta')
    expect(wrapper.text()).toContain('Já tem conta?')
  })

  it('faz o bind dos campos e chama o blur do controller', async () => {
    const wrapper = mountView()

    await wrapper.get('#signin-name').setValue('Maria Silva')
    await wrapper.get('#signin-email').setValue('maria@exemplo.com')
    await wrapper.get('#signin-password').setValue('segredo123')
    await wrapper.get('#signin-password-confirmation').setValue('segredo123')

    await wrapper.get('#signin-name').trigger('blur')
    await wrapper.get('#signin-email').trigger('blur')
    await wrapper.get('#signin-password').trigger('blur')
    await wrapper.get('#signin-password-confirmation').trigger('blur')

    expect(controller.form).toEqual({
      name: 'Maria Silva',
      email: 'maria@exemplo.com',
      password: 'segredo123',
      passwordConfirmation: 'segredo123',
    })
    expect(controller.handleBlur.mock.calls.map(([field]) => field)).toEqual([
      'name',
      'email',
      'password',
      'passwordConfirmation',
    ])
  })

  it('envia o formulário pelo submit', async () => {
    const wrapper = mountView()

    expect(wrapper.get('#signin-submit').attributes('type')).toBe('submit')
    await wrapper.get('form').trigger('submit')

    expect(controller.handleSubmit).toHaveBeenCalledOnce()
  })

  it('exibe os erros de validação em cada campo', async () => {
    const wrapper = mountView()
    controller.errors.name = 'Informe seu nome.'
    controller.errors.email = 'Informe seu e-mail.'
    controller.errors.password = 'Crie uma senha.'
    controller.errors.passwordConfirmation = 'As senhas não coincidem.'
    await nextTick()

    expect(wrapper.get('#signin-name').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#signin-email').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#signin-password').attributes('aria-invalid')).toBe('true')
    expect(
      wrapper.get('#signin-password-confirmation').attributes('aria-invalid'),
    ).toBe('true')
    expect(wrapper.text()).toContain('Informe seu nome.')
    expect(wrapper.text()).toContain('As senhas não coincidem.')
  })

  it('descreve o campo de senha com a dica e o erro', async () => {
    const wrapper = mountView()

    expect(wrapper.get('#signin-password').attributes('aria-describedby')).toBe(
      'signin-password-hint',
    )

    controller.errors.password = 'Crie uma senha.'
    await nextTick()

    expect(wrapper.get('#signin-password').attributes('aria-describedby')).toBe(
      'signin-password-hint signin-password-error',
    )
  })

  it('exibe o erro do backend', async () => {
    const wrapper = mountView()
    controller.backendError.value = 'Este e-mail já está cadastrado.'
    await nextTick()

    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Este e-mail já está cadastrado.')
    expect(alert.attributes('aria-live')).toBe('assertive')
  })

  it('alterna a visibilidade das duas senhas', async () => {
    const wrapper = mountView()

    await wrapper.get('button[aria-label="Mostrar senha"]').trigger('click')
    expect(controller.togglePasswordVisibility).toHaveBeenCalledOnce()

    controller.isPasswordVisible.value = true
    await nextTick()

    const toggle = wrapper.get('button[aria-label="Ocultar senha"]')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(toggle.attributes('aria-controls')).toBe(
      'signin-password signin-password-confirmation',
    )
    expect(wrapper.get('#signin-password').attributes('type')).toBe('text')
    expect(wrapper.get('#signin-password-confirmation').attributes('type')).toBe('text')
  })

  it('desabilita o formulário offline ou durante o envio', async () => {
    const wrapper = mountView()

    controller.isOnline.value = false
    await nextTick()
    expect(wrapper.get('#signin-submit').attributes('disabled')).toBeDefined()

    controller.isOnline.value = true
    controller.isSubmitting.value = true
    await nextTick()

    expect(wrapper.get('#signin-submit').attributes('disabled')).toBeDefined()
    expect(wrapper.get('#signin-submit').text()).toContain('Criando conta…')
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
  })
})
