import type { ManifestOptions } from "vite-plugin-pwa";

/** The web app manifest; its theme and background colours are both the light theme's `--accent`. */
export const manifest: Partial<ManifestOptions> = {
  name: "hamper",
  short_name: "hamper",
  description: "The household's meal plan and shopping list.",
  display: "standalone",
  start_url: "/",
  scope: "/",
  theme_color: "#2f7d4a",
  background_color: "#2f7d4a",
  icons: [
    {
      src: "/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};
