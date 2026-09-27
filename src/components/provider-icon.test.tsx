import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LINK_PROVIDERS } from "../lib/idp/providers";
import { ProviderIcon } from "./provider-icon";

describe("ProviderIcon", () => {
  it.each(LINK_PROVIDERS)(
    "renders a decorative (aria-hidden) mark for %s",
    (provider) => {
      const { container } = render(<ProviderIcon provider={provider} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  );

  it("uses `currentColor` for the officially-monochrome GitHub mark, so it stays visible on a dark background", () => {
    const { container } = render(<ProviderIcon provider="github" />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "fill",
      "currentColor"
    );
  });
});
