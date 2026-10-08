import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Index } from "./index";

test("the index route shows the hamper heading", () => {
  render(<Index />);

  expect(
    screen.getByRole("heading", { level: 1, name: "hamper" }),
  ).toBeInTheDocument();
});
