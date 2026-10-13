import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { quietStatus } from "@/test/fake-loop";
import { SyncIndicator, syncStateLabel } from "./SyncIndicator";

test("synced_shows_a_cloud_named_synced", () => {
  render(<SyncIndicator status={quietStatus} />);

  const slot = screen.getByRole("status", { name: "Synced" });
  expect(slot).toHaveAttribute("title", "Synced");
  expect(slot.querySelector("svg")).not.toBeNull();
});

test("state_label_for_the_in_sync_status_is_synced", () => {
  expect(syncStateLabel(quietStatus)).toBe("Synced");
});

test("sending_shows_a_spinner_named_syncing", () => {
  render(
    <SyncIndicator status={{ ...quietStatus, syncing: true, pending: 2 }} />,
  );

  const slot = screen.getByRole("status", { name: "Syncing" });
  expect(slot).toHaveAttribute("title", "Syncing");
  expect(slot.querySelector("svg")).not.toBeNull();
  expect(slot).not.toHaveTextContent("2");
});

test("waiting_shows_the_count_named_changes_to_send", () => {
  const { rerender } = render(
    <SyncIndicator status={{ ...quietStatus, pending: 3 }} />,
  );

  const slot = screen.getByRole("status", { name: "3 changes to send" });
  expect(slot).toHaveAttribute("title", "3 changes to send");
  expect(slot).toHaveTextContent("3");

  rerender(<SyncIndicator status={{ ...quietStatus, pending: 1 }} />);
  expect(
    screen.getByRole("status", { name: "1 change to send" }),
  ).toHaveTextContent("1");
});

test("offline_shows_a_crossed_cloud_whatever_else_applies", () => {
  render(
    <SyncIndicator
      status={{ ...quietStatus, online: false, syncing: true, pending: 2 }}
    />,
  );

  const slot = screen.getByRole("status", {
    name: "Offline. Changes are kept on this phone.",
  });
  expect(slot).toHaveAttribute(
    "title",
    "Offline. Changes are kept on this phone.",
  );
  expect(slot.querySelector("svg")).not.toBeNull();
  expect(slot).not.toHaveTextContent("2");
});
