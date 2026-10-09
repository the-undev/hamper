/** Every observer still connected, so a test can report a size to the ones watching an element. */
const observers = new Set<FakeResizeObserver>();

/** jsdom has no ResizeObserver; this one reports only the sizes a test gives it through resizeTo. */
export class FakeResizeObserver implements ResizeObserver {
  readonly targets = new Set<Element>();
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.add(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
    observers.delete(this);
  }
}

/** Tells every observer watching the element that it is now this many pixels tall. */
export function resizeTo(target: Element, height: number): void {
  const size = { blockSize: height, inlineSize: 0 };
  const entry: ResizeObserverEntry = {
    target,
    borderBoxSize: [size],
    contentBoxSize: [size],
    devicePixelContentBoxSize: [size],
    contentRect: new DOMRect(0, 0, 0, height),
  };
  for (const observer of observers) {
    if (observer.targets.has(target)) {
      observer.callback([entry], observer);
    }
  }
}
