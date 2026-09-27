import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../lib/query/keys";
import { ProfileForm } from "./profile-form";

const IDP_ORIGIN = "https://idp.example.com";

const profileBody = {
  name: "Yusuke",
  bio: "hello",
  picture: null,
  pictureLinkedAccountId: null,
};

const linkedAccountsBody = {
  linkedAccounts: [
    {
      id: "la-discord",
      provider: "discord",
      providerAvatarUrl: "https://cdn.example.com/discord.png",
      providerDisplayName: "yusuke",
    },
    {
      id: "la-github",
      provider: "github",
      providerAvatarUrl: null,
      providerDisplayName: "yusuke-gh",
    },
  ],
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Stubs `fetch` with an in-memory profile that a successful PATCH mutates
 * and echoes back in full, matching the real IdP's response. `linkedAccounts`
 * controls that endpoint: "ok" (default), "error" (500), or "pending" (a
 * request that never resolves, to simulate a still-loading query).
 */
const stubFetch = ({
  profileStatus = 200,
  patchStatus = 200,
  patchErrorBody = {},
  initialProfile = profileBody,
  linkedAccounts = "ok",
}: {
  profileStatus?: number;
  patchStatus?: number;
  patchErrorBody?: unknown;
  initialProfile?: Record<string, unknown>;
  linkedAccounts?: "ok" | "error" | "pending";
} = {}) => {
  let currentProfile: Record<string, unknown> = { ...initialProfile };

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === `${IDP_ORIGIN}/users/me` && init?.method === "PATCH") {
      if (patchStatus !== 200) return jsonResponse(patchStatus, patchErrorBody);
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      currentProfile = { ...currentProfile, ...body };
      return jsonResponse(200, currentProfile);
    }
    if (url === `${IDP_ORIGIN}/users/me`) {
      return jsonResponse(profileStatus, currentProfile);
    }
    if (url === `${IDP_ORIGIN}/users/me/linked-accounts`) {
      if (linkedAccounts === "pending") return new Promise<Response>(() => {});
      if (linkedAccounts === "error") return jsonResponse(500, {});
      return jsonResponse(200, linkedAccountsBody);
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const renderProfileForm = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ idpOrigin: IDP_ORIGIN }),
      Component: () => (
        <QueryClientProvider client={queryClient}>
          <ProfileForm />
        </QueryClientProvider>
      ),
    },
  ]);

  return {
    ...render(
      <Stub
        initialEntries={["/"]}
        hydrationData={{ loaderData: { root: { idpOrigin: IDP_ORIGIN } } }}
      />
    ),
    queryClient,
  };
};

/** The parsed body of the first PATCH to the profile, if any. */
const patchBody = (fetchMock: ReturnType<typeof stubFetch>) => {
  const call = fetchMock.mock.calls.find(
    ([url, init]) =>
      url === `${IDP_ORIGIN}/users/me` && init?.method === "PATCH"
  );
  return call && JSON.parse(String(call[1]?.body));
};

const findEditButton = () => screen.findByRole("button", { name: "編集" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProfileForm", () => {
  it("shows the profile read-only by default", async () => {
    stubFetch();
    renderProfileForm();

    expect(
      await screen.findByRole("heading", { name: "Yusuke" })
    ).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument();
    expect(screen.queryByLabelText("表示名")).not.toBeInTheDocument();
  });

  it("shows a muted placeholder for an empty name and bio", async () => {
    stubFetch({ initialProfile: { ...profileBody, name: null, bio: null } });
    renderProfileForm();

    expect(
      await screen.findByRole("heading", { name: "名前未設定" })
    ).toBeInTheDocument();
    expect(screen.getByText("未設定")).toBeInTheDocument();
  });

  it("shows an error banner when the profile fails to load", async () => {
    stubFetch({ profileStatus: 500 });
    renderProfileForm();

    expect(
      await screen.findByText("プロフィールを読み込めませんでした。")
    ).toBeInTheDocument();
  });

  it("shows the edit form pre-filled with the current profile", async () => {
    stubFetch();
    const user = userEvent.setup();
    renderProfileForm();

    await user.click(await findEditButton());

    expect(screen.getByLabelText("表示名")).toHaveFocus();
    expect(screen.getByLabelText("表示名")).toHaveValue("Yusuke");
    expect(screen.getByLabelText("自己紹介")).toHaveValue("hello");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("does not allow saving an empty name", async () => {
    stubFetch();
    const user = userEvent.setup();
    renderProfileForm();

    await user.click(await findEditButton());
    await user.clear(screen.getByLabelText("表示名"));

    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("keeps an unselectable saved picture id untouched when saving an unrelated field", async () => {
    const fetchMock = stubFetch({
      initialProfile: { ...profileBody, pictureLinkedAccountId: "la-removed" },
    });
    const user = userEvent.setup();
    renderProfileForm();

    await user.click(await findEditButton());

    // The saved id no longer names a candidate, so the trigger placeholders.
    expect(screen.getByRole("combobox")).toHaveTextContent("選択してください");

    await user.type(screen.getByLabelText("表示名"), "!");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(patchBody(fetchMock)).toEqual({
        name: "Yusuke!",
      });
    });
  });

  it("diffs against the profile as it was when editing started, not a later background refetch", async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    const { queryClient } = renderProfileForm();

    await user.click(await findEditButton());

    // Simulate a background refetch (e.g. from another tab) changing the
    // name while the user is still editing.
    queryClient.setQueryData(queryKeys.profile, {
      ...profileBody,
      name: "Changed Elsewhere",
    });

    await user.type(screen.getByLabelText("自己紹介"), "!");
    await user.click(screen.getByRole("button", { name: "保存" }));

    // Only bio was actually edited - name must not be sent, even though the
    // live profile's name now differs from what the form was seeded with.
    await waitFor(() => {
      expect(patchBody(fetchMock)).toEqual({ bio: "hello!" });
    });
  });

  it("keeps the saved profile when a GET started before the save lands after it", async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    const { queryClient } = renderProfileForm();

    await user.click(await findEditButton());

    // A background refetch whose (pre-save) response arrives late.
    let resolveStaleGet: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveStaleGet = resolve;
        })
    );
    const staleRefetch = queryClient.refetchQueries({
      queryKey: queryKeys.profile,
    });

    await user.clear(screen.getByLabelText("表示名"));
    await user.type(screen.getByLabelText("表示名"), "New Name");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(
      await screen.findByRole("heading", { name: "New Name" })
    ).toBeInTheDocument();

    resolveStaleGet(jsonResponse(200, profileBody));
    await staleRefetch;

    expect(queryClient.getQueryData(queryKeys.profile)).toMatchObject({
      name: "New Name",
    });
    expect(
      screen.getByRole("heading", { name: "New Name" })
    ).toBeInTheDocument();
  });

  it("still shows the profile, with a note instead of the picture selector, when linked accounts fail to load", async () => {
    stubFetch({ linkedAccounts: "error" });
    const user = userEvent.setup();
    renderProfileForm();

    expect(
      await screen.findByRole("heading", { name: "Yusuke" })
    ).toBeInTheDocument();

    await user.click(await findEditButton());

    expect(screen.getByLabelText("表示名")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      await screen.findByText("画像候補を読み込めませんでした。")
    ).toBeInTheDocument();
  });

  it("still shows the profile and an editable form while linked accounts are still loading", async () => {
    stubFetch({ linkedAccounts: "pending" });
    const user = userEvent.setup();
    renderProfileForm();

    expect(
      await screen.findByRole("heading", { name: "Yusuke" })
    ).toBeInTheDocument();

    await user.click(await findEditButton());

    expect(
      screen.queryByText("画像候補を読み込めませんでした。")
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("表示名")).toBeEnabled();
    expect(screen.getByLabelText("自己紹介")).toBeEnabled();
  });

  it("saves only the changed field, and returns to view mode showing it", async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    renderProfileForm();

    await user.click(await findEditButton());
    const nameInput = screen.getByLabelText("表示名");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByRole("heading", { name: "New Name" })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("保存しました");
    expect(screen.queryByLabelText("表示名")).not.toBeInTheDocument();

    // Only the changed field is sent - bio and pictureLinkedAccountId are
    // untouched, so they're left out entirely.
    expect(patchBody(fetchMock)).toEqual({
      name: "New Name",
    });
  });

  it("sends bio as null when cleared", async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    renderProfileForm();

    await user.click(await findEditButton());
    await user.clear(screen.getByLabelText("自己紹介"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(patchBody(fetchMock)).toMatchObject({ bio: null });
    });
  });

  it("trims whitespace from name and bio before sending", async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    renderProfileForm();

    await user.click(await findEditButton());
    const nameInput = screen.getByLabelText("表示名");
    await user.clear(nameInput);
    await user.type(nameInput, "  Trimmed  ");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByRole("heading", { name: "Trimmed" })
    ).toBeInTheDocument();
    expect(patchBody(fetchMock)).toEqual({
      name: "Trimmed",
    });
  });

  it("discards edits when Cancel is clicked, without saving", async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    renderProfileForm();

    await user.click(await findEditButton());
    await user.type(screen.getByLabelText("表示名"), "!");
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(
      await screen.findByRole("heading", { name: "Yusuke" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("表示名")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "編集" })).toHaveFocus();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")
    ).toBe(false);
  });

  it("hides a previous saved message once the user starts editing again", async () => {
    stubFetch();
    const user = userEvent.setup();
    renderProfileForm();

    await user.click(await findEditButton());
    await user.type(screen.getByLabelText("表示名"), "!");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByRole("status");

    await user.click(await findEditButton());
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows a validation-specific message on a 400 response", async () => {
    stubFetch({ patchStatus: 400 });
    const user = userEvent.setup();
    renderProfileForm();

    await user.click(await findEditButton());
    await user.type(screen.getByLabelText("表示名"), "!");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByText("入力内容を確認してください。")
    ).toBeInTheDocument();
  });

  it.each([500, 403])(
    "shows a generic error banner on a %d response",
    async (patchStatus) => {
      stubFetch({ patchStatus });
      const user = userEvent.setup();
      renderProfileForm();

      await user.click(await findEditButton());
      await user.type(screen.getByLabelText("表示名"), "!");
      await user.click(screen.getByRole("button", { name: "保存" }));

      expect(
        await screen.findByText("プロフィールの更新に失敗しました。")
      ).toBeInTheDocument();
    }
  );
});
