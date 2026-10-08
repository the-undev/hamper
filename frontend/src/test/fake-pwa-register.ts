import type { RegisterSWOptions } from "vite-plugin-pwa/types";
import { vi } from "vitest";

/** The options the app last registered with, for a test to call their callbacks. */
export const registered: { options: RegisterSWOptions | null } = {
  options: null,
};

/** The update function the fake registration returns. */
export const updateServiceWorker = vi.fn(async (_reloadPage?: boolean) => {});

/** Stands in for `virtual:pwa-register` under Vitest, recording the options. */
export function registerSW(
  options: RegisterSWOptions,
): (reloadPage?: boolean) => Promise<void> {
  registered.options = options;
  return updateServiceWorker;
}
