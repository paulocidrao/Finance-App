<template>
  <AuthLayout>
    <Card class="login-card w-full max-w-md gap-0 rounded-[1.75rem] border-[#d3c8b4] bg-[#f4ecde] p-6 shadow-[0_18px_50px_-35px_rgba(48,55,43,0.45)] sm:p-8">
      <CardHeader class="gap-2 px-0 pb-6">
        <h2 id="login-title" class="font-serif text-3xl font-normal tracking-tight text-[#30372b]">Bem-vindo de volta</h2>
        <CardDescription class="text-sm text-[#697060]">Entre para acompanhar suas finanças.</CardDescription>
      </CardHeader>

      <CardContent class="px-0">
        <Alert v-if="backendError" variant="destructive" class="mb-5 rounded-2xl" role="alert" aria-live="assertive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{{ backendError }}</AlertDescription>
        </Alert>

        <form
          novalidate
          aria-labelledby="login-title"
          :aria-busy="isSubmitting"
          @submit.prevent="handleSubmit"
        >
          <fieldset :disabled="isSubmitting" class="m-0 min-w-0 border-0 p-0">
            <FieldGroup class="gap-5">
              <Field :data-invalid="!!errors.email || undefined">
                <FieldLabel :for="LOGIN_FIELD_IDS.email" class="text-[#394132]">E-mail</FieldLabel>
                <Input
                  :id="LOGIN_FIELD_IDS.email"
                  v-model="form.email"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  autocapitalize="none"
                  spellcheck="false"
                  placeholder="nome@exemplo.com"
                  required
                  class="h-12 rounded-xl border-[#c9c4b4] bg-[#fbf7ef] px-4 text-base focus-visible:border-[#718167] focus-visible:ring-[#718167]/30"
                  :aria-invalid="!!errors.email || undefined"
                  :aria-describedby="errors.email ? `${LOGIN_FIELD_IDS.email}-error` : undefined"
                  @blur="handleBlur('email')"
                />
                <FieldError v-if="errors.email" :id="`${LOGIN_FIELD_IDS.email}-error`" :errors="[errors.email]" />
              </Field>

              <Field :data-invalid="!!errors.password || undefined">
                <div class="flex items-center justify-between gap-2">
                  <FieldLabel :for="LOGIN_FIELD_IDS.password" class="text-[#394132]">Senha</FieldLabel>
                  <span class="text-xs text-[#777d70]">Use sua senha de acesso</span>
                </div>
                <div class="relative">
                  <Input
                    :id="LOGIN_FIELD_IDS.password"
                    v-model="form.password"
                    :type="isPasswordVisible ? 'text' : 'password'"
                    autocomplete="current-password"
                    required
                    class="h-12 rounded-xl border-[#c9c4b4] bg-[#fbf7ef] px-4 pr-12 text-base focus-visible:border-[#718167] focus-visible:ring-[#718167]/30"
                    :aria-invalid="!!errors.password || undefined"
                    :aria-describedby="errors.password ? `${LOGIN_FIELD_IDS.password}-error` : undefined"
                    @blur="handleBlur('password')"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="absolute top-1 right-1 size-10 rounded-xl text-[#68745d] hover:bg-[#e8dcc7]"
                    :aria-label="isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'"
                    :aria-pressed="isPasswordVisible"
                    :aria-controls="LOGIN_FIELD_IDS.password"
                    @click="togglePasswordVisibility"
                  >
                    <EyeOff v-if="isPasswordVisible" aria-hidden="true" />
                    <Eye v-else aria-hidden="true" />
                  </Button>
                </div>
                <FieldError v-if="errors.password" :id="`${LOGIN_FIELD_IDS.password}-error`" :errors="[errors.password]" />
              </Field>

              <Button
                :id="LOGIN_SUBMIT_ID"
                type="submit"
                class="mt-1 h-12 w-full rounded-xl bg-[#536348] text-base font-semibold text-[#f4ecde] shadow-sm hover:bg-[#414b36] focus-visible:ring-[#536348]/40"
              >
                <Spinner v-if="isSubmitting" aria-hidden="true" />
                {{ isSubmitting ? 'Entrando…' : 'Entrar' }}
              </Button>
            </FieldGroup>
          </fieldset>
        </form>
      </CardContent>

      <CardFooter class="justify-center gap-1.5 px-0 pt-6 text-sm">
        <span class="text-[#697060]">Ainda não tem conta?</span>
        <RouterLink
          :to="{ name: 'signin' }"
          class="rounded-sm font-semibold text-[#536348] underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-[#718167]/40"
        >
          Criar conta
        </RouterLink>
      </CardFooter>
    </Card>
  </AuthLayout>
</template>

<script setup lang="ts">
import { useTitle } from '@vueuse/core';
import { AlertCircle, Eye, EyeOff } from '@lucide/vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { LOGIN_FIELD_IDS, LOGIN_SUBMIT_ID, useLoginController } from './login.controller';

useTitle('Entrar · Meu Bolso', { restoreOnUnmount: (originalTitle) => originalTitle });

const {
  form,
  errors,
  backendError,
  isSubmitting,
  isPasswordVisible,
  handleBlur,
  handleSubmit,
  togglePasswordVisibility,
} = useLoginController();
</script>
