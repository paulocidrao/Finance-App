<script setup lang="ts">
import { ref } from 'vue'
import { AlertCircle, LogOut, RefreshCw, UserRound } from '@lucide/vue'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { useUserController } from './user.controller'

const { profile, details, viewState, isLoggingOut, retry, logout } = useUserController()
const isLogoutDialogOpen = ref(false)

async function confirmLogout(): Promise<void> {
  if (await logout()) {
    isLogoutDialogOpen.value = false
  }
}
</script>

<template>
  <DashboardLayout section="Meu Bolso" page="Perfil">
    <div class="flex flex-col gap-1">
      <h1 id="profile-title" class="text-2xl font-bold tracking-tight sm:text-3xl">Perfil</h1>
      <p class="text-sm text-muted-foreground">Dados da sua conta.</p>
    </div>

    <div class="w-full max-w-2xl" aria-live="polite">
      <Card
        v-if="viewState === 'loading'"
        class="w-full gap-0 overflow-hidden rounded-2xl py-0 shadow-sm"
        aria-busy="true"
        aria-label="Carregando perfil"
      >
        <CardHeader class="flex flex-row items-center gap-4 p-5 sm:p-6">
          <div class="size-16 animate-pulse rounded-full bg-primary/10" />
          <div class="flex flex-1 flex-col gap-2">
            <div class="h-5 w-40 max-w-full animate-pulse rounded-md bg-primary/10" />
            <div class="h-4 w-56 max-w-full animate-pulse rounded-md bg-primary/10" />
          </div>
        </CardHeader>
        <div v-for="item in 3" :key="item" class="flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
          <div class="h-4 w-24 animate-pulse rounded-md bg-primary/10" />
          <div class="h-4 w-36 max-w-[50%] animate-pulse rounded-md bg-primary/10" />
        </div>
        <CardFooter class="border-t p-5 sm:px-6 sm:py-4">
          <div class="h-9 w-32 animate-pulse rounded-md bg-primary/10" />
        </CardFooter>
      </Card>

      <Empty
        v-else-if="viewState === 'error'"
        role="alert"
        class="min-h-64 rounded-2xl border border-destructive/30 bg-destructive/5 py-12"
      >
        <EmptyHeader>
          <EmptyMedia variant="icon" class="bg-destructive/10 text-destructive">
            <AlertCircle aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Não foi possível carregar o perfil</EmptyTitle>
          <EmptyDescription>Verifique sua conexão e tente novamente.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" @click="retry">
            <RefreshCw aria-hidden="true" />
            Tentar novamente
          </Button>
        </EmptyContent>
      </Empty>

      <Empty v-else-if="viewState === 'empty'" class="min-h-64 rounded-2xl border py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserRound aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Perfil sem dados</EmptyTitle>
          <EmptyDescription>Não encontramos os dados da sua conta.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" @click="retry">Atualizar perfil</Button>
        </EmptyContent>
      </Empty>

      <Card v-else class="w-full gap-0 overflow-hidden rounded-2xl py-0 shadow-sm">
        <CardHeader class="flex flex-row items-center gap-4 p-5 sm:p-6">
          <Avatar class="size-16 shrink-0" aria-hidden="true">
            <AvatarFallback class="text-xl font-medium">{{ profile.initials }}</AvatarFallback>
          </Avatar>

          <div class="flex min-w-0 flex-col gap-1">
            <CardTitle class="truncate text-lg font-bold sm:text-xl">{{ profile.name }}</CardTitle>
            <CardDescription class="truncate">{{ profile.email }}</CardDescription>
          </div>
        </CardHeader>

        <dl>
          <div v-for="detail in details" :key="detail.label" class="flex items-center gap-3 border-t px-5 py-3.5 sm:px-6">
            <dt class="flex-1 text-sm text-muted-foreground">{{ detail.label }}</dt>
            <dd class="max-w-[65%] truncate text-right text-sm font-medium">{{ detail.value }}</dd>
          </div>
        </dl>

        <CardFooter class="border-t p-5 sm:px-6 sm:py-4">
          <Button
            variant="outline"
            type="button"
            class="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            :disabled="isLoggingOut"
            @click="isLogoutDialogOpen = true"
          >
            <LogOut aria-hidden="true" />
            Sair da conta
          </Button>
        </CardFooter>
      </Card>
    </div>

    <AlertDialog v-model:open="isLogoutDialogOpen">
      <AlertDialogContent class="gap-5 rounded-2xl p-5 sm:p-6">
        <AlertDialogHeader class="gap-2 text-left">
          <AlertDialogTitle>Encerrar sessão?</AlertDialogTitle>
          <AlertDialogDescription class="leading-relaxed">
            Você será desconectado desta conta e os dados financeiros armazenados offline serão removidos deste dispositivo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isLoggingOut">Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" :disabled="isLoggingOut" @click="confirmLogout">
            {{ isLoggingOut ? 'Saindo…' : 'Sair da conta' }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </DashboardLayout>
</template>
