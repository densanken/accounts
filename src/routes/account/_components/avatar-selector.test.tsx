import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LinkedAccount } from "../../../lib/idp/linked-accounts";
import { AvatarSelector } from "./avatar-selector";

const linkedAccounts: LinkedAccount[] = [
  {
    id: "la-discord",
    provider: "discord",
    providerAvatarUrl: "https://cdn.example.com/discord.png",
    providerDisplayName: "yusuke",
    guildMembership: "allowed",
  },
  {
    id: "la-github",
    provider: "github",
    providerAvatarUrl: null,
    providerDisplayName: "yusuke-gh",
    guildMembership: null,
  },
];

describe("AvatarSelector", () => {
  it("lists one option per linked account with a provider avatar, plus a no-picture option", async () => {
    const user = userEvent.setup();
    render(
      <AvatarSelector
        linkedAccounts={linkedAccounts}
        value={null}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("combobox"));

    expect(
      await screen.findByRole("option", { name: /yusuke \(Discord\)/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "画像を使用しない" })
    ).toBeInTheDocument();
  });

  it("omits linked accounts without a provider avatar", async () => {
    const user = userEvent.setup();
    render(
      <AvatarSelector
        linkedAccounts={linkedAccounts}
        value={null}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("option", { name: /yusuke \(Discord\)/ });

    expect(
      screen.queryByRole("option", { name: /GitHub/ })
    ).not.toBeInTheDocument();
  });

  it("shows the selected account's label in the trigger", () => {
    render(
      <AvatarSelector
        linkedAccounts={linkedAccounts}
        value="la-discord"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("yusuke (Discord)");
  });

  it("shows a placeholder in the trigger for a stale saved id", () => {
    render(
      <AvatarSelector
        linkedAccounts={linkedAccounts}
        value="la-removed"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("選択してください");
  });

  it("calls onChange with the linked account id when an option is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AvatarSelector
        linkedAccounts={linkedAccounts}
        value={null}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", {
      name: /yusuke \(Discord\)/,
    });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith("la-discord");
  });

  it("calls onChange with null when 'no picture' is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AvatarSelector
        linkedAccounts={linkedAccounts}
        value="la-discord"
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", {
      name: "画像を使用しない",
    });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("disables the trigger when `disabled` is set", () => {
    render(
      <AvatarSelector
        linkedAccounts={linkedAccounts}
        value={null}
        onChange={vi.fn()}
        disabled
      />
    );

    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
