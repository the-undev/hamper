/// <reference types="vitest/config" />
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
  ],
  server: {
    port: 5276,
    proxy: {
      "/api": "http://localhost:8776",
      "/sync": "http://localhost:8776",
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
  },
});
