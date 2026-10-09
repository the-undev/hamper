/** A visual viewport a test moves by hand, as a phone's keyboard would. */
export class FakeVisualViewport extends EventTarget {
  height = window.innerHeight;
  offsetTop = 0;

  /** Sets the visible height and how far it is panned down, then fires resize as the browser does. */
  moveTo(height: number, offsetTop: number): void {
    this.height = height;
    this.offsetTop = offsetTop;
    this.dispatchEvent(new Event("resize"));
  }
}

/** Gives the window a fake visual viewport, which jsdom lacks; the returned function takes it away again. */
export function installVisualViewport(): {
  viewport: FakeVisualViewport;
  uninstall: () => void;
} {
  const viewport = new FakeVisualViewport();
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: viewport,
  });
  return {
    viewport,
    uninstall: () => {
      Reflect.deleteProperty(window, "visualViewport");
    },
  };
}
