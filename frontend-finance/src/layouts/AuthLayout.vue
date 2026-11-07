<template>
  <main class="auth-shell">
    <section class="auth-brand" aria-label="Sobre o Meu Bolso">
      <RouterLink :to="{ name: 'login' }" class="brand-mark" aria-label="Meu Bolso, início">
        <span class="brand-icon" aria-hidden="true"><WalletCards :size="20" /></span>
        <span>meu bolso</span>
      </RouterLink>

      <div class="brand-copy">
        <p class="brand-eyebrow">Finanças mais leves</p>
        <h1>Seu dinheiro,<br />no seu ritmo.</h1>
        <p class="brand-description">
          Organize suas entradas e despesas e acompanhe o que importa em um só lugar.
        </p>
      </div>

      <div class="brand-orbit" aria-hidden="true">
        <div class="orbit-ring orbit-ring-one"></div>
        <div class="orbit-ring orbit-ring-two"></div>
        <div class="orbit-core"><WalletCards :size="38" /></div>
        <span class="orbit-dot orbit-dot-one"></span>
        <span class="orbit-dot orbit-dot-two"></span>
      </div>
      <p class="brand-footer">Clareza para cuidar bem do seu dinheiro.</p>
    </section>

    <section class="auth-content">
      <div class="mobile-intro">
        <RouterLink :to="{ name: 'login' }" class="brand-mark mobile-brand" aria-label="Meu Bolso, início">
          <span class="brand-icon" aria-hidden="true"><WalletCards :size="18" /></span>
          <span>meu bolso</span>
        </RouterLink>
        <p class="mobile-eyebrow">Finanças mais leves</p>
        <h1>Seu dinheiro,<br /><span>no seu ritmo.</span></h1>
        <p>Organize sua vida financeira em um só lugar.</p>
      </div>
      <slot />
      <p class="auth-privacy">Seus dados financeiros ficam protegidos.</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { WalletCards } from '@lucide/vue';
</script>

<style lang="css" scoped src="./auth.css"></style>
