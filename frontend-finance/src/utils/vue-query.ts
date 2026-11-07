import { QueryClient } from "@tanstack/vue-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Permite que o service worker responda com o cache mesmo quando o
      // navegador reporta que está offline.
      networkMode: "always",
    },
  },
});
