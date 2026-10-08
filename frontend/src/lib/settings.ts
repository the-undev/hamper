/** Reads a per-device setting, or null when storage is empty or unavailable. */
export function readSetting(key: string): string | null {
  try {
    return window.localStorage.getItem(`hamper.${key}`);
  } catch {
    return null;
  }
}

/** Keeps a per-device setting; a browser that refuses storage just forgets it. */
export function writeSetting(key: string, value: string): void {
  try {
    window.localStorage.setItem(`hamper.${key}`, value);
  } catch {
    // Settings are conveniences; losing one changes nothing that matters.
  }
}
