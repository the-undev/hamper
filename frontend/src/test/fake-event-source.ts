import type { RevisionEvents } from "@/sync/api";

type Listener = (event: MessageEvent) => void;

/** jsdom has no EventSource; tests drive events through this stub. */
export class FakeEventSource implements RevisionEvents {
  static instances: FakeEventSource[] = [];

  readonly url: string;
  closed = false;
  /** 0 until `open()`, 1 after it, 2 after `fail(true)` or `close()`; a test may set it. */
  readyState = 0;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    let typeListeners = this.listeners.get(type);
    if (!typeListeners) {
      typeListeners = new Set();
      this.listeners.set(type, typeListeners);
    }
    typeListeners.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  /** Delivers a named event whose data is the JSON of the value. */
  emit(type: string, data: unknown): void {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  /** Delivers `open`, as on connect and reconnect. */
  open(): void {
    this.readyState = 1;
    this.emit("open", null);
  }

  /** Delivers `error`; the browser retries unless `final`, which leaves the stream closed as Firefox does offline. */
  fail(final = false): void {
    this.readyState = final ? 2 : 0;
    this.emit("error", null);
  }

  static reset(): void {
    FakeEventSource.instances = [];
  }
}
