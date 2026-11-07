<script setup lang="ts">
import { CalendarDays, Check, Trash2 } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useNetworkStatus } from '@/utils/network-status'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CATEGORIES_QUERY_KEY,
  getCategories,
} from '@/views/categories/categories.service'
import type { NewTransactionInput, Transaction, TransactionType } from '@/views/transactions/transactions.service'
import { normalizeAmountInput, parseAmount, formatLongDate } from './new-transaction.service'

const open = defineModel<boolean>('open', { default: false })
const { isOnline } = useNetworkStatus()
const props = defineProps<{ transaction: Transaction | null }>()
const emit = defineEmits<{
  saved: [payload: NewTransactionInput]
  deleted: []
}>()

const dateInput = ref<HTMLInputElement | null>(null)
const categoriesQuery = useQuery({
  queryKey: CATEGORIES_QUERY_KEY,
  queryFn: getCategories,
  enabled: open,
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
})
const error = ref('')
const form = reactive({
  type: 'expense' as TransactionType,
  amount: '',
  description: '',
  category: '',
  date: '',
})
const categories = computed(() =>
  (categoriesQuery.data.value ?? [])
    .filter((category) => category.type === form.type)
    .map((category) => ({ id: category.id, name: category.name })),
)

function reset(): void {
  const transaction = props.transaction

  if (!transaction) return
  form.type = transaction.type
  form.amount = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(transaction.amount)
  form.description = transaction.description
  form.category = transaction.category
  form.date = transaction.date
  error.value = ''
}

watch(open, (isOpen) => { if (isOpen) reset() })
watch(() => form.type, () => {
  if (!categories.value.some((category) => category.id === form.category)) {
    form.category = categories.value[0]?.id ?? ''
  }
})
watch(categories, (options) => {
  if (open.value && !options.some((category) => category.id === form.category)) {
    form.category = options[0]?.id ?? ''
  }
})

function setType(value: unknown): void {
  if (value === 'income' || value === 'expense') form.type = value
}

function submit(): void {
  if (!isOnline.value) {
    toast.error('Você está offline. Conecte-se para salvar alterações.')
    return
  }
  const amount = parseAmount(form.amount)
  const description = form.description.trim()
  if (!amount) error.value = 'Informe um valor maior que zero.'
  else if (!description) error.value = 'Informe uma descrição.'
  else if (!form.category) error.value = 'Selecione uma categoria.'
  else if (!form.date) error.value = 'Informe uma data.'
  else {
    emit('saved', { type: form.type, amount, description, category: form.category, date: form.date })
    open.value = false
  }
}

function requestDelete(): void {
  if (!isOnline.value) {
    toast.error('Você está offline. Conecte-se para salvar alterações.')
    return
  }
  emit('deleted')
}

function openDatePicker(): void {
  const input = dateInput.value
  if (!input) return
  input.focus()
  if (typeof input.showPicker === 'function') {
    try { input.showPicker() } catch { /* fallback: mantém o foco no campo */ }
  } else input.click()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-[12px] p-6 sm:max-w-[480px] [&>button]:top-6 [&>button]:right-6">
      <DialogHeader class="gap-1.5 pr-8 text-left">
        <DialogTitle class="text-lg leading-tight font-semibold">Editar transação</DialogTitle>
        <DialogDescription>Altere os dados e salve para atualizar o saldo.</DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <Tabs :model-value="form.type" class="gap-0" @update:model-value="setType">
          <TabsList aria-label="Tipo de transação" class="grid h-9 w-full grid-cols-2 rounded-[10px] bg-muted p-[3px]">
            <TabsTrigger value="expense" type="button" class="h-[30px] rounded-lg text-sm font-medium text-muted-foreground data-[state=active]:border-input data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none">Despesa</TabsTrigger>
            <TabsTrigger value="income" type="button" class="h-[30px] rounded-lg text-sm font-medium text-muted-foreground data-[state=active]:border-input data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none">Entrada</TabsTrigger>
          </TabsList>
        </Tabs>

        <div class="flex flex-col gap-2"><Label for="edit-transaction-amount">Valor</Label><div class="relative"><span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">R$</span><Input id="edit-transaction-amount" v-model="form.amount" inputmode="decimal" class="h-9 pl-10 dark:bg-background" @blur="form.amount = normalizeAmountInput(form.amount)" /></div></div>
        <div class="flex flex-col gap-2"><Label for="edit-transaction-description">Descrição</Label><Input id="edit-transaction-description" v-model="form.description" maxlength="80" class="h-9 dark:bg-background" /></div>
<div class="flex flex-col gap-2"><Label for="edit-transaction-category">Categoria</Label><Select v-model="form.category"><SelectTrigger id="edit-transaction-category" class="h-9 w-full dark:bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</SelectItem></SelectContent></Select></div>
        <div class="flex flex-col gap-2"><Label for="edit-transaction-date">Data</Label><div class="relative flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 dark:bg-background" @click="openDatePicker"><CalendarDays class="size-4 shrink-0 text-muted-foreground" /><span class="min-w-0 flex-1 truncate text-sm">{{ formatLongDate(form.date) }}</span><input id="edit-transaction-date" ref="dateInput" v-model="form.date" type="date" class="pointer-events-none absolute inset-0 size-full opacity-0" /></div></div>
        <p v-if="error" class="text-sm text-red-400" role="alert">{{ error }}</p>

        <DialogFooter class="flex-row items-center justify-between gap-2 pt-2">
          <Button variant="ghost" type="button" class="text-red-400 hover:text-red-400" :disabled="!isOnline" @click="requestDelete"><Trash2 />Excluir</Button>
          <div class="flex gap-2"><DialogClose as-child><Button variant="outline" type="button" class="dark:bg-background">Cancelar</Button></DialogClose><Button type="submit" class="bg-green-500 text-green-950 hover:bg-green-400" :disabled="!isOnline"><Check />Salvar alterações</Button></div>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
