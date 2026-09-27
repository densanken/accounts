import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, useSearchParams } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../../../lib/query/client";
import { queryKeys } from "../../../../lib/query/keys";
import { ConnectionsList } from "./connections-list";

const IDP_ORIGIN = "https://idp.example.com";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Stubs `fetch` for the linked-accounts list and DELETE unlink calls.
 * `deleteStatus: "pending"`/`"network-error"` simulate a stuck or failed
 * DELETE; a 404 also drops the account, as if already unlinked elsewhere.
 */
const stubFetch = ({
  linkedAccounts = [],
  listStatus = 200,
  deleteStatus = 204,
  deleteErrorBody = {},
}: {
  linkedAccounts?: Array<{
    id: string;
    provider: string;
    providerAvatarUrl: string | null;
    providerDisplayName: string | null;
    guildMembership: "allowed" | "denied" | null;
  }>;
  listStatus?: number;
  deleteStatus?: number | "pending" | "network-error";
  deleteErrorBody?: unknown;
} = {}) => {
  let current = [...linkedAccounts];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === `${IDP_ORIGIN}/users/me/linked-accounts`) {
      return jsonResponse(listStatus, { linkedAccounts: current });
    }
    if (
      url.startsWith(`${IDP_ORIGIN}/auth/link/`) &&
      init?.method === "DELETE"
    ) {
      if (deleteStatus === "pending") return new Promise<Response>(() => {});
      if (deleteStatus === "network-error") throw new Error("network down");
      if (deleteStatus !== 204 && deleteStatus !== 404)
        return jsonResponse(deleteStatus, deleteErrorBody);
      const id = url.split("/").pop();
      current = current.filter((account) => account.id !== id);
      if (deleteStatus === 404) return jsonResponse(404, deleteErrorBody);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const renderConnectionsList = ({
  initialEntries = ["/connections"],
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
}: {
  initialEntries?: string[];
  queryClient?: QueryClient;
} = {}) => {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ idpOrigin: IDP_ORIGIN }),
      children: [
        {
          path: "connections",
          Component: () => {
            // Exposes the current URL's query string so tests can check the
            // link-result cleanup without reaching into router internals.
            const [searchParams] = useSearchParams();
            return (
              <QueryClientProvider client={queryClient}>
                <div data-testid="search-params">{searchParams.toString()}</div>
                <ConnectionsList />
              </QueryClientProvider>
            );
          },
        },
      ],
    },
  ]);

  return {
    ...render(
      <Stub
        initialEntries={initialEntries}
        hydrationData={{ loaderData: { root: { idpOrigin: IDP_ORIGIN } } }}
      />
    ),
    queryClient,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConnectionsList", () => {
  it("renders each Connect form as a POST to that provider's link endpoint", async () => {
    stubFetch();
    renderConnectionsList();

    for (const [provider, label] of [
      ["discord", "Discordを連携する"],
      ["github", "GitHubを連携する"],
      ["google", "Googleを連携する"],
    ] as const) {
      const button = await screen.findByRole("button", { name: label });
      const form = button.closest("form");
      expect(form).toHaveAttribute("method", "post");
      expect(form).toHaveAttribute(
        "action",
        `${IDP_ORIGIN}/auth/link/${provider}`
      );
    }
  });

  it("shows connected accounts with a Disconnect button", async () => {
    stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
    });
    renderConnectionsList();

    expect(await screen.findByText("yusuke-gh")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "連携解除" })
    ).toBeInTheDocument();
  });

  it("still offers a Connect button to add another account once a provider is linked", async () => {
    stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
    });
    renderConnectionsList();

    await screen.findByText("yusuke-gh");
    const addAnother = await screen.findByRole("button", {
      name: "別のGitHubアカウントを連携する",
    });
    const form = addAnother.closest("form");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", `${IDP_ORIGIN}/auth/link/github`);
  });

  it("shows an error banner when the list fails to load", async () => {
    stubFetch({ listStatus: 500 });
    renderConnectionsList();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "連携アカウントを読み込めませんでした。"
    );
  });

  it("keeps the Discord-only unlink rules scoped to Discord (a GitHub account is unaffected)", async () => {
    stubFetch({
      linkedAccounts: [
        {
          id: "la-discord",
          provider: "discord",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke",
          guildMembership: "denied",
        },
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
    });
    renderConnectionsList();

    await screen.findByText("yusuke");
    await screen.findByText("yusuke-gh");

    const [discordButton, githubButton] = screen.getAllByRole("button", {
      name: "連携解除",
    });
    expect(discordButton).toBeDisabled();
    expect(githubButton).toBeEnabled();

    const discordSection = screen
      .getByRole("heading", { name: "Discord" })
      .closest("section");
    expect(discordSection).not.toBeNull();
    expect(
      await within(discordSection as HTMLElement).findByText(
        "現在サーバーメンバーのDiscordアカウントがないため、ログインできない可能性があります。サーバーに参加してから再度ログインしてください。"
      )
    ).toBeInTheDocument();
  });

  it.each([
    {
      name: "a single allowed account (the last Discord account)",
      memberships: ["allowed"],
      disabledIndexes: [0],
      hint: "1件以上連携させる必要があります。",
      warning: false,
    },
    {
      name: "a single denied account (the last Discord account, and all denied)",
      memberships: ["denied"],
      disabledIndexes: [0],
      hint: "1件以上連携させる必要があります。",
      warning: true,
    },
    {
      name: "a single unchecked account (the last Discord account)",
      memberships: [null],
      disabledIndexes: [0],
      hint: "1件以上連携させる必要があります。",
      warning: false,
    },
    {
      name: "two denied accounts (all denied, but neither is the last one)",
      memberships: ["denied", "denied"],
      disabledIndexes: [],
      hint: null,
      warning: true,
    },
    {
      name: "a denied and an unchecked account",
      memberships: ["denied", null],
      disabledIndexes: [],
      hint: null,
      warning: false,
    },
    {
      name: "two allowed accounts and a denied one",
      memberships: ["allowed", "allowed", "denied"],
      disabledIndexes: [],
      hint: null,
      warning: false,
    },
    {
      name: "an allowed account and a denied one",
      memberships: ["allowed", "denied"],
      disabledIndexes: [0],
      hint: "サーバーメンバーのアカウントを1件以上残す必要があります。",
      warning: false,
    },
    {
      name: "an allowed account and an unchecked one",
      memberships: ["allowed", null],
      disabledIndexes: [0],
      hint: "サーバーメンバーのアカウントを1件以上残す必要があります。",
      warning: false,
    },
  ] as const)(
    "sets Disconnect disabled/hint/warning state for $name",
    async ({ memberships, disabledIndexes, hint, warning }) => {
      stubFetch({
        linkedAccounts: memberships.map((guildMembership, index) => ({
          id: `la-discord-${index}`,
          provider: "discord",
          providerAvatarUrl: null,
          providerDisplayName: `yusuke${index}`,
          guildMembership,
        })),
      });
      renderConnectionsList();

      await screen.findByText("yusuke0");
      const buttons = screen.getAllByRole("button", { name: "連携解除" });
      expect(buttons).toHaveLength(memberships.length);
      buttons.forEach((button, index) => {
        if ((disabledIndexes as readonly number[]).includes(index)) {
          expect(button).toBeDisabled();
        } else {
          expect(button).toBeEnabled();
        }
      });

      const lastDiscordHint = "1件以上連携させる必要があります。";
      const lastAllowedHint =
        "サーバーメンバーのアカウントを1件以上残す必要があります。";
      const lastDiscordCount = screen.queryAllByText(lastDiscordHint).length;
      const lastAllowedCount = screen.queryAllByText(lastAllowedHint).length;
      expect(lastDiscordCount).toBe(
        hint === lastDiscordHint ? disabledIndexes.length : 0
      );
      expect(lastAllowedCount).toBe(
        hint === lastAllowedHint ? disabledIndexes.length : 0
      );

      const warningText =
        "現在サーバーメンバーのDiscordアカウントがないため、ログインできない可能性があります。サーバーに参加してから再度ログインしてください。";
      if (warning) {
        expect(await screen.findByText(warningText)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(warningText)).not.toBeInTheDocument();
      }
    }
  );

  it("shows each Discord account's guild-membership badge", async () => {
    stubFetch({
      linkedAccounts: [
        {
          id: "la-discord-1",
          provider: "discord",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke",
          guildMembership: "allowed",
        },
        {
          id: "la-discord-2",
          provider: "discord",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke2",
          guildMembership: "denied",
        },
        {
          id: "la-discord-3",
          provider: "discord",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke3",
          guildMembership: null,
        },
      ],
    });
    renderConnectionsList();

    await screen.findByText("yusuke");
    expect(screen.getByText("サーバーメンバー")).toBeInTheDocument();
    expect(screen.getByText("サーバー未参加")).toBeInTheDocument();
    expect(screen.getByText("未確認")).toBeInTheDocument();
  });

  it("does not show a guild-membership badge for a non-Discord account", async () => {
    stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
    });
    renderConnectionsList();

    await screen.findByText("yusuke-gh");
    expect(screen.queryByText("未確認")).not.toBeInTheDocument();
  });

  it("shows the target account in the confirmation dialog", async () => {
    const user = userEvent.setup();
    stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
    });
    renderConnectionsList();

    await user.click(await screen.findByRole("button", { name: "連携解除" }));
    const dialog = await screen.findByRole("alertdialog");

    expect(within(dialog).getByText("yusuke-gh")).toBeInTheDocument();
  });

  it("unlinks an account after confirming in the dialog, and invalidates linked-accounts and profile", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
    });
    const { queryClient } = renderConnectionsList();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("button", { name: "連携解除" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "連携解除" }));

    await waitFor(() => {
      expect(screen.queryByText("yusuke-gh")).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole("button", { name: "GitHubを連携する" })
    ).toBeInTheDocument();
    const [deleteUrl, deleteInit] =
      fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE") ?? [];
    expect(deleteUrl).toBe(`${IDP_ORIGIN}/auth/link/github/la-github`);
    expect(deleteInit?.method).toBe("DELETE");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.linkedAccounts,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.profile,
    });
  });

  it("does not unlink when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
    });
    renderConnectionsList();

    await user.click(await screen.findByRole("button", { name: "連携解除" }));
    await user.click(await screen.findByRole("button", { name: "キャンセル" }));

    expect(screen.getByText("yusuke-gh")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")
    ).toBe(false);
  });

  it("opens the dialog via keyboard activation, moves focus into it, and returns focus to the trigger on Escape", async () => {
    const user = userEvent.setup();
    stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
    });
    renderConnectionsList();

    const trigger = await screen.findByRole("button", { name: "連携解除" });
    trigger.focus();
    await user.keyboard("{Enter}");

    const dialog = await screen.findByRole("alertdialog");
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("ignores Escape while the unlink request is pending", async () => {
    const user = userEvent.setup();
    stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
      deleteStatus: "pending",
    });
    renderConnectionsList();

    await user.click(await screen.findByRole("button", { name: "連携解除" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "連携解除" }));
    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "連携解除" })
      ).toBeDisabled();
    });

    await user.keyboard("{Escape}");

    // `data-open`/`data-closed` (not just presence in the DOM) is the
    // reliable signal here - Base UI keeps a closing popup mounted through
    // its exit animation, so a lingering element wouldn't by itself prove
    // Escape was ignored.
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toHaveAttribute("data-open");
    });
  });

  it("keeps the Connect and Disconnect buttons reachable via Tab", async () => {
    const user = userEvent.setup();
    stubFetch({
      linkedAccounts: [
        {
          id: "la-discord",
          provider: "discord",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke",
          guildMembership: "allowed",
        },
        {
          id: "la-discord-2",
          provider: "discord",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-alt",
          guildMembership: "allowed",
        },
      ],
    });
    renderConnectionsList();
    await screen.findByText("yusuke");

    // Two allowed Discord accounts, so every button on the page (both
    // Disconnects, "add another Discord account", and one Connect button
    // per unlinked Provider) is enabled - Tabbing that many times from the
    // top of the page should visit every one of them, in DOM order.
    const enabledButtons = screen
      .getAllByRole("button")
      .filter((button) => !(button as HTMLButtonElement).disabled);

    const visited = new Set<Element>();
    for (let i = 0; i < enabledButtons.length; i++) {
      await user.tab();
      if (document.activeElement) visited.add(document.activeElement);
    }

    for (const button of enabledButtons) {
      expect(visited).toContain(button);
    }
  });

  it("clears a previous error when the dialog is reopened", async () => {
    const user = userEvent.setup();
    stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
      deleteStatus: 500,
    });
    renderConnectionsList();

    await user.click(await screen.findByRole("button", { name: "連携解除" }));
    let dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "連携解除" }));
    await within(dialog).findByText("連携解除に失敗しました。");

    await user.click(
      within(dialog).getByRole("button", { name: "キャンセル" })
    );
    await user.click(await screen.findByRole("button", { name: "連携解除" }));
    dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).queryByText("連携解除に失敗しました。")
    ).not.toBeInTheDocument();
  });

  it.each([
    {
      label: "last_discord_account error",
      // Two denied accounts, not one: a single Discord account would
      // already be disabled by the client-side last-Discord rule, and this
      // error is meant to simulate the IdP rejecting an otherwise-enabled
      // Disconnect.
      linkedAccounts: [
        {
          id: "la-discord-1",
          provider: "discord",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke",
          guildMembership: "denied",
        },
        {
          id: "la-discord-2",
          provider: "discord",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke2",
          guildMembership: "denied",
        },
      ],
      deleteStatus: 400,
      deleteErrorBody: { error: "last_discord_account" },
      message: "1件以上連携させる必要があります。",
    },
    {
      label: "network failure",
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
      deleteStatus: "network-error",
      deleteErrorBody: {},
      message: "連携解除に失敗しました。",
    },
  ] as const)(
    "shows an error inside the dialog on $label",
    async ({ linkedAccounts, deleteStatus, deleteErrorBody, message }) => {
      const user = userEvent.setup();
      stubFetch({
        linkedAccounts: [...linkedAccounts],
        deleteStatus,
        deleteErrorBody,
      });
      renderConnectionsList();

      const triggers = await screen.findAllByRole("button", {
        name: "連携解除",
      });
      // biome-ignore lint/style/noNonNullAssertion: at least one row exists above.
      await user.click(triggers[0]!);
      const dialog = await screen.findByRole("alertdialog");
      await user.click(
        within(dialog).getByRole("button", { name: "連携解除" })
      );

      expect(await within(dialog).findByText(message)).toBeInTheDocument();
    }
  );

  it("treats a 404 (already unlinked elsewhere) as success: closes the dialog without an error and removes the stale row", async () => {
    const user = userEvent.setup();
    stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
      deleteStatus: 404,
      deleteErrorBody: { error: "linked_account_not_found" },
    });
    renderConnectionsList();

    await user.click(await screen.findByRole("button", { name: "連携解除" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "連携解除" }));

    // Nothing left to unlink, so this isn't shown to the user as a failure -
    // the dialog closes just like a successful unlink would.
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText("連携解除に失敗しました。")
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("yusuke-gh")).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole("button", { name: "GitHubを連携する" })
    ).toBeInTheDocument();
  });

  it("redirects to login on a 401 from unlink (shared unauthorized handling)", async () => {
    const user = userEvent.setup();
    stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
      deleteStatus: 401,
    });
    const assign = vi.fn();
    vi.stubGlobal("location", {
      pathname: "/connections",
      search: "",
      assign,
    });
    // The redirect-on-401 behavior lives in the shared QueryClient (see
    // lib/query/client.ts), not in this component, so it's exercised here
    // with the real client rather than the bare test one.
    renderConnectionsList({ queryClient: createQueryClient() });

    await user.click(await screen.findByRole("button", { name: "連携解除" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "連携解除" }));

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(
        "/auth/login?return_to=%2Fconnections"
      );
    });
  });

  it("disables Confirm and blocks a second submit while the request is pending", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({
      linkedAccounts: [
        {
          id: "la-github",
          provider: "github",
          providerAvatarUrl: null,
          providerDisplayName: "yusuke-gh",
          guildMembership: null,
        },
      ],
      deleteStatus: "pending",
    });
    renderConnectionsList();

    await user.click(await screen.findByRole("button", { name: "連携解除" }));
    const dialog = await screen.findByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", {
      name: "連携解除",
    });
    await user.click(confirmButton);

    await waitFor(() => expect(confirmButton).toBeDisabled());
    // A disabled button ignores further clicks, so this must not add a
    // second DELETE call.
    await user.click(confirmButton);

    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE")
    ).toHaveLength(1);
  });

  it("shows a success banner for a linked=true callback and removes it from the URL", async () => {
    stubFetch();
    renderConnectionsList({ initialEntries: ["/connections?linked=true"] });

    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("アカウントを連携しました。");
    await waitFor(() => {
      expect(screen.getByTestId("search-params")).toBeEmptyDOMElement();
    });
    // The URL cleanup shouldn't hide the banner it was cleaning up after.
    expect(screen.getByRole("status")).toHaveTextContent(
      "アカウントを連携しました。"
    );
  });

  it.each([
    ["access_denied", "連携がキャンセルされました。"],
    [
      "account_already_linked",
      "このアカウントはすでにCCS IDに連携されています。",
    ],
    ["login_forbidden", "セッションが切れています。再度ログインしてください。"],
    ["provider_unconfigured", "このサービスとの連携は現在利用できません。"],
    ["something_unmapped", "アカウントの連携に失敗しました。"],
  ] as const)(
    "shows the message for a %s error callback and removes it from the URL",
    async (code, message) => {
      stubFetch();
      renderConnectionsList({
        initialEntries: [`/connections?error=${code}`],
      });

      const banner = await screen.findByRole("alert");
      expect(banner).toHaveTextContent(message);
      await waitFor(() => {
        expect(screen.getByTestId("search-params")).toBeEmptyDOMElement();
      });
      // The URL cleanup shouldn't hide the banner it was cleaning up after.
      expect(screen.getByRole("alert")).toHaveTextContent(message);
    }
  );
});
