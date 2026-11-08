import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiOrigin = new URL(env.VITE_API_BASE_URL ?? "http://localhost:3000/")
    .origin;

  const workboxConfig = {
    globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api\//, /^\/docs\//],
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: new RegExp(
          `^${apiOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/transactions\\/?$`,
        ),
        handler: "NetworkOnly" as const,
        method: "POST" as const,
        options: {
          backgroundSync: {
            name: "transactions-write-queue",
            options: { maxRetentionTime: 24 * 60 },
          },
        },
      },
    ],
    maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
  };

  return {
    plugins: [
      vue(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.js",
        injectManifest: {
          injectionPoint: "self.__WB_MANIFEST",
          globPatterns: workboxConfig.globPatterns,
          maximumFileSizeToCacheInBytes:
            workboxConfig.maximumFileSizeToCacheInBytes,
        },
        workbox: workboxConfig,
        manifest: false,
        devOptions: {
          enabled: false,
          type: "classic",
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
