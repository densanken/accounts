import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("smoke test", () => {
  it("renders text into the DOM", () => {
    render(<h1>Hello</h1>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
