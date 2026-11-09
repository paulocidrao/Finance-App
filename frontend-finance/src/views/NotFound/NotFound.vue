<script lang="ts" setup>
import Button from '@/components/ui/button/Button.vue';
import router from '@/router';
import { GlobeOffIcon } from '@lucide/vue';

const backRouter = () => {
  router.back();
}
</script>

<template>
  <main class="flex min-h-dvh w-full flex-col items-center justify-center gap-3.5 px-4 py-8 text-center sm:px-6">
    <section class="flex max-w-full flex-col items-center gap-3 sm:flex-row sm:gap-4">
      <h1 class="text-2xl font-semibold sm:text-3xl">Pagina não encontrada!</h1>
      <GlobeOffIcon class="size-8 shrink-0 sm:size-7" aria-hidden="true" />
    </section>
    <Button @click="backRouter" class="w-full max-w-xs sm:w-2xs">Voltar</Button>
  </main>
</template>
