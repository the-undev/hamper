import { expect, test } from "vitest";
import { manifest } from "./manifest";

test("the_manifest_opens_hamper_standalone_at_the_root_with_its_icons", () => {
  expect(manifest).toMatchObject({
    name: "hamper",
    short_name: "hamper",
    display: "standalone",
    start_url: "/",
    theme_color: "#2f7d4a",
    background_color: "#f3f4ef",
  });
  expect(
    manifest.icons?.map((icon) => `${icon.src} ${icon.sizes} ${icon.purpose}`),
  ).toEqual([
    "/icon-192.png 192x192 any",
    "/icon-512.png 512x512 any",
    "/icon-maskable-512.png 512x512 maskable",
  ]);
});
