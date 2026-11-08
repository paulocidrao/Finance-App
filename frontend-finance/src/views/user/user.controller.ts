import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { endSession } from '@/utils/session'
import { useNetworkStatus } from '@/utils/network-status'
import {
  getProfile,
  logout as logoutUser,
  USER_PROFILE_QUERY_KEY,
  type UserProfile,
} from './user.service'

const emptyProfile: UserProfile = {
  name: '',
  email: '',
  initials: '',
  memberSince: '',
}

function formatMemberSince(value: string): string {
  if (!value) {
    return ''
  }

  const [year, month, day] = value.split('-')

  return `${day}/${month}/${year}`
}

export function useUserController() {
  const { isOnline } = useNetworkStatus()
  const profileQuery = useQuery({
    queryKey: USER_PROFILE_QUERY_KEY,
    queryFn: getProfile,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
  const profile = computed(() => profileQuery.data.value ?? emptyProfile)
  const isLoggingOut = ref(false)
  const viewState = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
    if (profileQuery.isPending.value && !profileQuery.data.value) return 'loading'
    if (profileQuery.error.value && !profileQuery.data.value) return 'error'
    if (!profileQuery.data.value?.name || !profileQuery.data.value?.email) return 'empty'
    return 'ready'
  })

  const details = computed(() => [
    { label: 'Nome', value: profile.value.name },
    { label: 'E-mail', value: profile.value.email },
    { label: 'Membro desde', value: formatMemberSince(profile.value.memberSince) },
  ])

  async function logout(): Promise<boolean> {
    if (isLoggingOut.value) return false

    if (!isOnline.value) {
      toast.error('Conecte-se para encerrar a sessão com segurança.')
      return false
    }

    isLoggingOut.value = true
    try {
      await logoutUser()
      await endSession()
      toast.success('Sessão encerrada', { description: 'Você saiu da sua conta.' })
      return true
    } catch {
      toast.error('Não foi possível encerrar a sessão. Tente novamente quando estiver conectado.')
      return false
    } finally {
      isLoggingOut.value = false
    }
  }

  function retry(): void {
    void profileQuery.refetch()
  }

  return {
    profile,
    details,
    viewState,
    isProfileLoading: profileQuery.isPending,
    profileError: profileQuery.error,
    isLoggingOut,
    retry,
    logout,
  }
}
