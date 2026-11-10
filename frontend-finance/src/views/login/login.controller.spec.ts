import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  push: vi.fn(),
  startOfflineCacheSession: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  isOnline: { value: true },
}))

vi.mock('./login.service', () => ({ login: mocks.login }))
vi.mock('@/router', () => ({ default: { push: mocks.push } }))
vi.mock('@/utils/offline-cache', () => ({
  startOfflineCacheSession: mocks.startOfflineCacheSession,
}))
vi.mock('@/utils/network-status', () => ({
  useNetworkStatus: () => ({ isOnline: mocks.isOnline }),
}))
vi.mock('vue-sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

import { LOGIN_FIELD_IDS, LOGIN_SUBMIT_ID, useLoginController } from './login.controller'

function mountFocusableFields(): void {
  document.body.innerHTML = `
    <input id="${LOGIN_FIELD_IDS.email}" />
    <input id="${LOGIN_FIELD_IDS.password}" />
    <button id="${LOGIN_SUBMIT_ID}"></button>
  `
}

describe('useLoginController', () => {
  beforeEach(() => {
    mocks.isOnline.value = true
    mocks.login.mockResolvedValue({ data: {}, status: 200 })
    mocks.push.mockResolvedValue(undefined)
    mocks.startOfflineCacheSession.mockResolvedValue(undefined)
    mountFocusableFields()
  })

  it('começa com o formulário vazio e sem erros', () => {
    const controller = useLoginController()

    expect(controller.form).toEqual({ email: '', password: '' })
    expect(controller.errors).toEqual({})
    expect(controller.backendError.value).toBe('')
    expect(controller.isSubmitting.value).toBe(false)
    expect(controller.isPasswordVisible.value).toBe(false)
  })

  it('valida o e-mail após o blur e limpa o erro quando fica válido', async () => {
    const controller = useLoginController()

    controller.handleBlur('email')
    expect(controller.errors.email).toBe('Informe seu e-mail.')

    controller.form.email = 'invalido'
    await nextTick()
    expect(controller.errors.email).toBe('Informe um e-mail válido, como nome@exemplo.com.')

    controller.form.email = 'nome@exemplo.com'
    await nextTick()
    expect(controller.errors.email).toBeUndefined()
  })

  it('valida a senha após o blur', () => {
    const controller = useLoginController()

    controller.handleBlur('password')
    expect(controller.errors.password).toBe('Informe sua senha.')

    controller.form.password = '123456'
    controller.handleBlur('password')
    expect(controller.errors.password).toBeUndefined()
  })

  it('não envia quando está offline', async () => {
    mocks.isOnline.value = false
    const controller = useLoginController()
    controller.form.email = 'nome@exemplo.com'
    controller.form.password = 'segredo'

    await controller.handleSubmit()

    expect(mocks.toastError).toHaveBeenCalledWith(
      'Você está offline. Conecte-se para salvar alterações.',
    )
    expect(mocks.login).not.toHaveBeenCalled()
    expect(controller.isSubmitting.value).toBe(false)
  })

  it('marca todos os campos, não envia dados inválidos e foca o primeiro erro', async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus')
    const controller = useLoginController()

    await controller.handleSubmit()

    expect(controller.errors.email).toBe('Informe seu e-mail.')
    expect(controller.errors.password).toBe('Informe sua senha.')
    expect(mocks.login).not.toHaveBeenCalled()
    expect(focusSpy).toHaveBeenCalled()
    expect(document.activeElement?.id).toBe(LOGIN_FIELD_IDS.email)
  })

  it('normaliza o e-mail, cria a sessão offline e navega para a home', async () => {
    const controller = useLoginController()
    controller.form.email = '  Nome@Exemplo.COM '
    controller.form.password = 'segredo'

    await controller.handleSubmit()

    expect(mocks.login).toHaveBeenCalledWith({
      email: 'nome@exemplo.com',
      password: 'segredo',
    })
    expect(mocks.startOfflineCacheSession).toHaveBeenCalledOnce()
    expect(mocks.push).toHaveBeenCalledWith({ name: 'home' })
    expect(controller.isSubmitting.value).toBe(false)
  })

  it('exibe o erro do backend e devolve o foco ao botão de enviar', async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus')
    mocks.login.mockRejectedValue(new Error('E-mail ou senha inválidos.'))
    const controller = useLoginController()
    controller.form.email = 'nome@exemplo.com'
    controller.form.password = 'errada'

    await controller.handleSubmit()

    expect(controller.backendError.value).toBe('E-mail ou senha inválidos.')
    expect(mocks.push).not.toHaveBeenCalled()
    expect(focusSpy).toHaveBeenCalled()
    expect(document.activeElement?.id).toBe(LOGIN_SUBMIT_ID)
    expect(controller.isSubmitting.value).toBe(false)
  })

  it('usa uma mensagem genérica quando o erro não é uma instância de Error', async () => {
    mocks.login.mockRejectedValue('falha inesperada')
    const controller = useLoginController()
    controller.form.email = 'nome@exemplo.com'
    controller.form.password = 'segredo'

    await controller.handleSubmit()

    expect(controller.backendError.value).toBe(
      'Não foi possível entrar agora. Tente novamente em instantes.',
    )
  })

  it('ignora envios enquanto uma requisição está em andamento', async () => {
    let resolveLogin!: (value: { data: unknown; status: number }) => void
    mocks.login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )
    const controller = useLoginController()
    controller.form.email = 'nome@exemplo.com'
    controller.form.password = 'segredo'

    const firstSubmit = controller.handleSubmit()
    await nextTick()
    await controller.handleSubmit()

    expect(mocks.login).toHaveBeenCalledOnce()

    resolveLogin({ data: {}, status: 200 })
    await firstSubmit
  })

  it('limpa o erro do backend quando a pessoa digita novamente', async () => {
    mocks.login.mockRejectedValue(new Error('E-mail ou senha inválidos.'))
    const controller = useLoginController()
    controller.form.email = 'nome@exemplo.com'
    controller.form.password = 'errada'
    await controller.handleSubmit()

    controller.form.password = 'outra'
    await nextTick()

    expect(controller.backendError.value).toBe('')
  })

  it('alterna a visibilidade da senha', () => {
    const controller = useLoginController()

    controller.togglePasswordVisibility()
    expect(controller.isPasswordVisible.value).toBe(true)

    controller.togglePasswordVisibility()
    expect(controller.isPasswordVisible.value).toBe(false)
  })
})
