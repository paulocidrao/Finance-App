<script setup lang="ts">
import { CloudSun } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import AppSidebar from '@/components/AppSidebar.vue'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import {
  CURRENT_WEATHER_QUERY_KEY,
  getCurrentTemperature,
} from '@/services/weather.service'

defineProps<{
  section: string
  page: string
}>()

const weatherQuery = useQuery({
  queryKey: CURRENT_WEATHER_QUERY_KEY,
  queryFn: getCurrentTemperature,
  staleTime: 15 * 60 * 1000,
  refetchInterval: 15 * 60 * 1000,
  refetchOnWindowFocus: false,
})
</script>

<template>
  <SidebarProvider>
    <AppSidebar />

    <SidebarInset class="min-w-0">
      <header class="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <SidebarTrigger class="text-muted-foreground" />
        <Separator orientation="vertical" class="h-4" />
        <Breadcrumb>
          <BreadcrumbList class="gap-2">
            <BreadcrumbItem>
              <BreadcrumbLink as-child>
                <RouterLink to="/home">{{ section }}</RouterLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage class="font-medium">{{ page }}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div
          v-if="weatherQuery.data.value !== undefined || weatherQuery.isPending.value"
          class="ml-auto flex min-w-14 items-center justify-end gap-1.5 text-sm text-muted-foreground"
          aria-live="polite"
          aria-label="Temperatura atual"
        >
          <CloudSun class="size-4 shrink-0" aria-hidden="true" />
          <Spinner v-if="weatherQuery.isPending.value" class="size-3.5" />
          <span v-else-if="weatherQuery.data.value">
            {{ weatherQuery.data.value.temperature.toFixed(1) }} °C
            <span v-if="weatherQuery.data.value.fromCache" class="text-xs">
              (cache)
            </span>
          </span>
        </div>
      </header>

      <div class="flex flex-1 flex-col gap-5 p-4 sm:gap-6 sm:p-6">
        <slot />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
