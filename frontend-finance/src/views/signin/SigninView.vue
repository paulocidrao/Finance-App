<template>
  <AuthLayout>
    <Card class="w-full max-w-md gap-0 rounded-[1.75rem] border-[#27272a] bg-[#18181b] p-6 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.45)] sm:p-8">
      <CardHeader class="gap-2 px-0 pb-6">
        <h2 id="signin-title" class="font-serif text-3xl font-normal tracking-tight text-[#fafafa]">Criar conta</h2>
        <CardDescription class="text-sm text-[#a1a1aa]">Crie sua conta em poucos minutos.</CardDescription>
      </CardHeader>

      <CardContent class="px-0">
        <Alert v-if="backendError" variant="destructive" class="mb-6" aria-live="assertive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{{ backendError }}</AlertDescription>
        </Alert>

        <form
          novalidate
          aria-labelledby="signin-title"
          :aria-busy="isSubmitting"
          @submit.prevent="handleSubmit"
        >
          <fieldset :disabled="isSubmitting" class="m-0 min-w-0 border-0 p-0">
            <FieldGroup class="gap-5">
              <Field :data-invalid="!!errors.name || undefined">
                <FieldLabel :for="ids.name" class="text-[#fafafa]">Nome</FieldLabel>
                <Input
                  :id="ids.name"
                  v-model="form.name"
                  autocomplete="name"
                  :maxlength="NAME_MAX_LENGTH"
                  required
                  class="h-12 rounded-xl border-[#27272a] bg-[#09090b] px-4 text-base text-[#fafafa] focus-visible:border-[#22c55e] focus-visible:ring-[#22c55e]/30"
                  :aria-invalid="!!errors.name || undefined"
                  :aria-describedby="errors.name ? `${ids.name}-error` : undefined"
                  @blur="handleBlur('name')"
                />
                <FieldError v-if="errors.name" :id="`${ids.name}-error`" :errors="[errors.name]" />
              </Field>

              <Field :data-invalid="!!errors.email || undefined">
                <FieldLabel :for="ids.email" class="text-[#fafafa]">E-mail</FieldLabel>
                <Input
                  :id="ids.email"
                  v-model="form.email"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  autocapitalize="none"
                  spellcheck="false"
                  placeholder="nome@exemplo.com"
                  required
                  class="h-12 rounded-xl border-[#27272a] bg-[#09090b] px-4 text-base text-[#fafafa] focus-visible:border-[#22c55e] focus-visible:ring-[#22c55e]/30"
                  :aria-invalid="!!errors.email || undefined"
                  :aria-describedby="errors.email ? `${ids.email}-error` : undefined"
                  @blur="handleBlur('email')"
                />
                <FieldError v-if="errors.email" :id="`${ids.email}-error`" :errors="[errors.email]" />
              </Field>

              <Field :data-invalid="!!errors.password || undefined">
                <FieldLabel :for="ids.password" class="text-[#fafafa]">Senha</FieldLabel>
                <div class="relative">
                  <Input
                    :id="ids.password"
                    v-model="form.password"
                    :type="isPasswordVisible ? 'text' : 'password'"
                    autocomplete="new-password"
                    :minlength="PASSWORD_MIN_LENGTH"
                    :maxlength="PASSWORD_MAX_LENGTH"
                    required
                    class="h-12 rounded-xl border-[#27272a] bg-[#09090b] px-4 pr-10 text-base text-[#fafafa] focus-visible:border-[#22c55e] focus-visible:ring-[#22c55e]/30"
                    :aria-invalid="!!errors.password || undefined"
                    :aria-describedby="describedBy(`${ids.password}-hint`, errors.password && `${ids.password}-error`)"
                    @blur="handleBlur('password')"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    class="absolute top-0.5 right-0.5 text-[#a1a1aa] hover:bg-[#27272a]"
                    :aria-label="isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'"
                    :aria-pressed="isPasswordVisible"
                    :aria-controls="`${ids.password} ${ids.passwordConfirmation}`"
                    @click="togglePasswordVisibility"
                  >
                    <EyeOff v-if="isPasswordVisible" aria-hidden="true" />
                    <Eye v-else aria-hidden="true" />
                  </Button>
                </div>
                <FieldDescription :id="`${ids.password}-hint`" class="text-[#a1a1aa]">
                  Mínimo de {{ PASSWORD_MIN_LENGTH }} caracteres.
                </FieldDescription>
                <FieldError v-if="errors.password" :id="`${ids.password}-error`" :errors="[errors.password]" />
              </Field>

              <Field :data-invalid="!!errors.passwordConfirmation || undefined">
                <FieldLabel :for="ids.passwordConfirmation" class="text-[#fafafa]">Confirmar senha</FieldLabel>
                <Input
                  :id="ids.passwordConfirmation"
                  v-model="form.passwordConfirmation"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  autocomplete="new-password"
                  :maxlength="PASSWORD_MAX_LENGTH"
                  required
                  class="h-12 rounded-xl border-[#27272a] bg-[#09090b] px-4 text-base text-[#fafafa] focus-visible:border-[#22c55e] focus-visible:ring-[#22c55e]/30"
                  :aria-invalid="!!errors.passwordConfirmation || undefined"
                  :aria-describedby="
                    errors.passwordConfirmation ? `${ids.passwordConfirmation}-error` : undefined
                  "
                  @blur="handleBlur('passwordConfirmation')"
                />
                <FieldError
                  v-if="errors.passwordConfirmation"
                  :id="`${ids.passwordConfirmation}-error`"
                  :errors="[errors.passwordConfirmation]"
                />
              </Field>

              <Button :id="SIGNIN_SUBMIT_ID" type="submit" class="mt-1 h-12 w-full rounded-xl bg-[#22c55e] text-base font-semibold text-[#052e16] shadow-sm hover:bg-[#16a34a] focus-visible:ring-[#22c55e]/40" :disabled="!isOnline || isSubmitting">
                <Spinner v-if="isSubmitting" aria-hidden="true" />
                {{ isSubmitting ? 'Criando conta…' : 'Criar conta' }}
              </Button>
            </FieldGroup>
          </fieldset>
        </form>
      </CardContent>

      <CardFooter class="justify-center gap-1 px-0 text-sm">
        <span class="text-[#a1a1aa]">Já tem conta?</span>
        <RouterLink
          :to="{ name: 'login' }"
          class="rounded-sm font-medium text-[#22c55e] underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-[#22c55e]/40"
        >
          Entrar
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/AuthLayout.vue';
import {
  SIGNIN_FIELD_IDS as ids,
  SIGNIN_SUBMIT_ID,
  useSigninController,
} from './signin.controller';
import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './signin.validation';

useTitle('Criar conta · Meu Bolso', { restoreOnUnmount: (originalTitle) => originalTitle });

const {
  isOnline,
  form,
  errors,
  backendError,
  isSubmitting,
  isPasswordVisible,
  handleBlur,
  handleSubmit,
  togglePasswordVisibility,
} = useSigninController();

function describedBy(...elementIds: Array<string | false | undefined>): string | undefined {
  const value = elementIds.filter(Boolean).join(' ');
  return value || undefined;
}
</script>
