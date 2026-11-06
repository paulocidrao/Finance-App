<template>
  <main class="flex min-h-screen">
    <section class="hidden w-1/2 flex-col justify-between bg-gray-400/5 px-12 py-10 md:flex"
      aria-label="Apresentação do aplicativo">
      <div class="flex items-center gap-1.5">
        <img src="@/assets/wallet.webp" alt="" class="size-7 object-contain" />
        <h1 class="text-xl font-bold text-white">Meu Bolso</h1>
      </div>

      <div class="flex max-w-lg flex-col gap-4">
        <p class="text-3xl font-bold text-white">Suas entradas e despesas, em um só lugar.</p>
        <p class="text-sm leading-6 text-muted-foreground">
          Registre, categorize e acompanhe o saldo do mês em qualquer dispositivo, mesmo offline.
        </p>
      </div>
    </section>

    <section class="flex w-full items-center justify-center px-6 py-10 md:w-1/2">
      <slot />
    </section>
  </main>
</template>
