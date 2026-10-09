import { screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";

/** Waits until the subject's counter shows the text; a live query re-renders a few ticks after its write commits, and a tap before then counts from the old value. */
export async function waitForCount(
  subject: string,
  shown: string,
): Promise<void> {
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: `One more ${subject}` })
        .previousElementSibling?.textContent,
    ).toBe(shown),
  );
}
