import router from '@/router'
import { clearOfflineApiCache } from './offline-cache'
import { queryClient } from './vue-query'
import { resetCachedResponses } from './network-status'

let cleanup: Promise<void> | undefined

export function endSession(): Promise<void> {
  if (cleanup) return cleanup
  cleanup = (async () => {
    // Cancel requests before clearing data so late responses cannot repopulate it.
    await queryClient.cancelQueries()
    queryClient.clear()
    resetCachedResponses()
    await clearOfflineApiCache()
    if (router.currentRoute.value.path !== '/login') await router.replace('/login')
  })().finally(() => { cleanup = undefined })
  return cleanup
}