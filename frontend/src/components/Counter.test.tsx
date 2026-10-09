import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Counter } from "./Counter";

test("plus_and_minus_report_the_next_count", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Counter count={3} subject="Milk" onChange={onChange} />);

  await user.click(screen.getByRole("button", { name: "One more Milk" }));
  await user.click(screen.getByRole("button", { name: "One fewer Milk" }));

  expect(onChange.mock.calls).toEqual([[4], [2]]);
  expect(screen.getByText("3")).toBeInTheDocument();
});

test("the_buttons_stop_at_the_minimum_and_the_maximum", () => {
  const { rerender } = render(
    <Counter count={1} subject="Milk" onChange={vi.fn()} />,
  );
  expect(screen.getByRole("button", { name: "One fewer Milk" })).toBeDisabled();

  rerender(
    <Counter
      count={31}
      subject="day"
      max={31}
      format={(count) => `${count} days`}
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "One more day" })).toBeDisabled();
  expect(screen.getByText("31 days")).toBeInTheDocument();
});
