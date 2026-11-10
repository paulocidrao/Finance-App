<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const INSTALL_TOAST_ID = 'pwa-install'
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)

function isStandalone(): boolean {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }

  return window.matchMedia('(display-mode: standalone)').matches
    || navigatorWithStandalone.standalone === true
}

function onBeforeInstallPrompt(event: Event): void {
  event.preventDefault()
  deferredPrompt.value = event as BeforeInstallPromptEvent

  if (isStandalone()) {
    return
  }

  toast.info('Instale o Meu Bolso', {
    id: INSTALL_TOAST_ID,
    description: 'Acesse suas finanças rapidamente pela tela inicial do celular.',
    duration: Infinity,
    action: {
      label: 'Instalar',
      onClick: () => void installApp(),
    },
  })
}

async function installApp(): Promise<void> {
  const prompt = deferredPrompt.value

  if (!prompt) {
    return
  }

  deferredPrompt.value = null
  toast.dismiss(INSTALL_TOAST_ID)
  await prompt.prompt()
  await prompt.userChoice
}

function onAppInstalled(): void {
  deferredPrompt.value = null
  toast.dismiss(INSTALL_TOAST_ID)
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onAppInstalled)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.removeEventListener('appinstalled', onAppInstalled)
})
</script>

<template>
  <!-- O convite é exibido pelo toast quando o navegador liberar a instalação. -->
</template>
