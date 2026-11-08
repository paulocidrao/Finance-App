<script setup lang="ts">
import { useNetworkStatus } from '@/utils/network-status'
const { isOnline, cachedUrls } = useNetworkStatus()
</script>

<template>
  <div v-if="!isOnline || cachedUrls.size > 0" role="status" aria-live="polite"
    class="sticky top-0 z-50 border-b border-amber-500/30 bg-zinc-950 px-4 py-3 text-center text-sm text-amber-200">
    <strong v-if="!isOnline">Você está offline.</strong>
    <strong v-else>Exibindo dados do cache.</strong>
    Os dados podem estar desatualizados.
    <span v-if="!isOnline">Conecte-se para criar, editar ou excluir registros.</span>
  </div>
</template>