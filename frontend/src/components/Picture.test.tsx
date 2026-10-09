import { fireEvent, render } from "@testing-library/react";
import { expect, test } from "vitest";
import { Picture } from "./Picture";

test("renders_the_thumb_url_lazily", () => {
  const { container } = render(
    <Picture name="Curry" imageId="abc" size="card" />,
  );

  const image = container.querySelector("img");
  expect(image).toHaveAttribute("src", "/images/abc/thumb");
  expect(image).toHaveAttribute("loading", "lazy");
});

test("the_meal_screen_size_renders_the_large_url", () => {
  const { container } = render(
    <Picture name="Curry" imageId="abc" size="hero" />,
  );

  expect(container.querySelector("img")).toHaveAttribute(
    "src",
    "/images/abc/large",
  );
});

test("falls_back_to_the_placeholder_on_error", () => {
  const { container } = render(
    <Picture name="Curry" imageId="abc" size="row" />,
  );

  fireEvent.error(container.querySelector("img") as HTMLImageElement);

  expect(container.querySelector("img")).toBeNull();
  expect(container).toHaveTextContent("C");
});

test("shows_the_placeholder_without_an_image", () => {
  const { container } = render(
    <Picture name="Rice" imageId={null} size="row" />,
  );

  expect(container.querySelector("img")).toBeNull();
  expect(container).toHaveTextContent("R");
});
