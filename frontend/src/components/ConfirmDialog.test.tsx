import { render, screen } from "@testing-library/react";
import userEvent, {
  PointerEventsCheckLevel,
} from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

function OpenConfirm({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Delete Milk?"
      description="Milk leaves every list."
      confirmLabel="Delete"
      onConfirm={onConfirm}
      danger
    />
  );
}

test("a_tap_outside_leaves_the_confirm_open_and_cancel_closes_it", async () => {
  // A modal makes the page behind it ignore the pointer; the tap is sent anyway.
  const user = userEvent.setup({
    pointerEventsCheck: PointerEventsCheckLevel.Never,
  });
  const onConfirm = vi.fn();
  render(<OpenConfirm onConfirm={onConfirm} />);
  const confirm = screen.getByRole("alertdialog", { name: "Delete Milk?" });

  await user.click(document.body);
  expect(confirm).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
});

test("the_confirm_button_runs_the_action_and_closes", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(<OpenConfirm onConfirm={onConfirm} />);

  await user.click(screen.getByRole("button", { name: "Delete" }));

  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("alertdialog")).toBeNull();
});
