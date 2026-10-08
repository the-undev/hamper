import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { quietStatus } from "@/test/fake-loop";
import { SyncIndicator } from "./SyncIndicator";

test("synced_shows_nothing_and_has_no_name", () => {
  render(<SyncIndicator status={quietStatus} />);

  const slot = screen.getByRole("status");
  expect(slot).not.toHaveAttribute("aria-label");
  expect(slot).not.toHaveAttribute("title");
  expect(slot).toBeEmptyDOMElement();
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
