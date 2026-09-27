import { afterEach, describe, expect, it, vi } from "vitest";
import { getLinkedAccounts } from "./linked-accounts";

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
});
