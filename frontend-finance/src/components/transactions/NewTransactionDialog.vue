<script setup lang="ts">
import { CalendarDays } from '@lucide/vue'
import { ref, watch } from 'vue'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NewTransactionInput } from '@/views/transactions/transactions.service'
import { useNewTransactionController } from './new-transaction.controller'

const open = defineModel<boolean>('open', { default: false })
const { isOnline } = useNetworkStatus()

const emit = defineEmits<{
  created: [payload: NewTransactionInput]
}>()

const dateInput = ref<HTMLInputElement | null>(null)

const {
  form,
  categories,
  submitLabel,
  error,
  setType,
  reset,
  normalizeAmount,
  buildPayload,
  formatLongDate,
} = useNewTransactionController()

watch(open, (isOpen) => {
  if (isOpen) {
    reset()
  }
})

function submit(): void {
  if (!isOnline.value) {
    toast.error('Você está offline. Conecte-se para salvar alterações.')
    return
  }
  const payload = buildPayload()

  if (!payload) {
    return
  }

  emit('created', payload)
  open.value = false
}

function openDatePicker(): void {
  const input = dateInput.value

  if (!input) {
    return
  }

  if (typeof input.showPicker === 'function') {
    input.focus()

    try {
      input.showPicker()
    } catch {
      // Mantém o foco no campo caso o navegador bloqueie o seletor nativo.
    }

    return
  }

  input.focus()
  input.click()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-[12px] p-6 sm:max-w-[480px] [&>button]:top-6 [&>button]:right-6"
    >
      <DialogHeader class="gap-1.5 pr-8 text-left">
        <DialogTitle class="text-lg leading-tight font-semibold">Nova transação</DialogTitle>
        <DialogDescription>Registre uma entrada ou uma despesa.</DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <Tabs
          :model-value="form.type"
          class="gap-0"
          @update:model-value="setType"
        >
          <TabsList
            aria-label="Tipo de transação"
            class="grid h-9 w-full grid-cols-2 rounded-[10px] bg-muted p-[3px]"
          >
            <TabsTrigger
              value="expense"
              type="button"
              class="h-[30px] rounded-lg text-sm font-medium text-muted-foreground data-[state=active]:border-input data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-background"
            >
              Despesa
            </TabsTrigger>
            <TabsTrigger
              value="income"
              type="button"
              class="h-[30px] rounded-lg text-sm font-medium text-muted-foreground data-[state=active]:border-input data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-background"
            >
              Entrada
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div class="flex flex-col gap-2">
          <Label for="new-transaction-amount" class="leading-normal text-foreground">Valor</Label>
          <div class="relative">
            <span
              class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
            >
              R$
            </span>
            <Input
              id="new-transaction-amount"
              v-model="form.amount"
              inputmode="decimal"
              placeholder="0,00"
              class="h-9 pl-10 dark:bg-background"
              @blur="normalizeAmount"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="new-transaction-description" class="leading-normal text-foreground">
            Descrição
          </Label>
          <Input
            id="new-transaction-description"
            v-model="form.description"
            maxlength="80"
            placeholder="Ex.: Mercado do mês"
            class="h-9 dark:bg-background"
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="new-transaction-category" class="leading-normal text-foreground">
            Categoria
          </Label>
          <Select v-model="form.category">
            <SelectTrigger id="new-transaction-category" class="h-9 w-full dark:bg-background">
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="category in categories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="new-transaction-date" class="leading-normal text-foreground">Data</Label>
          <div
            class="relative flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-background"
            @click="openDatePicker"
          >
            <CalendarDays class="size-4 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate text-sm">{{ formatLongDate(form.date) }}</span>
            <input
              id="new-transaction-date"
              ref="dateInput"
              v-model="form.date"
              type="date"
              class="pointer-events-none absolute inset-0 size-full opacity-0"
              @keydown.enter.prevent="openDatePicker"
              @keydown.space.prevent="openDatePicker"
            />
          </div>
        </div>

        <p v-if="error" class="text-sm text-red-400" role="alert">{{ error }}</p>

        <DialogFooter class="flex-row justify-end gap-2 pt-2">
          <DialogClose as-child>
            <Button variant="outline" type="button" class="dark:bg-background">Cancelar</Button>
          </DialogClose>

          <Button
            type="submit"
            :disabled="!isOnline"
            class="h-9"
            :class="
              form.type === 'expense'
                ? 'bg-[#b91c1c] text-white hover:bg-[#991b1b] focus-visible:ring-destructive/40'
                : ''
            "
          >
            {{ submitLabel }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
