/** Opens the share sheet with the text, or copies it where there is none; returns what happened. */
export async function shareText(
  title: string,
  text: string,
): Promise<"shared" | "copied" | "unavailable"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
    } catch (error) {
      // Closing the share sheet rejects; that is the person's choice, not a failure.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        throw error;
      }
    }
    return "shared";
  }
  if (!navigator.clipboard) {
    return "unavailable";
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}

/** Saves the text as a .txt file named after the list, through a blob link. */
export function downloadText(fileName: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}
