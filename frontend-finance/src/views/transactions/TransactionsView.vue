<script setup lang="ts">
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Plus,
  Search,
  SquarePen,
  Trash2,
} from '@lucide/vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import NewTransactionDialog from '@/components/transactions/NewTransactionDialog.vue'
import EditTransactionDialog from '@/components/transactions/EditTransactionDialog.vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { useTransactionsController } from './transactions.controller'

const {
  isOnline,
  search,
  categoryFilter,
  typeFilter,
  page,
  pageSize,
  categories,
  periodLabel,
  selectedMonth,
  monthOptions,
  categoryLabel,
  filteredTransactions,
  paginatedTransactions,
  rangeLabel,
  selectedTransaction,
  isDetailsOpen,
  transactionPendingDelete,
  isDeleteDialogOpen,
  isNewTransactionOpen,
  isEditTransactionOpen,
  formatDate,
  formatLongDate,
  formatCreatedAt,
  formatSignedAmount,
  setCategoryFilter,
  setTypeFilter,
  setMonth,
  openNewTransaction,
  addTransaction,
  openDetails,
  editTransaction,
  saveEditedTransaction,
  deleteEditedTransaction,
  requestDeleteTransaction,
  confirmDeleteTransaction,
} = useTransactionsController()
</script>

<template>
  <DashboardLayout section="Meu Bolso" page="Transações">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="flex flex-1 flex-col gap-1">
        <h1 class="text-[26px] font-bold tracking-tight">Transações</h1>
        <p class="text-sm text-muted-foreground">Todas as suas entradas e despesas.</p>
      </div>

      <Button type="button" class="w-fit" :disabled="!isOnline" @click="openNewTransaction">
        <Plus />
        Nova transação
      </Button>
    </div>

    <div class="flex flex-col gap-3 xl:flex-row xl:items-center">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="relative w-full sm:w-80">
          <Search
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="search"
            type="text"
            placeholder="Buscar por descrição"
            class="h-9 pl-9 dark:bg-background"
          />
        </div>

        <Select
          :model-value="categoryFilter"
          @update:model-value="setCategoryFilter"
        >
          <SelectTrigger class="h-9 w-full sm:w-[200px] dark:bg-background">
            <span class="truncate font-medium">Categoria: {{ categoryLabel }}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem
              v-for="category in categories"
              :key="category"
              :value="category"
            >
              {{ category }}
            </SelectItem>
          </SelectContent>
        </Select>

        <ToggleGroup
          type="single"
          variant="outline"
          :model-value="typeFilter"
          class="h-9 w-fit"
          @update:model-value="setTypeFilter"
        >
          <ToggleGroupItem value="all" class="h-9 px-3.5">Todas</ToggleGroupItem>
          <ToggleGroupItem value="income" class="h-9 px-3.5">Entradas</ToggleGroupItem>
          <ToggleGroupItem value="expense" class="h-9 px-3.5">Despesas</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Select :model-value="selectedMonth" @update:model-value="setMonth">
        <SelectTrigger class="h-9 w-[190px] xl:ml-auto dark:bg-background">
          <CalendarDays />
          <span class="truncate">{{ periodLabel }}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="month in monthOptions" :key="month.value" :value="month.value">
            {{ month.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <Card class="gap-0 overflow-hidden py-0">
      <Table class="min-w-[900px]">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-[120px] pl-4 text-[13px] font-medium text-muted-foreground">
              Data
            </TableHead>
            <TableHead class="text-[13px] font-medium text-muted-foreground">
              Descrição
            </TableHead>
            <TableHead class="w-[200px] text-[13px] font-medium text-muted-foreground">
              Categoria
            </TableHead>
            <TableHead class="w-[120px] text-[13px] font-medium text-muted-foreground">
              Tipo
            </TableHead>
            <TableHead
              class="w-[160px] text-right text-[13px] font-medium text-muted-foreground"
            >
              Valor
            </TableHead>
            <TableHead class="w-[64px] pr-4">
              <span class="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow
            v-for="transaction in paginatedTransactions"
            :key="transaction.id"
            tabindex="0"
            class="h-[50px] cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
            @click="openDetails(transaction)"
            @keydown.enter="openDetails(transaction)"
            @keydown.space.prevent="openDetails(transaction)"
          >
            <TableCell class="pl-4 text-sm">{{ formatDate(transaction.date) }}</TableCell>
            <TableCell class="text-sm">{{ transaction.description }}</TableCell>
            <TableCell class="w-[200px]">
              <Badge variant="secondary" class="rounded-md px-2 py-0.5 text-xs font-semibold">
                {{ transaction.category }}
              </Badge>
            </TableCell>
            <TableCell class="w-[120px]">
              <Badge
                variant="secondary"
                class="rounded-md px-2 py-0.5 text-xs font-semibold"
                :class="
                  transaction.type === 'income'
                    ? 'border-transparent bg-[#0f2a1a] text-[#4ade80]'
                    : 'border-transparent bg-[#2a1215] text-[#f87171]'
                "
              >
                {{ transaction.type === 'income' ? 'Entrada' : 'Despesa' }}
              </Badge>
            </TableCell>
            <TableCell class="w-[160px] text-right">
              <span
                class="text-[15px] font-semibold"
                :class="transaction.type === 'income' ? 'text-green-400' : 'text-red-400'"
              >
                {{ formatSignedAmount(transaction) }}
              </span>
            </TableCell>
            <TableCell class="w-[64px] p-0 pr-4" @click.stop @keydown.stop>
              <div class="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="size-9 text-muted-foreground">
                      <MoreHorizontal />
                      <span class="sr-only">Abrir ações da transação</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-44">
                    <DropdownMenuItem @select="openDetails(transaction)">
                      <Eye />
                      Ver detalhes
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      :disabled="!isOnline"
                      @select="requestDeleteTransaction(transaction)"
                    >
                      <Trash2 />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-if="paginatedTransactions.length === 0" class="hover:bg-transparent">
            <TableCell colspan="6" class="h-24 text-center text-sm text-muted-foreground">
              Nenhuma transação encontrada.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        class="flex flex-col gap-3 border-t px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-[13px] text-muted-foreground sm:flex-1">{{ rangeLabel }}</p>

        <Pagination
          v-slot="{ page: activePage }"
          v-model:page="page"
          :items-per-page="pageSize"
          :total="filteredTransactions.length"
          :sibling-count="0"
          show-edges
          class="mx-0 w-auto"
        >
          <PaginationContent v-slot="{ items }" class="gap-2">
            <PaginationPrevious
              size="sm"
              class="h-8 gap-2 border border-input bg-background px-3 dark:bg-background"
            >
              <ChevronLeft class="size-4" />
              <span class="hidden sm:inline">Anterior</span>
            </PaginationPrevious>

            <template v-for="(item, index) in items" :key="index">
              <PaginationItem
                v-if="item.type === 'page'"
                :value="item.value"
                :is-active="item.value === activePage"
                class="size-8 dark:bg-background"
                :class="item.value === activePage ? 'font-medium' : 'font-normal'"
              >
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else class="size-8 text-sm text-muted-foreground">
                <span aria-hidden="true">…</span>
                <span class="sr-only">Mais páginas</span>
              </PaginationEllipsis>
            </template>

            <PaginationNext
              size="sm"
              class="h-8 gap-2 border border-input bg-background px-3 dark:bg-background"
            >
              <span class="hidden sm:inline">Próxima</span>
              <ChevronRight class="size-4" />
            </PaginationNext>
          </PaginationContent>
        </Pagination>
      </div>
    </Card>

    <Sheet v-model:open="isDetailsOpen">
      <SheetContent
        side="right"
        class="w-full gap-5 overflow-y-auto p-6 [&>button]:top-6 [&>button]:right-6 sm:max-w-[420px]"
      >
        <template v-if="selectedTransaction">
          <SheetHeader class="gap-1.5 p-0 pr-8">
            <SheetTitle class="text-lg leading-tight font-semibold">
              {{ selectedTransaction.description }}
            </SheetTitle>
            <SheetDescription>Detalhes da transação</SheetDescription>
          </SheetHeader>

          <div class="flex flex-col gap-2 py-2">
            <Badge
              variant="secondary"
              class="w-fit rounded-md px-2 py-0.5 text-xs font-semibold"
              :class="
                selectedTransaction.type === 'income'
                  ? 'border-transparent bg-[#0f2a1a] text-[#4ade80]'
                  : 'border-transparent bg-[#2a1215] text-[#f87171]'
              "
            >
              {{ selectedTransaction.type === 'income' ? 'Entrada' : 'Despesa' }}
            </Badge>

            <p
              class="text-[36px] leading-none font-bold"
              :class="
                selectedTransaction.type === 'income' ? 'text-green-400' : 'text-red-400'
              "
            >
              {{ formatSignedAmount(selectedTransaction) }}
            </p>
          </div>

          <div class="h-px w-full shrink-0 bg-border" />

          <div class="flex items-center gap-2 text-sm">
            <span class="flex-1 text-muted-foreground">Categoria</span>
            <span class="font-medium">{{ selectedTransaction.category }}</span>
          </div>

          <div class="h-px w-full shrink-0 bg-border" />

          <div class="flex items-center gap-2 text-sm">
            <span class="flex-1 text-muted-foreground">Data</span>
            <span class="font-medium">{{ formatLongDate(selectedTransaction.date) }}</span>
          </div>

          <div class="h-px w-full shrink-0 bg-border" />

          <div class="flex items-center gap-2 text-sm">
            <span class="flex-1 text-muted-foreground">Criada em</span>
            <span class="font-medium">
              {{ formatCreatedAt(selectedTransaction.createdAt) }}
            </span>
          </div>

          <div class="h-px w-full shrink-0 bg-border" />

          <div class="flex items-center gap-2 text-sm">
            <span class="flex-1 text-muted-foreground">Tipo</span>
            <span class="font-medium">
              {{ selectedTransaction.type === 'income' ? 'Entrada' : 'Despesa' }}
            </span>
          </div>

          <div class="min-h-0 flex-1" />

          <SheetFooter class="mt-auto gap-2 p-0">
            <Button
              variant="outline"
              type="button"
              class="h-9 w-full justify-center dark:bg-background"
              :disabled="!isOnline"
              @click="editTransaction(selectedTransaction)"
            >
              <SquarePen />
              Editar transação
            </Button>

            <Button
              variant="outline"
              type="button"
              class="h-9 w-full justify-center border-input text-red-400 hover:text-red-400 dark:bg-background"
              :disabled="!isOnline"
              @click="requestDeleteTransaction(selectedTransaction)"
            >
              <Trash2 />
              Excluir
            </Button>
          </SheetFooter>
        </template>
      </SheetContent>
    </Sheet>

    <AlertDialog v-model:open="isDeleteDialogOpen">
      <AlertDialogContent class="gap-4 rounded-[12px] p-6 sm:max-w-[440px]">
        <AlertDialogHeader class="gap-2 text-left">
          <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
          <AlertDialogDescription class="leading-[150%]">
            <template v-if="transactionPendingDelete">
              “{{ transactionPendingDelete.description }}” será removida e o saldo do período
              será recalculado. Essa ação não pode ser desfeita.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel class="dark:bg-background">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            class="bg-[#b91c1c] text-white hover:bg-[#991b1b] focus-visible:ring-destructive/40"
            :disabled="!isOnline"
            @click="confirmDeleteTransaction"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <NewTransactionDialog v-model:open="isNewTransactionOpen" @created="addTransaction" />
    <EditTransactionDialog
      v-model:open="isEditTransactionOpen"
      :transaction="selectedTransaction"
      @saved="saveEditedTransaction"
      @deleted="deleteEditedTransaction"
    />
  </DashboardLayout>
</template>
