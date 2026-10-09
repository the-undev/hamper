import { vi } from "vitest";
import type { AppUpdate } from "@/pwa/update";

/** An app update a test makes ready, with a spied reload. */
export interface FakeAppUpdate extends AppUpdate {
  makeReady(): void;
}

/** Builds an update that is not ready until the test says so. */
export function fakeAppUpdate(): FakeAppUpdate {
  let ready = false;
  const listeners = new Set<() => void>();
  return {
    isReady: () => ready,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reload: vi.fn(async () => {}),
    makeReady: () => {
      ready = true;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
