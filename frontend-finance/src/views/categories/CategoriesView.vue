<script setup lang="ts">
import { Plus, SquarePen, Tags, Trash2 } from '@lucide/vue'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { useCategoriesController } from './categories.controller'

const {
  isOnline,
  categoryGroups,
  isDialogOpen,
  isEditing,
  categoryForm,
  formError,
  typeLabel,
  openCreateCategory,
  openEditCategory,
  setCategoryType,
  submitCategory,
  deleteCategory,
} = useCategoriesController()
</script>

<template>
  <DashboardLayout section="Meu Bolso" page="Categorias">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="flex flex-1 flex-col gap-1">
        <h1 class="text-[26px] font-bold tracking-tight">Categorias</h1>
        <p class="text-sm text-muted-foreground">
          Organize suas transações por tipo de gasto ou receita.
        </p>
      </div>

      <Button type="button" class="w-fit" :disabled="!isOnline" @click="openCreateCategory">
        <Plus />
        Nova categoria
      </Button>
    </div>

    <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
      <Card
        v-for="group in categoryGroups"
        :key="group.type"
        class="w-full gap-0 overflow-hidden py-0 lg:flex-1"
      >
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-base font-semibold">{{ group.title }}</h2>
          <p class="mt-1 text-[13px] text-muted-foreground">{{ group.countLabel }}</p>
        </div>

        <div
          v-for="category in group.categories"
          :key="category.id"
          class="flex items-center gap-3 border-t py-2 pr-3 pl-5"
        >
          <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <Tags class="size-4 text-muted-foreground" />
          </div>

          <p class="min-w-0 flex-1 truncate text-sm font-medium">
            {{ category.name }}
          </p>

          <Button
            variant="ghost"
            size="icon"
            class="size-9 text-muted-foreground"
            type="button"
            :disabled="!isOnline"
            @click="openEditCategory(category)"
          >
            <SquarePen />
            <span class="sr-only">Editar {{ category.name }}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="size-9 text-muted-foreground hover:text-destructive"
            type="button"
            :disabled="!isOnline"
            @click="deleteCategory(category)"
          >
            <Trash2 />
            <span class="sr-only">Excluir {{ category.name }}</span>
          </Button>
        </div>
      </Card>
    </div>

    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? 'Editar categoria' : 'Nova categoria' }}</DialogTitle>
          <DialogDescription>
            {{
              isEditing
                ? 'Atualize o nome ou o tipo da categoria.'
                : 'Crie uma categoria para organizar suas transações.'
            }}
          </DialogDescription>
        </DialogHeader>

        <form class="grid gap-4" @submit.prevent="submitCategory">
          <div class="grid gap-2">
            <Label for="category-name">Nome</Label>
            <Input
              id="category-name"
              v-model="categoryForm.name"
              placeholder="Ex.: Educação"
            />
          </div>

          <div class="grid gap-2">
            <Label for="category-type">Tipo</Label>
            <Select
              :model-value="categoryForm.type"
              @update:model-value="setCategoryType"
            >
              <SelectTrigger id="category-type" class="w-full dark:bg-background">
                <span class="font-medium">{{ typeLabel }}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="income">Entrada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>

          <DialogFooter>
            <Button type="button" variant="outline" @click="isDialogOpen = false">
              Cancelar
            </Button>
            <Button type="submit" :disabled="!isOnline">
              {{ isEditing ? 'Salvar' : 'Criar categoria' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </DashboardLayout>
</template>
