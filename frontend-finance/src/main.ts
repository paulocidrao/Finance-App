import { createApp } from "vue";
import { createPinia } from "pinia";
import "./style.css";
import App from "./App.vue";
import { startConnectivityMonitoring } from './utils/network-status';
import router from "./router";
import { queryClient } from "./utils/vue-query.ts";
import {
  VueQueryPlugin,
  type VueQueryPluginOptions,
} from "@tanstack/vue-query";
import { endSession } from "./utils/session";
const vueQueryPluginOptions: VueQueryPluginOptions = {
  queryClient: queryClient,
};
const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin, vueQueryPluginOptions);

navigator.serviceWorker?.addEventListener("message", (event: MessageEvent) => {
  if (event.data?.type !== "API_CACHE_SESSION_EXPIRED") {
    return;
  }

  void endSession();
});

// O service worker é registrado pelo <UpdatePrompt /> (AppLayout).
app.mount("#app");
startConnectivityMonitoring();
