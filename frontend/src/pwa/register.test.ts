import { expect, test, vi } from "vitest";
import { registered, updateServiceWorker } from "@/test/fake-pwa-register";
import { registerServiceWorker } from "./register";

test("a_waiting_worker_makes_the_update_ready_and_reload_activates_it", async () => {
  const update = registerServiceWorker();
  const listener = vi.fn();
  update.subscribe(listener);
  expect(update.isReady()).toBe(false);

  registered.options?.onNeedRefresh?.();

  expect(update.isReady()).toBe(true);
  expect(listener).toHaveBeenCalledTimes(1);
  await update.reload();
  expect(updateServiceWorker).toHaveBeenCalledWith(true);
});
