import * as v from "valibot";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdpApiError, idpFetch } from "./client";

const ORIGIN = "https://idp.example.com";
const schema = v.object({ id: v.string() });

const stubFetch = (response: Response) => {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) => response
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

/** The args `fetch` was last called with, asserting it was called at all. */
const lastFetchCall = (fetchMock: ReturnType<typeof stubFetch>) => {
  const call = fetchMock.mock.lastCall;
  if (!call) throw new Error("fetch was not called");
  return call;
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("idpFetch", () => {
  it("requests the IdP origin plus path with credentials included", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { id: "1" }));

    await idpFetch(ORIGIN, "/users/me", schema);

    const [url, init] = lastFetchCall(fetchMock);
    expect(url).toBe("https://idp.example.com/users/me");
    expect(init?.credentials).toBe("include");
  });

  it("JSON-encodes `json` as the body and sets Content-Type: application/json", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { id: "1" }));

    await idpFetch(ORIGIN, "/users/me", schema, {
      method: "PATCH",
      json: { name: "a" },
    });

    const [, init] = lastFetchCall(fetchMock);
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ name: "a" }));
  });

  it("doesn't force a Content-Type on a request without `json`", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { id: "1" }));

    await idpFetch(ORIGIN, "/users/me", schema);

    const [, init] = lastFetchCall(fetchMock);
    const headers = new Headers(init?.headers);
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("parses and validates a 200 response", async () => {
    stubFetch(jsonResponse(200, { id: "1" }));

    await expect(idpFetch(ORIGIN, "/users/me", schema)).resolves.toEqual({
      id: "1",
    });
  });

  it("returns undefined for a 204 response without parsing a body", async () => {
    stubFetch(new Response(null, { status: 204 }));

    await expect(
      idpFetch(ORIGIN, "/users/me", v.undefined())
    ).resolves.toBeUndefined();
  });

  it.each([
    { status: 400, code: "validation" },
    { status: 401, code: "unauthorized" },
    { status: 403, code: "forbidden" },
    { status: 404, code: "unknown" },
    { status: 500, code: "server" },
  ])("throws a $code IdpApiError on $status", async ({ status, code }) => {
    stubFetch(new Response(null, { status }));

    const promise = idpFetch(ORIGIN, "/users/me", schema);

    await expect(promise).rejects.toBeInstanceOf(IdpApiError);
    await expect(promise).rejects.toMatchObject({ code, status });
  });

  it("uses the body's error code for a 400 last_discord_account response", async () => {
    stubFetch(jsonResponse(400, { error: "last_discord_account" }));

    const promise = idpFetch(ORIGIN, "/users/me", schema);

    await expect(promise).rejects.toMatchObject({
      code: "last_discord_account",
      status: 400,
    });
  });

  it("uses the body's error code for a 404 linked_account_not_found response", async () => {
    stubFetch(jsonResponse(404, { error: "linked_account_not_found" }));

    const promise = idpFetch(ORIGIN, "/users/me", schema);

    await expect(promise).rejects.toMatchObject({
      code: "linked_account_not_found",
      status: 404,
    });
  });

  it("falls back to the status mapping for an unrecognized body error code", async () => {
    stubFetch(jsonResponse(400, { error: "some_other_error" }));

    const promise = idpFetch(ORIGIN, "/users/me", schema);

    await expect(promise).rejects.toMatchObject({
      code: "validation",
      status: 400,
    });
  });

  it("falls back to the status mapping for a non-JSON error body", async () => {
    stubFetch(new Response("not json", { status: 400 }));

    const promise = idpFetch(ORIGIN, "/users/me", schema);

    await expect(promise).rejects.toMatchObject({
      code: "validation",
      status: 400,
    });
  });

  it("throws an unknown IdpApiError on malformed JSON", async () => {
    stubFetch(
      new Response("not json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(idpFetch(ORIGIN, "/users/me", schema)).rejects.toMatchObject({
      code: "unknown",
    });
  });

  it("throws an unknown IdpApiError when the response doesn't match the schema", async () => {
    stubFetch(jsonResponse(200, { id: 123 }));

    await expect(idpFetch(ORIGIN, "/users/me", schema)).rejects.toMatchObject({
      code: "unknown",
    });
  });

  it("throws a network IdpApiError when fetch itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    await expect(idpFetch(ORIGIN, "/users/me", schema)).rejects.toMatchObject({
      code: "network",
    });
  });
});
