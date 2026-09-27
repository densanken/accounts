import { afterEach, describe, expect, it, vi } from "vitest";
import { getProfile, updateProfile } from "./profile";

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

const profileBody = {
  name: "Yusuke",
  bio: null,
  picture: null,
  pictureLinkedAccountId: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getProfile", () => {
  it("fetches /users/me and returns the parsed profile", async () => {
    const fetchMock = stubFetch(jsonResponse(200, profileBody));

    await expect(getProfile(ORIGIN)).resolves.toEqual(profileBody);

    const [url] = fetchMock.mock.lastCall ?? [];
    expect(url).toBe("https://idp.example.com/users/me");
  });
});

describe("updateProfile", () => {
  it("PATCHes /users/me with the given fields and returns the updated profile", async () => {
    const updatedProfile = { ...profileBody, name: "Yusuke2" };
    const fetchMock = stubFetch(jsonResponse(200, updatedProfile));

    await expect(updateProfile(ORIGIN, { name: "Yusuke2" })).resolves.toEqual(
      updatedProfile
    );

    const [url, init] = fetchMock.mock.lastCall ?? [];
    expect(url).toBe("https://idp.example.com/users/me");
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBe(JSON.stringify({ name: "Yusuke2" }));
  });
});
