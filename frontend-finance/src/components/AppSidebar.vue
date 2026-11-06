<script setup lang="ts">
import { ChevronsUpDown, House, List, Tags } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  getProfile,
  USER_PROFILE_QUERY_KEY,
  type UserProfile,
} from '@/views/user/user.service'

const route = useRoute()

const navItems = [
  { title: 'Resumo', to: '/home', icon: House },
  { title: 'Transações', to: '/transactions', icon: List },
  { title: 'Categorias', to: '/categories', icon: Tags },
]

const emptyUser: UserProfile = {
  name: '',
  email: '',
  initials: '',
  memberSince: '',
}
const userQuery = useQuery({
  queryKey: USER_PROFILE_QUERY_KEY,
  queryFn: getProfile,
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
})
const user = computed(() => userQuery.data.value ?? emptyUser)

function isActive(to: string) {
  return route.path.startsWith(to)
}
</script>

<template>
  <Sidebar>
    <SidebarHeader class="p-4">
      <RouterLink to="/home" class="flex items-center gap-2.5">
        <img src="@/assets/wallet.webp" alt="" class="size-8 shrink-0 object-contain" />
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-sm font-semibold">Meu Bolso</span>
          <span class="truncate text-xs text-muted-foreground">Finanças pessoais</span>
        </div>
      </RouterLink>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel class="text-muted-foreground">Menu</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in navItems" :key="item.to">
              <SidebarMenuButton as-child :is-active="isActive(item.to)" class="h-9 px-2">
                <RouterLink :to="item.to">
                  <component :is="item.icon" :class="isActive(item.to) ? '' : 'text-muted-foreground'" />
                  <span>{{ item.title }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter class="border-t">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton as-child size="lg" class="gap-2.5" :is-active="isActive('/user')">
            <RouterLink to="/user">
              <Avatar class="size-8">
                <AvatarFallback class="text-[11px] font-medium">
                  {{ user.initials }}
                </AvatarFallback>
              </Avatar>
              <div class="flex min-w-0 flex-1 flex-col text-left leading-tight">
                <span class="truncate text-sm font-medium">{{ user.name }}</span>
                <span class="truncate text-xs text-muted-foreground">{{ user.email }}</span>
              </div>
              <ChevronsUpDown class="ml-auto text-muted-foreground" />
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>
</template>
