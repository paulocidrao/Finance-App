import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  signin: vi.fn(),
  push: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  isOnline: { value: true },
}))

vi.mock('./signin.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./signin.service')>()
  return { ...actual, signin: mocks.signin }
})
vi.mock('@/router', () => ({ default: { push: mocks.push } }))
vi.mock('@/utils/network-status', () => ({
  useNetworkStatus: () => ({ isOnline: mocks.isOnline }),
}))
vi.mock('vue-sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

import { SIGNIN_FIELD_IDS, SIGNIN_SUBMIT_ID, useSigninController } from './signin.controller'
import { SigninError } from './signin.service'

function mountFocusableFields(): void {
  document.body.innerHTML = `
    <input id="${SIGNIN_FIELD_IDS.name}" />
    <input id="${SIGNIN_FIELD_IDS.email}" />
    <input id="${SIGNIN_FIELD_IDS.password}" />
    <input id="${SIGNIN_FIELD_IDS.passwordConfirmation}" />
    <button id="${SIGNIN_SUBMIT_ID}"></button>
  `
}

function fillValidForm(controller: ReturnType<typeof useSigninController>): void {
  controller.form.name = 'Maria Silva'
  controller.form.email = 'maria@exemplo.com'
  controller.form.password = 'segredo123'
  controller.form.passwordConfirmation = 'segredo123'
}

describe('useSigninController', () => {
  beforeEach(() => {
    mocks.isOnline.value = true
    mocks.signin.mockResolvedValue({ id: '1', name: 'Maria Silva', email: 'maria@exemplo.com' })
    mocks.push.mockResolvedValue(undefined)
    mountFocusableFields()
  })

  it('começa com o formulário vazio', () => {
    const controller = useSigninController()

    expect(controller.form).toEqual({
      name: '',
      email: '',
      password: '',
      passwordConfirmation: '',
    })
    expect(controller.errors).toEqual({})
    expect(controller.backendError.value).toBe('')
    expect(controller.isSubmitting.value).toBe(false)
  })

  it('valida cada campo após o blur', () => {
    const controller = useSigninController()

    controller.handleBlur('name')
    controller.handleBlur('email')
    controller.handleBlur('password')
    controller.handleBlur('passwordConfirmation')

    expect(controller.errors.name).toBe('Informe seu nome.')
    expect(controller.errors.email).toBe('Informe seu e-mail.')
    expect(controller.errors.password).toBe('Crie uma senha.')
    expect(controller.errors.passwordConfirmation).toBe('Confirme sua senha.')
  })

  it('valida as regras de tamanho e o formato do e-mail', async () => {
    const controller = useSigninController()

    controller.form.name = 'A'
    controller.form.email = 'invalido'
    controller.form.password = '123'
    controller.handleBlur('name')
    controller.handleBlur('email')
    controller.handleBlur('password')
    await nextTick()

    expect(controller.errors.name).toBe('O nome deve ter pelo menos 2 caracteres.')
    expect(controller.errors.email).toBe(
      'Informe um e-mail válido, como nome@exemplo.com.',
    )
    expect(controller.errors.password).toBe('A senha deve ter pelo menos 8 caracteres.')
  })

  it('revalida a confirmação quando a senha muda', async () => {
    const controller = useSigninController()
    controller.form.password = 'segredo123'
    controller.form.passwordConfirmation = 'segredo123'
    controller.handleBlur('password')
    controller.handleBlur('passwordConfirmation')
    expect(controller.errors.passwordConfirmation).toBeUndefined()

    controller.form.password = 'outra-senha'
    await nextTick()

    expect(controller.errors.passwordConfirmation).toBe('As senhas não coincidem.')

    controller.form.password = 'segredo123'
    await nextTick()
    expect(controller.errors.passwordConfirmation).toBeUndefined()
  })

  it('não envia quando está offline', async () => {
    mocks.isOnline.value = false
    const controller = useSigninController()
    fillValidForm(controller)

    await controller.handleSubmit()

    expect(mocks.toastError).toHaveBeenCalledWith(
      'Você está offline. Conecte-se para salvar alterações.',
    )
    expect(mocks.signin).not.toHaveBeenCalled()
  })

  it('foca o primeiro campo inválido e não envia', async () => {
    const controller = useSigninController()

    await controller.handleSubmit()

    expect(mocks.signin).not.toHaveBeenCalled()
    expect(document.activeElement?.id).toBe(SIGNIN_FIELD_IDS.name)
  })

  it('cria a conta, mostra o aviso e vai para o login', async () => {
    const controller = useSigninController()
    fillValidForm(controller)
    controller.form.name = '  Maria Silva  '
    controller.form.email = '  maria@exemplo.com  '

    await controller.handleSubmit()

    expect(mocks.signin).toHaveBeenCalledWith({
      name: 'Maria Silva',
      email: 'maria@exemplo.com',
      password: 'segredo123',
    })
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Conta criada', {
      description: 'Agora é só entrar com seu e-mail e senha.',
    })
    expect(mocks.push).toHaveBeenCalledWith({ name: 'login' })
    expect(controller.isSubmitting.value).toBe(false)
  })

  it('mantém o erro de e-mail duplicado até o endereço mudar', async () => {
    mocks.signin.mockRejectedValue(
      new SigninError('Este e-mail já está cadastrado.', 'conflict'),
    )
    const controller = useSigninController()
    fillValidForm(controller)

    await controller.handleSubmit()

    expect(controller.errors.email).toBe('Este e-mail já está cadastrado.')
    expect(document.activeElement?.id).toBe(SIGNIN_FIELD_IDS.email)
    expect(mocks.push).not.toHaveBeenCalled()

    controller.form.email = 'outra@exemplo.com'
    await nextTick()
    expect(controller.errors.email).toBeUndefined()
  })

  it('exibe o erro de validação devolvido pela API', async () => {
    mocks.signin.mockRejectedValue(
      new SigninError('Dados inválidos.', 'validation'),
    )
    const controller = useSigninController()
    fillValidForm(controller)

    await controller.handleSubmit()

    expect(controller.backendError.value).toBe('Dados inválidos.')
    expect(document.activeElement?.id).toBe(SIGNIN_SUBMIT_ID)
  })

  it('usa mensagem genérica para erros desconhecidos', async () => {
    mocks.signin.mockRejectedValue(new Error('falha'))
    const controller = useSigninController()
    fillValidForm(controller)

    await controller.handleSubmit()

    expect(controller.backendError.value).toBe(
      'Não foi possível criar a conta agora. Tente novamente em instantes.',
    )
  })

  it('ignora envios concorrentes', async () => {
    let resolveSignin!: (value: unknown) => void
    mocks.signin.mockReturnValue(
      new Promise((resolve) => {
        resolveSignin = resolve
      }),
    )
    const controller = useSigninController()
    fillValidForm(controller)

    const firstSubmit = controller.handleSubmit()
    await nextTick()
    await controller.handleSubmit()

    expect(mocks.signin).toHaveBeenCalledOnce()

    resolveSignin({ id: '1' })
    await firstSubmit
  })

  it('alterna a visibilidade da senha', () => {
    const controller = useSigninController()

    controller.togglePasswordVisibility()
    expect(controller.isPasswordVisible.value).toBe(true)

    controller.togglePasswordVisibility()
    expect(controller.isPasswordVisible.value).toBe(false)
  })
})
