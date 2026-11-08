<script setup lang="ts">
import { AlertCircle, CalendarDays, Check, Loader2, RotateCw, Trash2 } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, nextTick, reactive, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useNetworkStatus } from '@/utils/network-status'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CATEGORIES_QUERY_KEY,
  getCategories,
} from '@/views/categories/categories.service'
import type { NewTransactionInput, Transaction, TransactionType } from '@/views/transactions/transactions.service'
import { normalizeAmountInput, parseAmount, formatLongDate } from './new-transaction.service'
import {
  DESCRIPTION_MAX_LENGTH,
  TRANSACTION_FIELDS,
  validateTransactionField,
  type TransactionField,
  type TransactionFormErrors,
} from './transaction-form.validation'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
  transaction: Transaction | null
  /** Enquanto true, o diálogo não fecha e o envio fica bloqueado. */
  saving?: boolean
  /** Erro devolvido pela API ao salvar; exibido no topo do formulário. */
  serverError?: string
}>()
const emit = defineEmits<{
  saved: [payload: NewTransactionInput]
  deleted: []
  /** Repassado do DialogContent para o pai decidir para onde o foco volta. */
  closeAutoFocus: [event: Event]
}>()

const { isOnline } = useNetworkStatus()

const ids: Record<TransactionField, string> = {
  amount: 'edit-transaction-amount',
  description: 'edit-transaction-description',
  category: 'edit-transaction-category',
  date: 'edit-transaction-date',
}

const TYPE_LABELS: Record<TransactionType, string> = { expense: 'despesa', income: 'entrada' }

const categoriesQuery = useQuery({
  queryKey: CATEGORIES_QUERY_KEY,
  queryFn: getCategories,
  enabled: open,
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
})

const form = reactive({
  type: 'expense' as TransactionType,
  amount: '',
  description: '',
  category: '',
  date: '',
})
const errors = reactive<TransactionFormErrors>({})
const touched = reactive<Partial<Record<TransactionField, boolean>>>({})

const categories = computed(() =>
  (categoriesQuery.data.value ?? [])
    .filter((category) => category.type === form.type)
    .map((category) => ({ id: category.id, name: category.name })),
)

const categoriesState = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
  if (categoriesQuery.isPending.value) return 'loading'
  if (categoriesQuery.isError.value && !categoriesQuery.data.value) return 'error'
  return categories.value.length === 0 ? 'empty' : 'ready'
})

const categoryPlaceholder = computed(() => {
  switch (categoriesState.value) {
    case 'loading':
      return 'Carregando categorias…'
    case 'error':
      return 'Categorias indisponíveis'
    case 'empty':
      return `Nenhuma categoria de ${TYPE_LABELS[form.type]}`
    default:
      return 'Selecione uma categoria'
  }
})

const descriptionLength = computed(() => form.description.trim().length)
const isBusy = computed(() => Boolean(props.saving))

function describedBy(...elementIds: Array<string | false | undefined>): string | undefined {
  return elementIds.filter(Boolean).join(' ') || undefined
}

function validateField(field: TransactionField): void {
  const message = validateTransactionField(field, form)
  if (message) errors[field] = message
  else delete errors[field]
}

function handleBlur(field: TransactionField): void {
  touched[field] = true
  validateField(field)
}

for (const field of TRANSACTION_FIELDS) {
  watch(
    () => form[field],
    () => {
      if (touched[field]) validateField(field)
    },
  )
}

function reset(): void {
  const transaction = props.transaction
  if (!transaction) return

  form.type = transaction.type
  form.amount = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(transaction.amount)
  form.description = transaction.description
  // O select trabalha com o id; `category` guarda só o nome para exibição.
  form.category = transaction.categoryId ?? ''
  form.date = transaction.date
  for (const field of TRANSACTION_FIELDS) {
    delete errors[field]
    delete touched[field]
  }
}

watch(open, (isOpen) => { if (isOpen) reset() })

// Bloqueia Esc, clique fora, X e Cancelar enquanto a alteração é enviada.
function handleOpenChange(value: boolean): void {
  if (!value && isBusy.value) return
  open.value = value
}

function setType(value: unknown): void {
  if (value !== 'income' && value !== 'expense') return
  form.type = value
  // Só a troca feita pela pessoa escolhe outra categoria; ao abrir, mantemos a da transação.
  if (!categories.value.some((category) => category.id === form.category)) {
    form.category = categories.value[0]?.id ?? ''
  }
}

function setCategory(value: unknown): void {
  form.category = typeof value === 'string' ? value : ''
  touched.category = true
}

async function focusField(field: TransactionField): Promise<void> {
  await nextTick()
  document.getElementById(ids[field])?.focus()
}

function rejectWhenOffline(): boolean {
  if (isOnline.value) return false
  toast.error('Você está offline. Conecte-se para salvar alterações.')
  return true
}

async function submit(): Promise<void> {
  if (isBusy.value || rejectWhenOffline()) return

  form.amount = normalizeAmountInput(form.amount)
  for (const field of TRANSACTION_FIELDS) {
    touched[field] = true
    validateField(field)
  }

  const firstInvalidField = TRANSACTION_FIELDS.find((field) => errors[field])
  if (firstInvalidField) {
    await focusField(firstInvalidField)
    return
  }

  emit('saved', {
    type: form.type,
    amount: parseAmount(form.amount) ?? 0,
    description: form.description.trim(),
    category: form.category,
    date: form.date,
  })
}

function requestDelete(): void {
  if (isBusy.value || rejectWhenOffline()) return
  emit('deleted')
}

function openDatePicker(): void {
  const input = document.getElementById(ids.date) as HTMLInputElement | null
  if (!input) return
  input.focus()
  if (typeof input.showPicker === 'function') {
    try { input.showPicker() } catch { /* fallback: mantém o foco no campo */ }
  } else input.click()
}
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent
      class="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-[12px] p-6 sm:max-w-[480px] [&>button]:top-6 [&>button]:right-6"
      @close-auto-focus="emit('closeAutoFocus', $event)"
    >
      <DialogHeader class="gap-1.5 pr-8 text-left">
        <DialogTitle class="text-lg leading-tight font-semibold">Editar transação</DialogTitle>
        <DialogDescription>Altere os dados e salve para atualizar o saldo.</DialogDescription>
      </DialogHeader>

      <Alert v-if="serverError" variant="destructive" aria-live="assertive">
        <AlertCircle aria-hidden="true" />
        <AlertDescription>{{ serverError }}</AlertDescription>
      </Alert>

      <form
        class="flex flex-col gap-5"
        novalidate
        aria-label="Editar transação"
        :aria-busy="isBusy"
        @submit.prevent="submit"
      >
        <Tabs :model-value="form.type" class="gap-0" @update:model-value="setType">
          <TabsList aria-label="Tipo de transação" class="grid h-9 w-full grid-cols-2 rounded-[10px] bg-muted p-[3px]">
            <TabsTrigger value="expense" type="button" class="h-[30px] rounded-lg text-sm font-medium text-muted-foreground data-[state=active]:border-input data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none">Despesa</TabsTrigger>
            <TabsTrigger value="income" type="button" class="h-[30px] rounded-lg text-sm font-medium text-muted-foreground data-[state=active]:border-input data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none">Entrada</TabsTrigger>
          </TabsList>
        </Tabs>

        <FieldGroup class="gap-5">
          <Field :data-invalid="errors.amount ? true : undefined" class="gap-2">
            <FieldLabel :for="ids.amount">Valor</FieldLabel>
            <div class="relative">
              <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true">R$</span>
              <Input
                :id="ids.amount"
                v-model="form.amount"
                inputmode="decimal"
                autocomplete="off"
                required
                class="h-9 pl-10 dark:bg-background"
                :aria-invalid="errors.amount ? true : undefined"
                :aria-describedby="describedBy(errors.amount && `${ids.amount}-error`)"
                @blur="form.amount = normalizeAmountInput(form.amount); handleBlur('amount')"
              />
            </div>
            <FieldError :id="`${ids.amount}-error`" :errors="errors.amount ? [errors.amount] : []" class="text-xs" />
          </Field>

          <Field :data-invalid="errors.description ? true : undefined" class="gap-2">
            <FieldLabel :for="ids.description">Descrição</FieldLabel>
            <Input
              :id="ids.description"
              v-model="form.description"
              :maxlength="DESCRIPTION_MAX_LENGTH"
              autocomplete="off"
              required
              class="h-9 dark:bg-background"
              :aria-invalid="errors.description ? true : undefined"
              :aria-describedby="describedBy(`${ids.description}-hint`, errors.description && `${ids.description}-error`)"
              @blur="handleBlur('description')"
            />
            <div class="flex items-start justify-between gap-3">
              <FieldError :id="`${ids.description}-error`" :errors="errors.description ? [errors.description] : []" class="text-xs" />
              <FieldDescription :id="`${ids.description}-hint`" class="ml-auto shrink-0 text-xs tabular-nums">
                {{ descriptionLength }}/{{ DESCRIPTION_MAX_LENGTH }}
                <span class="sr-only">caracteres</span>
              </FieldDescription>
            </div>
          </Field>

          <Field :data-invalid="errors.category ? true : undefined" class="gap-2">
            <FieldLabel :for="ids.category">Categoria</FieldLabel>
            <Select
              :model-value="form.category"
              :disabled="categoriesState !== 'ready'"
              @update:model-value="setCategory"
            >
              <SelectTrigger
                :id="ids.category"
                class="h-9 w-full dark:bg-background"
                :aria-busy="categoriesState === 'loading'"
                :aria-invalid="errors.category ? true : undefined"
                :aria-describedby="describedBy(
                  categoriesState !== 'ready' && `${ids.category}-status`,
                  errors.category && `${ids.category}-error`,
                )"
              >
                <Loader2 v-if="categoriesState === 'loading'" class="animate-spin" aria-hidden="true" />
                <SelectValue :placeholder="categoryPlaceholder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</SelectItem>
              </SelectContent>
            </Select>

            <div
              v-if="categoriesState === 'error'"
              :id="`${ids.category}-status`"
              role="alert"
              class="flex flex-wrap items-center justify-between gap-2 text-xs text-destructive"
            >
              Não foi possível carregar as categorias.
              <Button type="button" variant="outline" size="xs" class="dark:bg-background" @click="categoriesQuery.refetch()">
                <RotateCw aria-hidden="true" />
                Tentar novamente
              </Button>
            </div>
            <FieldDescription v-else-if="categoriesState === 'empty'" :id="`${ids.category}-status`" class="text-xs">
              Você ainda não tem categorias de {{ TYPE_LABELS[form.type] }}.
              <RouterLink :to="{ name: 'categories' }" class="font-medium text-primary">Criar categoria</RouterLink>
            </FieldDescription>
            <FieldError :id="`${ids.category}-error`" :errors="errors.category ? [errors.category] : []" class="text-xs" />
          </Field>

          <Field :data-invalid="errors.date ? true : undefined" class="gap-2">
            <FieldLabel :for="ids.date">Data</FieldLabel>
            <div
              class="relative flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-background"
              :class="errors.date ? 'border-destructive' : ''"
              @click="openDatePicker"
            >
              <CalendarDays class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate text-sm" aria-hidden="true">{{ formatLongDate(form.date) }}</span>
              <input
                :id="ids.date"
                v-model="form.date"
                type="date"
                required
                class="pointer-events-none absolute inset-0 size-full opacity-0"
                :aria-invalid="errors.date ? true : undefined"
                :aria-describedby="describedBy(errors.date && `${ids.date}-error`)"
                @blur="handleBlur('date')"
                @keydown.space.prevent="openDatePicker"
              />
            </div>
            <FieldError :id="`${ids.date}-error`" :errors="errors.date ? [errors.date] : []" class="text-xs" />
          </Field>
        </FieldGroup>

        <p v-if="!isOnline" role="status" class="text-xs text-muted-foreground">
          Você está offline. Conecte-se para salvar ou excluir.
        </p>

        <DialogFooter class="flex-row flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            variant="ghost"
            type="button"
            class="text-destructive hover:text-destructive"
            :disabled="!isOnline || isBusy"
            @click="requestDelete"
          >
            <Trash2 aria-hidden="true" />
            Excluir
          </Button>
          <div class="flex gap-2">
            <Button
              variant="outline"
              type="button"
              class="dark:bg-background"
              :disabled="isBusy"
              @click="handleOpenChange(false)"
            >
              Cancelar
            </Button>
            <!-- aria-disabled (e não disabled) para o foco não se perder durante o envio. -->
            <Button
              type="submit"
              :disabled="!isOnline"
              :aria-disabled="isBusy || undefined"
              :class="isBusy ? 'cursor-progress opacity-70' : ''"
            >
              <Loader2 v-if="isBusy" class="animate-spin" aria-hidden="true" />
              <Check v-else aria-hidden="true" />
              {{ isBusy ? 'Salvando…' : 'Salvar alterações' }}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
