import { afterEach, describe, expect, it, vi } from "vitest";
import { IdpApiError } from "./client";
import { getLinkedAccounts, unlinkAccount } from "./linked-accounts";

const ORIGIN = "https://idp.example.com";

const stubFetch = (response: Response) => {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) => response
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getLinkedAccounts", () => {
  it("fetches /users/me/linked-accounts and unwraps the response", async () => {
    const linkedAccounts = [
      {
        id: "la-1",
        provider: "discord",
        providerAvatarUrl: "https://cdn.example.com/a.png",
        providerDisplayName: "yusuke",
        guildMembership: "allowed",
      },
    ];
    const fetchMock = stubFetch(jsonResponse(200, { linkedAccounts }));

    await expect(getLinkedAccounts(ORIGIN)).resolves.toEqual(linkedAccounts);

    const [url] = fetchMock.mock.lastCall ?? [];
    expect(url).toBe("https://idp.example.com/users/me/linked-accounts");
  });

  it("returns an empty array when there are no linked accounts", async () => {
    stubFetch(jsonResponse(200, { linkedAccounts: [] }));

    await expect(getLinkedAccounts(ORIGIN)).resolves.toEqual([]);
  });

  it("rejects an unrecognized guildMembership value", async () => {
    const linkedAccounts = [
      {
        id: "la-1",
        provider: "discord",
        providerAvatarUrl: null,
        providerDisplayName: "yusuke",
        guildMembership: "pending",
      },
    ];
    stubFetch(jsonResponse(200, { linkedAccounts }));

    await expect(getLinkedAccounts(ORIGIN)).rejects.toBeInstanceOf(IdpApiError);
  });
});

describe("unlinkAccount", () => {
  it("DELETEs the linked account and resolves on a 204", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(
      unlinkAccount(ORIGIN, "discord", "la-1")
    ).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.lastCall ?? [];
    expect(url).toBe("https://idp.example.com/auth/link/discord/la-1");
    expect(init?.method).toBe("DELETE");
  });

  it("surfaces the last-Discord-account error", async () => {
    stubFetch(
      new Response(JSON.stringify({ error: "last_discord_account" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    const error = await unlinkAccount(ORIGIN, "discord", "la-1").catch(
      (e) => e
    );
    expect(error).toBeInstanceOf(IdpApiError);
    expect((error as IdpApiError).code).toBe("last_discord_account");
  });
});
