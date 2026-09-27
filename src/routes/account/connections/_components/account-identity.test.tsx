import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LinkedAccount } from "../../../../lib/idp/linked-accounts";
import { AccountIdentity } from "./account-identity";

const account: LinkedAccount = {
  id: "la-1",
  provider: "github",
  providerAvatarUrl: null,
  providerDisplayName: "yusuke-gh",
  guildMembership: null,
};

describe("AccountIdentity", () => {
  it("shows the account's display name", () => {
    render(<AccountIdentity provider="github" account={account} />);

    expect(screen.getByText("yusuke-gh")).toBeInTheDocument();
  });

  it("falls back to the Provider's label when there's no display name", () => {
    render(
      <AccountIdentity
        provider="github"
        account={{ ...account, providerDisplayName: null }}
      />
    );

    expect(screen.getByText("GitHub")).toBeInTheDocument();
  });

  it("shows the Provider's mark as the avatar fallback when there's no avatar URL", () => {
    // jsdom never resolves a real `<img>` load, so a provided avatar URL
    // would leave the avatar stuck in a perpetual "loading" state instead of
    // ever showing the image - only the no-avatar-URL case (which resolves
    // synchronously to "error") is deterministic to test here.
    const { container } = render(
      <AccountIdentity provider="github" account={account} />
    );

    // `currentColor` identifies the GitHub mark specifically (the other two
    // Providers use a fixed brand color instead), so this also confirms the
    // fallback is the Provider's own mark, not some generic placeholder.
    expect(
      container.querySelector('[data-slot="avatar-fallback"] svg')
    ).toHaveAttribute("fill", "currentColor");
  });
});
