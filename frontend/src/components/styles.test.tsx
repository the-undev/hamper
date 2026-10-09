import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { HamperDb } from "@/store/db";
import { StoreProvider } from "@/store/provider";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import { SavedField } from "./SavedField";
import { ToastProvider } from "./Toast";
import { TypeAhead } from "./TypeAhead";
import { buttonVariants } from "./ui/button";
import { Input } from "./ui/input";

let db: HamperDb | null = null;

afterEach(async () => {
  await db?.delete();
});

const placeholderClass = "placeholder:text-placeholder";

test("a_large_button_is_a_44px_target", () => {
  expect(buttonVariants({ size: "lg" })).toContain("min-h-11");
});

test("input_uses_the_placeholder_colour", () => {
  render(<Input aria-label="Size" placeholder="e.g. tin" />);

  expect(screen.getByRole("textbox", { name: "Size" }).className).toContain(
    placeholderClass,
  );
});

test("type_ahead_input_uses_the_placeholder_colour", () => {
  render(
    <TypeAhead
      label="Add an item"
      placeholder="Add an item…"
      options={[]}
      onPick={vi.fn()}
    />,
  );

  expect(screen.getByLabelText("Add an item").className).toContain(
    placeholderClass,
  );
});

test("saved_field_inputs_use_the_placeholder_colour", () => {
  db = freshDb();
  render(
    <StoreProvider db={db} loop={fakeLoop()}>
      <ToastProvider>
        <SavedField
          label="Size"
          value=""
          placeholder="e.g. tin"
          save={vi.fn()}
        />
        <SavedField
          label="Name"
          value=""
          placeholder="Name"
          save={vi.fn()}
          title
        />
      </ToastProvider>
    </StoreProvider>,
  );

  expect(screen.getByRole("textbox", { name: "Size" }).className).toContain(
    placeholderClass,
  );
  expect(screen.getByRole("textbox", { name: "Name" }).className).toContain(
    placeholderClass,
  );
});
