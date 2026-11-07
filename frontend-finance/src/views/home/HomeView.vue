<script setup lang="ts">
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleAlert,
  Plus,
  ReceiptText,
  RefreshCw,
  Wallet,
} from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import NewTransactionDialog from '@/components/transactions/NewTransactionDialog.vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { useHomeController } from './home.controller'

const {
  isOnline,
  summary,
  selectedMonth,
  selectedMonthLabel,
  monthOptions,
  setMonth,
  isSummaryLoading,
  isSummaryError,
  refetchSummary,
  isNewTransactionOpen,
  openNewTransaction,
  addTransaction,
  formatCurrency,
  formatSignedAmount,
  formatPercentage,
} = useHomeController()
</script>

<template>
  <DashboardLayout section="Meu Bolso" page="Início">
    <main class="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-4 sm:gap-8">
      <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="space-y-1">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Visão geral</p>
          <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Seu dinheiro, em foco</h1>
          <p class="max-w-xl text-sm text-muted-foreground">
            Acompanhe entradas, despesas e saldo sem complicação.
          </p>
        </div>
        <div class="flex w-full gap-2 sm:w-auto">
          <Select :model-value="selectedMonth" @update:model-value="setMonth">
            <SelectTrigger class="min-w-0 flex-1 rounded-xl sm:w-[190px] sm:flex-none" aria-label="Selecionar período">
              <CalendarDays class="size-4 shrink-0" />
              <span class="truncate">{{ selectedMonthLabel }}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="month in monthOptions" :key="month.value" :value="month.value">
                {{ month.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" class="shrink-0 rounded-xl" :disabled="!isOnline" @click="openNewTransaction">
            <Plus class="size-4" />
            <span class="hidden sm:inline">Nova transação</span>
            <span class="sm:hidden">Adicionar</span>
          </Button>
        </div>
      </section>

      <section v-if="isSummaryError" class="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6"
        role="alert">
        <div class="flex items-start gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <CircleAlert class="size-5" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold">Não foi possível carregar seu resumo</h2>
            <p class="mt-1 text-sm text-muted-foreground">Confira sua conexão e tente novamente.</p>
            <Button class="mt-4 rounded-xl" variant="outline" :disabled="isSummaryLoading" @click="refetchSummary">
              <RefreshCw class="mr-2 size-4" :class="isSummaryLoading ? 'animate-spin' : ''" />
              Tentar novamente
            </Button>
          </div>
        </div>
      </section>

      <template v-else>
        <section class="grid gap-3 sm:grid-cols-3 sm:gap-4" aria-label="Resumo financeiro">
          <template v-if="isSummaryLoading">
            <div v-for="item in 3" :key="item" class="h-36 animate-pulse rounded-2xl bg-muted sm:h-40" />
          </template>
          <template v-else>
            <Card
              class="overflow-hidden rounded-2xl border-0 bg-primary px-5 py-5 text-primary-foreground shadow-sm sm:px-6 sm:py-6">
              <CardHeader class="flex-row items-center justify-between p-0">
                <CardDescription class="font-medium text-primary-foreground/80">Saldo do período</CardDescription>
                <span class="flex size-9 items-center justify-center rounded-xl bg-white/15">
                  <Wallet class="size-4" />
                </span>
              </CardHeader>
              <CardContent class="p-0 pt-5">
                <p class="break-all text-[clamp(1.75rem,7vw,2.25rem)] font-bold leading-none tracking-tight">{{
                  formatCurrency(summary.balance) }}</p>
                <p class="mt-3 flex items-center gap-1.5 text-xs text-primary-foreground/75">
                  <Check class="size-3.5" /> Entradas menos despesas
                </p>
              </CardContent>
            </Card>
            <Card class="rounded-2xl px-5 py-5 shadow-sm sm:px-6 sm:py-6">
              <CardHeader class="flex-row items-center justify-between p-0">
                <CardDescription class="font-medium">Entradas</CardDescription>
                <span
                  class="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight class="size-5" />
                </span>
              </CardHeader>
              <CardContent class="p-0 pt-5">
                <p class="break-all text-2xl font-bold leading-none tracking-tight">{{ formatCurrency(summary.income) }}
                </p>
                <p class="mt-3 text-xs text-muted-foreground">Total recebido no período</p>
              </CardContent>
            </Card>
            <Card class="rounded-2xl px-5 py-5 shadow-sm sm:px-6 sm:py-6">
              <CardHeader class="flex-row items-center justify-between p-0">
                <CardDescription class="font-medium">Despesas</CardDescription>
                <span
                  class="flex size-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <ArrowDownRight class="size-5" />
                </span>
              </CardHeader>
              <CardContent class="p-0 pt-5">
                <p class="break-all text-2xl font-bold leading-none tracking-tight">{{ formatCurrency(summary.expenses)
                }}</p>
                <p class="mt-3 text-xs text-muted-foreground">Total gasto no período</p>
              </CardContent>
            </Card>
          </template>
        </section>

        <section class="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
          <Card class="min-w-0 gap-0 overflow-hidden rounded-2xl py-0 shadow-sm">
            <CardHeader class="flex-row items-center justify-between gap-3 px-5 py-5 sm:px-6">
              <div class="min-w-0">
                <CardTitle class="text-base">Atividade recente</CardTitle>
                <CardDescription class="mt-1 text-xs">{{ summary.transactionsCount }} transações em {{
                  selectedMonthLabel }}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" as-child class="shrink-0 rounded-xl">
                <RouterLink to="/transactions">Ver todas</RouterLink>
              </Button>
            </CardHeader>

            <div v-if="isSummaryLoading" class="space-y-3 px-5 pb-5 sm:px-6">
              <div v-for="item in 4" :key="item" class="h-14 animate-pulse rounded-xl bg-muted" />
            </div>
            <div v-else-if="summary.transactions.length === 0"
              class="mx-5 mb-5 flex flex-col items-center rounded-xl border border-dashed px-5 py-8 text-center sm:mx-6">
              <span class="mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ReceiptText class="size-5" />
              </span>
              <p class="text-sm font-semibold">Tudo começa com um registro</p>
              <p class="mt-1 max-w-xs text-xs text-muted-foreground">Adicione sua primeira transação para acompanhar sua
                vida
                financeira aqui.</p>
              <Button size="sm" class="mt-4 rounded-xl" :disabled="!isOnline" @click="openNewTransaction">
                <Plus class="mr-1 size-4" /> Adicionar transação
              </Button>
            </div>

            <div v-if="!isSummaryLoading && summary.transactions.length" class="divide-y px-5 pb-1 sm:hidden">
              <div v-for="transaction in summary.transactions" :key="transaction.id"
                class="flex items-center gap-3 py-3.5">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  :class="transaction.amount >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'">
                  <ArrowUpRight v-if="transaction.amount >= 0" class="size-4" />
                  <ArrowDownRight v-else class="size-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ transaction.description }}</p>
                  <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ transaction.category }} · {{
                    transaction.date }}
                  </p>
                </div>
                <span class="shrink-0 text-sm font-semibold"
                  :class="transaction.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : ''">{{
                    formatSignedAmount(transaction.amount) }}</span>
              </div>
            </div>
            <Table v-if="!isSummaryLoading && summary.transactions.length" class="hidden sm:table">
              <TableHeader>
                <TableRow class="hover:bg-transparent">
                  <TableHead class="pl-6">Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead class="pr-6 text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="transaction in summary.transactions" :key="transaction.id" class="h-14">
                  <TableCell class="max-w-48 truncate pl-6 font-medium">{{ transaction.description }}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" class="rounded-lg font-medium">{{ transaction.category }}</Badge>
                  </TableCell>
                  <TableCell class="text-muted-foreground">{{ transaction.date }}</TableCell>
                  <TableCell class="pr-6 text-right font-semibold"
                    :class="transaction.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : ''">{{
                      formatSignedAmount(transaction.amount) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

          </Card>

          <Card class="gap-0 rounded-2xl shadow-sm">
            <CardHeader class="px-5 pb-4 pt-5 sm:px-6">
              <CardTitle class="text-base">Despesas por categoria</CardTitle>
              <CardDescription class="mt-1 text-xs">Onde seu dinheiro foi no período</CardDescription>
            </CardHeader>
            <CardContent class="px-5 pb-5 sm:px-6">
              <div v-if="isSummaryLoading" class="space-y-5">
                <div v-for="item in 4" :key="item" class="space-y-2">
                  <div class="h-4 w-full animate-pulse rounded bg-muted" />
                  <div class="h-2 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div v-else-if="summary.categories.length === 0"
                class="flex flex-col items-center rounded-xl border border-dashed px-4 py-7 text-center">
                <p class="text-sm font-medium">Sem despesas por enquanto</p>
                <p class="mt-1 text-xs text-muted-foreground">As categorias aparecem quando você registrar despesas.</p>
              </div>
              <div v-else class="flex flex-col gap-5">
                <div v-for="category in summary.categories" :key="category.name" class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ category.name }}</span>
                    <span class="text-sm font-semibold">{{ formatCurrency(category.amount) }}</span>
                    <span class="w-12 text-right text-xs text-muted-foreground">{{ formatPercentage(category.percentage)
                    }}</span>
                  </div>
                  <Progress :model-value="category.percentage" class="h-2 bg-muted"
                    :class="category.tone === 'muted' ? '[&_[data-slot=progress-indicator]]:bg-muted-foreground' : ''" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </template>

      <NewTransactionDialog v-model:open="isNewTransactionOpen" @created="addTransaction" />
    </main>
  </DashboardLayout>
</template>
