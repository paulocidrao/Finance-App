<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'
import UpdatePrompt from '@/components/pwa/UpdatePrompt.vue'
import InstallPrompt from '@/components/pwa/InstallPrompt.vue'
import OfflineBanner from '@/components/pwa/OfflineBanner.vue'
</script>

<template>
  <div class="min-h-screen" style="background-color: #09090b">
    <OfflineBanner />
    <RouterView />
    <Toaster position="bottom-right" theme="dark" />
    <InstallPrompt />
    <UpdatePrompt />
  </div>
</template>
