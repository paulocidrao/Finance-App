<script setup lang="ts">
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RotateCw,
  Search,
  SearchX,
  SquarePen,
  Tags,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from '@lucide/vue'
import {
  AlertDialog,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import type { CategoryType } from './categories.service'
import {
  CATEGORIES_PAGE_SIZE,
  CATEGORY_DELETE_ACK_ID,
  CATEGORY_NAME_ID,
  CATEGORY_SEARCH_ID,
  useCategoriesController,
} from './categories.controller'
import { CATEGORY_NAME_MAX_LENGTH, CATEGORY_TYPE_LABELS } from './categories.validation'

// Mesmas cores de entrada/despesa do dashboard, num só lugar.
const TYPE_STYLES: Record<CategoryType, { icon: typeof TrendingUp; tone: string }> = {
  income: { icon: TrendingUp, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  expense: { icon: TrendingDown, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
}

// O anel de foco padrão (ring-ring/50) quase some no tema escuro; nesta tela
// ele usa a cor cheia. Os diálogos ficam fora do layout (teleport) e repetem a classe.
const FOCUS_RING = '[&_:focus-visible]:ring-ring'

const {
  isOnline,
  search,
  typeFilter,
  page,
  categories,
  total,
  totalPages,
  viewState,
  isRefreshing,
  rangeLabel,
  statusMessage,
  setTypeFilter,
  clearFilters,
  retry,
  isFormOpen,
  isEditing,
  form,
  errors,
  nameLength,
  submitError,
  isSubmitting,
  openCreateCategory,
  openEditCategory,
  handleNameBlur,
  setFormType,
  submitCategory,
  isDeleteDialogOpen,
  categoryPendingDelete,
  isDeleteBlocked,
  blockedDeleteMessage,
  isDeleting,
  deleteError,
  requestDeleteCategory,
  confirmDeleteCategory,
  handleDeleteDialogCloseAutoFocus,
} = useCategoriesController()

function clearSearchOnEscape(event: KeyboardEvent): void {
  if (!search.value) return
  event.preventDefault()
  search.value = ''
}
</script>

<template>
  <DashboardLayout section="Meu Bolso" page="Categorias">
    <div class="contents" :class="FOCUS_RING">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="flex flex-1 flex-col gap-1">
          <h1 class="text-[26px] font-bold tracking-tight">Categorias</h1>
          <p class="text-sm text-muted-foreground">
            Organize suas transações por tipo de gasto ou receita.
          </p>
        </div>

        <Button type="button" class="w-fit" :disabled="!isOnline || isSubmitting || isDeleting" @click="openCreateCategory">
          <Plus aria-hidden="true" />
          Nova categoria
        </Button>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center" role="search">
        <div class="relative w-full sm:w-80">
          <Label :for="CATEGORY_SEARCH_ID" class="sr-only">Buscar categoria pelo nome</Label>
          <Search
            aria-hidden="true"
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            :id="CATEGORY_SEARCH_ID"
            v-model="search"
            type="search"
            autocomplete="off"
            placeholder="Buscar pelo nome"
            :maxlength="CATEGORY_NAME_MAX_LENGTH"
            class="h-9 pl-9 dark:bg-background"
            @keydown.esc="clearSearchOnEscape"
          />
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          aria-label="Filtrar por tipo"
          :model-value="typeFilter"
          class="h-9 w-fit"
          @update:model-value="setTypeFilter"
        >
          <ToggleGroupItem value="all" class="h-9 px-3.5">Todas</ToggleGroupItem>
          <ToggleGroupItem value="expense" class="h-9 px-3.5">Despesas</ToggleGroupItem>
          <ToggleGroupItem value="income" class="h-9 px-3.5">Entradas</ToggleGroupItem>
        </ToggleGroup>

        <p
          v-if="isRefreshing"
          class="flex items-center gap-2 text-xs text-muted-foreground sm:ml-auto"
          aria-hidden="true"
        >
          <Loader2 class="size-3.5 animate-spin" />
          Atualizando…
        </p>
      </div>

      <p class="sr-only" role="status" aria-live="polite">{{ statusMessage }}</p>

      <Card
        role="region"
        aria-labelledby="categories-list-title"
        class="gap-0 overflow-hidden py-0"
      >
        <h2 id="categories-list-title" class="sr-only">Lista de categorias</h2>

        <!-- Carregando -->
        <ul v-if="viewState === 'loading'" role="list" aria-busy="true" aria-label="Carregando categorias">
          <li
            v-for="index in CATEGORIES_PAGE_SIZE"
            :key="index"
            class="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
            aria-hidden="true"
          >
            <Skeleton class="size-9 rounded-lg" />
            <div class="flex flex-1 flex-col gap-2">
              <Skeleton class="h-4 w-40 max-w-full" />
              <Skeleton class="h-3 w-24" />
            </div>
            <Skeleton class="hidden h-5 w-16 sm:block" />
            <Skeleton class="size-9" />
            <Skeleton class="size-9" />
          </li>
        </ul>

        <!-- Erro -->
        <Empty v-else-if="viewState === 'error'" role="alert" class="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon" class="bg-destructive/10 text-destructive">
              <TriangleAlert aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Não foi possível carregar as categorias</EmptyTitle>
            <EmptyDescription>
              Verifique sua conexão. Se o problema continuar, tente de novo em alguns minutos.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" @click="retry">
              <RotateCw aria-hidden="true" />
              Tentar novamente
            </Button>
          </EmptyContent>
        </Empty>

        <!-- Nenhuma categoria cadastrada -->
        <Empty v-else-if="viewState === 'empty'" class="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Tags aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Nenhuma categoria ainda</EmptyTitle>
            <EmptyDescription>
              Crie categorias como “Mercado” ou “Salário” para organizar suas transações.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" :disabled="!isOnline || isSubmitting || isDeleting" @click="openCreateCategory">
              <Plus aria-hidden="true" />
              Criar primeira categoria
            </Button>
          </EmptyContent>
        </Empty>

        <!-- Filtros sem resultado -->
        <Empty v-else-if="viewState === 'no-results'" class="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Nenhuma categoria encontrada</EmptyTitle>
            <EmptyDescription>
              Nenhuma categoria corresponde à busca ou ao tipo selecionado.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" @click="clearFilters">Limpar filtros</Button>
          </EmptyContent>
        </Empty>

        <!-- Lista -->
        <ul
          v-else
          role="list"
          :aria-busy="isRefreshing"
          class="transition-opacity"
          :class="isRefreshing ? 'opacity-60' : ''"
        >
          <li
            v-for="category in categories"
            :key="category.id"
            class="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
          >
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg"
              :class="TYPE_STYLES[category.type].tone"
              aria-hidden="true"
            >
              <component :is="TYPE_STYLES[category.type].icon" class="size-4" />
            </div>

            <p class="min-w-0 flex-1 truncate text-sm font-medium">{{ category.name }}</p>

            <Badge
              variant="secondary"
              class="shrink-0 rounded-md border-transparent px-2 py-0.5 text-xs font-semibold"
              :class="TYPE_STYLES[category.type].tone"
            >
              {{ CATEGORY_TYPE_LABELS[category.type] }}
            </Badge>

            <div class="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                class="size-9 text-muted-foreground"
                type="button"
                :disabled="!isOnline || isSubmitting || isDeleting"
                @click="openEditCategory(category)"
              >
                <SquarePen aria-hidden="true" />
                <span class="sr-only">Editar {{ category.name }}</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                class="size-9 text-muted-foreground hover:text-destructive focus-visible:text-destructive"
                type="button"
                :disabled="!isOnline || isSubmitting || isDeleting"
                @click="requestDeleteCategory(category)"
              >
                <Trash2 aria-hidden="true" />
                <span class="sr-only">Excluir {{ category.name }}</span>
              </Button>
            </div>
          </li>
        </ul>

        <footer
          v-if="viewState === 'ready'"
          class="flex flex-col gap-3 border-t px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-xs text-muted-foreground sm:flex-1">{{ rangeLabel }}</p>

          <Pagination
            v-if="totalPages > 1"
            v-slot="{ page: activePage }"
            v-model:page="page"
            :items-per-page="CATEGORIES_PAGE_SIZE"
            :total="total"
            :sibling-count="0"
            show-edges
            aria-label="Paginação das categorias"
            class="mx-0 w-auto"
          >
            <PaginationContent v-slot="{ items }" class="gap-2">
              <PaginationPrevious
                size="sm"
                aria-label="Página anterior"
                class="h-8 gap-2 border border-input bg-background px-3 dark:bg-background"
              >
                <ChevronLeft class="size-4" aria-hidden="true" />
                <span class="hidden sm:inline">Anterior</span>
              </PaginationPrevious>

              <template v-for="(item, index) in items" :key="index">
                <PaginationItem
                  v-if="item.type === 'page'"
                  :value="item.value"
                  :is-active="item.value === activePage"
                  :aria-label="`Página ${item.value}`"
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
                aria-label="Próxima página"
                class="h-8 gap-2 border border-input bg-background px-3 dark:bg-background"
              >
                <span class="hidden sm:inline">Próxima</span>
                <ChevronRight class="size-4" aria-hidden="true" />
              </PaginationNext>
            </PaginationContent>
          </Pagination>
        </footer>
      </Card>
    </div>

    <!-- Criar / editar -->
    <Dialog v-model:open="isFormOpen">
      <DialogContent class="sm:max-w-md" :class="FOCUS_RING">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? 'Editar categoria' : 'Nova categoria' }}</DialogTitle>
          <DialogDescription>
            {{
              isEditing
                ? 'Altere o nome da categoria.'
                : 'Crie uma categoria para organizar suas transações.'
            }}
          </DialogDescription>
        </DialogHeader>

        <form class="flex flex-col gap-6" novalidate @submit.prevent="isOnline && submitCategory()">
          <FieldGroup class="gap-5">
            <Field :data-invalid="errors.name ? true : undefined" class="gap-2">
              <FieldLabel :for="CATEGORY_NAME_ID">Nome</FieldLabel>
              <Input
                :id="CATEGORY_NAME_ID"
                v-model="form.name"
                autocomplete="off"
                placeholder="Ex.: Educação"
                required
                :disabled="!isOnline || isSubmitting"
                :aria-invalid="errors.name ? true : undefined"
                :aria-describedby="`${CATEGORY_NAME_ID}-hint${errors.name ? ` ${CATEGORY_NAME_ID}-error` : ''}`"
                class="dark:bg-background"
                @blur="handleNameBlur"
              />
              <div class="flex items-start justify-between gap-3">
                <FieldError
                  :id="`${CATEGORY_NAME_ID}-error`"
                  :errors="errors.name ? [errors.name] : []"
                  class="text-xs"
                />
                <FieldDescription
                  :id="`${CATEGORY_NAME_ID}-hint`"
                  class="ml-auto shrink-0 text-xs tabular-nums"
                  :class="nameLength > CATEGORY_NAME_MAX_LENGTH ? 'text-destructive' : ''"
                >
                  {{ nameLength }}/{{ CATEGORY_NAME_MAX_LENGTH }}
                  <span class="sr-only">caracteres</span>
                </FieldDescription>
              </div>
            </Field>

            <Field class="gap-2">
              <FieldLabel id="category-type-label">Tipo</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                aria-labelledby="category-type-label"
                aria-describedby="category-type-hint"
                :model-value="form.type"
                :disabled="isEditing || !isOnline || isSubmitting"
                class="w-full"
                @update:model-value="setFormType"
              >
                <ToggleGroupItem value="expense" class="h-9 flex-1">
                  <TrendingDown aria-hidden="true" />
                  Despesa
                </ToggleGroupItem>
                <ToggleGroupItem value="income" class="h-9 flex-1">
                  <TrendingUp aria-hidden="true" />
                  Entrada
                </ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription id="category-type-hint" class="text-xs">
                {{
                  isEditing
                    ? 'O tipo não pode ser alterado: as transações da categoria dependem dele.'
                    : 'Despesas e entradas aparecem em listas separadas nos formulários.'
                }}
              </FieldDescription>
            </Field>
          </FieldGroup>

          <p
            v-if="submitError"
            role="alert"
            class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {{ submitError }}
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" @click="isFormOpen = false">
              Cancelar
            </Button>
            <Button type="submit" :disabled="!isOnline || isSubmitting" :aria-busy="isSubmitting">
              <Loader2 v-if="isSubmitting" class="animate-spin" aria-hidden="true" />
              {{ isSubmitting ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar categoria' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Confirmação de exclusão -->
    <AlertDialog v-model:open="isDeleteDialogOpen">
      <AlertDialogContent
        class="gap-4 rounded-[12px] p-6 sm:max-w-[440px]"
        :class="FOCUS_RING"
        @close-auto-focus="handleDeleteDialogCloseAutoFocus"
      >
        <AlertDialogHeader class="gap-2 text-left">
          <AlertDialogTitle>
            {{ isDeleteBlocked ? 'Não é possível excluir' : 'Excluir categoria?' }}
          </AlertDialogTitle>
          <AlertDialogDescription class="leading-[150%]">
            <template v-if="isDeleteBlocked">{{ blockedDeleteMessage }}</template>
            <template v-else-if="categoryPendingDelete">
              “{{ categoryPendingDelete.name }}” será removida. Essa ação não pode ser desfeita.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p
          v-if="deleteError"
          role="alert"
          class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {{ deleteError }}
        </p>

        <AlertDialogFooter>
          <template v-if="isDeleteBlocked">
            <AlertDialogCancel :id="CATEGORY_DELETE_ACK_ID" class="dark:bg-background">Entendi</AlertDialogCancel>
          </template>
          <template v-else>
            <AlertDialogCancel :disabled="isDeleting" class="dark:bg-background">Cancelar</AlertDialogCancel>
            <!-- Botão comum (não AlertDialogAction) para o diálogo ficar aberto durante a exclusão. -->
            <Button
              type="button"
              class="bg-[#b91c1c] text-white hover:bg-[#991b1b] focus-visible:ring-destructive/40"
              :disabled="!isOnline || isDeleting"
              :aria-busy="isDeleting"
              @click="isOnline && confirmDeleteCategory()"
            >
              <Loader2 v-if="isDeleting" class="animate-spin" aria-hidden="true" />
              {{ isDeleting ? 'Excluindo…' : 'Excluir' }}
            </Button>
          </template>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </DashboardLayout>
</template>
