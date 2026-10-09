import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach } from "vitest";
import { FakeResizeObserver } from "./fake-resize-observer";

// Without Vitest globals mode, Testing Library's auto-cleanup never registers.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  // Sonner keeps its toasts in module state and shows any still open to the next test's toaster.
  toast.dismiss();
});

// Node's experimental localStorage global (Node >= 25) shadows jsdom's and does nothing without --localstorage-file.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

Object.defineProperty(window, "localStorage", {
  writable: true,
  value: new MemoryStorage(),
});

// jsdom has no isSecureContext; the app is tested as on the HTTPS address unless a test spies otherwise.
Object.defineProperty(window, "isSecureContext", {
  configurable: true,
  get: () => true,
});

// jsdom does not implement scrolling; the router scrolls to the top on every navigation.
window.scrollTo = () => {};
// The type-ahead scrolls its box and its highlighted row into view.
Element.prototype.scrollIntoView = () => {};

// jsdom has no matchMedia; the toaster reads the system theme through it.
window.matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});

// jsdom has no pointer capture; the toaster captures the pointer for a swipe.
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.hasPointerCapture = () => false;

// jsdom has no ResizeObserver; tests report sizes through resizeTo.
window.ResizeObserver = FakeResizeObserver;
