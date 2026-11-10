import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  refetch: vi.fn(),
  getProfile: vi.fn(),
  logoutUser: vi.fn(),
  endSession: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  isOnline: { value: true },
}))

vi.mock('@tanstack/vue-query', () => ({ useQuery: mocks.useQuery }))
vi.mock('./user.service', () => ({
  USER_PROFILE_QUERY_KEY: ['user', 'profile'],
  getProfile: mocks.getProfile,
  logout: mocks.logoutUser,
}))
vi.mock('@/utils/session', () => ({ endSession: mocks.endSession }))
vi.mock('@/utils/network-status', () => ({
  useNetworkStatus: () => ({ isOnline: mocks.isOnline }),
}))
vi.mock('vue-sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

import { useUserController } from './user.controller'
import type { UserProfile } from './user.service'

function createProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: 'Maria Silva',
    email: 'maria@exemplo.com',
    initials: 'MS',
    memberSince: '2025-03-14',
    ...overrides,
  }
}

function createQuery(initial: UserProfile | null = createProfile()) {
  return {
    data: ref<UserProfile | null>(initial),
    isPending: ref(false),
    error: ref<unknown>(null),
    refetch: mocks.refetch,
  }
}

function createController(initial: UserProfile | null = createProfile()) {
  const query = createQuery(initial)
  mocks.useQuery.mockReset()
  mocks.useQuery.mockReturnValue(query)
  return { controller: useUserController(), query }
}

describe('useUserController', () => {
  beforeEach(() => {
    mocks.isOnline.value = true
    mocks.refetch.mockResolvedValue(undefined)
    mocks.logoutUser.mockResolvedValue(undefined)
    mocks.endSession.mockResolvedValue(undefined)
  })

  it('expõe o perfil, os detalhes e o estado pronto', () => {
    const { controller } = createController()

    expect(controller.profile.value).toEqual(createProfile())
    expect(controller.details.value).toEqual([
      { label: 'Nome', value: 'Maria Silva' },
      { label: 'E-mail', value: 'maria@exemplo.com' },
      { label: 'Membro desde', value: '14/03/2025' },
    ])
    expect(controller.viewState.value).toBe('ready')
    expect(controller.isLoggingOut.value).toBe(false)
  })

  it('usa um perfil vazio enquanto não há dados', () => {
    const { controller } = createController(null)

    expect(controller.profile.value).toEqual({
      name: '',
      email: '',
      initials: '',
      memberSince: '',
    })
    expect(controller.details.value[2].value).toBe('')
  })

  it('mostra carregamento na primeira busca', () => {
    const { controller, query } = createController(null)
    query.isPending.value = true

    expect(controller.viewState.value).toBe('loading')
    expect(controller.isProfileLoading.value).toBe(true)
  })

  it('mostra erro quando a busca falha sem dados', () => {
    const { controller, query } = createController(null)
    const error = new Error('falhou')
    query.error.value = error

    expect(controller.viewState.value).toBe('error')
    expect(controller.profileError.value).toBe(error)
  })

  it('mantém o perfil em cache mesmo se uma atualização falhar', () => {
    const { controller, query } = createController()
    query.error.value = new Error('falhou')

    expect(controller.viewState.value).toBe('ready')
  })

  it('mostra o estado vazio quando faltam nome ou e-mail', () => {
    const { controller, query } = createController(createProfile({ name: '' }))
    expect(controller.viewState.value).toBe('empty')

    query.data.value = createProfile({ email: '' })
    expect(controller.viewState.value).toBe('empty')
  })

  it('tenta carregar o perfil novamente', () => {
    const { controller } = createController()

    controller.retry()

    expect(mocks.refetch).toHaveBeenCalledOnce()
  })

  it('não encerra a sessão offline', async () => {
    mocks.isOnline.value = false
    const { controller } = createController()

    const result = await controller.logout()

    expect(result).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Conecte-se para encerrar a sessão com segurança.',
    )
    expect(mocks.logoutUser).not.toHaveBeenCalled()
    expect(mocks.endSession).not.toHaveBeenCalled()
  })

  it('encerra a sessão, limpa os dados locais e avisa', async () => {
    const { controller } = createController()

    const result = await controller.logout()

    expect(result).toBe(true)
    expect(mocks.logoutUser).toHaveBeenCalledOnce()
    expect(mocks.endSession).toHaveBeenCalledOnce()
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Sessão encerrada', {
      description: 'Você saiu da sua conta.',
    })
    expect(controller.isLoggingOut.value).toBe(false)
  })

  it('avisa quando não é possível encerrar a sessão', async () => {
    mocks.logoutUser.mockRejectedValue(new Error('falhou'))
    const { controller } = createController()

    const result = await controller.logout()

    expect(result).toBe(false)
    expect(mocks.endSession).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Não foi possível encerrar a sessão. Tente novamente quando estiver conectado.',
    )
    expect(controller.isLoggingOut.value).toBe(false)
  })

  it('ignora chamadas concorrentes de logout', async () => {
    let finishLogout!: () => void
    mocks.logoutUser.mockReturnValue(
      new Promise<void>((resolve) => {
        finishLogout = resolve
      }),
    )
    const { controller } = createController()

    const first = controller.logout()
    const second = await controller.logout()

    expect(second).toBe(false)
    expect(mocks.logoutUser).toHaveBeenCalledOnce()

    finishLogout()
    await first
  })
})
