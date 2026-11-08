import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
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

  const details = computed(() => [
    { label: 'Nome', value: profile.value.name },
    { label: 'E-mail', value: profile.value.email },
    { label: 'Membro desde', value: formatMemberSince(profile.value.memberSince) },
  ])

  async function logout(): Promise<void> {
    if (!isOnline.value) {
      toast.error('Conecte-se para encerrar a sessão com segurança.')
      return
    }
    try {
      await logoutUser()
    } catch {
      toast.error('Não foi possível encerrar a sessão. Tente novamente quando estiver conectado.')
      return
    }
    await endSession()
    toast.success('Sessão encerrada', { description: 'Você saiu da sua conta.' })
  }

  return {
    profile,
    details,
    isProfileLoading: profileQuery.isPending,
    profileError: profileQuery.error,
    logout,
  }
}
