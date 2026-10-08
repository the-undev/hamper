/// <reference types="vitest/config" />
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { manifest } from "./src/pwa/manifest.ts";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // tanstackRouter must come before react(); tests beside routes are not routes.
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routeFileIgnorePattern: "\\.test\\.",
    }),
    react(),
    tailwindcss(),
    // src/pwa/register.ts registers the worker and asks before an update reloads the page.
    VitePWA({
      strategies: "generateSW",
      registerType: "prompt",
      injectRegister: false,
      manifest,
      devOptions: { enabled: false },
      workbox: {
        // Every chunk under assets: the router splits each route into its own.
        globPatterns: ["**/*.{js,css,html,svg}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/sync\//,
          /^\/images\//,
          /^\/health$/,
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/images/"),
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5276,
    proxy: {
      "/api": "http://localhost:8776",
      "/sync": "http://localhost:8776",
      "/images": "http://localhost:8776",
    },
  },
  preview: {
    port: 4276,
  },
  test: {
    environment: "jsdom",
    // Without a real origin jsdom has no localStorage.
    environmentOptions: { jsdom: { url: "http://localhost" } },
    setupFiles: ["./src/test/setup.ts"],
    // The plugin's virtual module exists only in a Vite build; tests record what the app registers.
    alias: {
      "virtual:pwa-register": path.resolve(
        import.meta.dirname,
        "./src/test/fake-pwa-register.ts",
      ),
    },
  },
});
