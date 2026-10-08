import type { RevisionEvents } from "@/sync/api";

type Listener = (event: MessageEvent) => void;

/** jsdom has no EventSource; tests drive events through this stub. */
export class FakeEventSource implements RevisionEvents {
  static instances: FakeEventSource[] = [];

  readonly url: string;
  closed = false;
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
    this.emit("open", null);
  }

  /** Delivers `error`, as when the connection drops. */
  fail(): void {
    this.emit("error", null);
  }

  static reset(): void {
    FakeEventSource.instances = [];
  }
}
