import { createRouter, createWebHistory } from "vue-router";
import NotFound from "@/views/NotFound/NotFound.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      redirect: { name: "login" },
    },
    {
      path: "/home",
      name: "home",
      component: () => import("@/views/home/HomeView.vue"),
    },
    {
      path: "/user",
      name: "user",
      component: () => import("@/views/user/UserView.vue"),
    },
    {
      path: "/categories",
      name: "categories",
      component: () => import("@/views/categories/CategoriesView.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/login/LoginView.vue"),
    },
    {
      path: "/signin",
      name: "signin",
      component: () => import("@/views/signin/SigninView.vue"),
    },
    {
      path: "/transactions",
      name: "transactions",
      component: () => import("@/views/transactions/TransactionsView.vue"),
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: NotFound,
    },
  ],
});

export default router;
