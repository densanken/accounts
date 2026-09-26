import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAuthForTests } from "../../lib/auth/auth.server";
import {
  TEST_ENV,
  testRouterContext,
} from "../../lib/auth/test-helpers/context";
import { stubIdpFetch } from "../../lib/auth/test-helpers/idp";
import { createAuthenticatedCookie } from "../../lib/auth/test-helpers/session";
import { middleware } from "./guard";

const [guard] = middleware as [(typeof middleware)[number]];
const NEXT_SENTINEL = new Response(null, { status: 204 });

const callGuard = (url: string, cookie?: string) =>
  guard(
    {
      request: new Request(url, {
        headers: cookie ? { Cookie: cookie } : undefined,
      }),
      context: testRouterContext(),
      params: {},
    } as never,
    async () => NEXT_SENTINEL
  );

describe("account guard middleware", () => {
  beforeEach(() => {
    resetAuthForTests();
    // getSession still triggers getAuth's IdP discovery fetch even with no
    // session cookie present.
    stubIdpFetch({ issuer: TEST_ENV.IDP_ISSUER });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuthForTests();
  });

  it("redirects to /auth/login with returnTo when there is no session", async () => {
    let response: Response | undefined;
    try {
      await callGuard("https://accounts.example.com/connections?tab=github");
    } catch (thrown) {
      response = thrown as Response;
    }

    expect(response?.status).toBe(302);
    expect(response?.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2Fconnections%3Ftab%3Dgithub"
    );
  });

  it("calls next() when an Accounts session cookie is present", async () => {
    const cookie = await createAuthenticatedCookie("/connections");

    const result = await callGuard(
      "https://accounts.example.com/connections",
      cookie
    );

    expect(result).toBe(NEXT_SENTINEL);
  });

  it("redirects when the session cookie is tampered with", async () => {
    const cookie = await createAuthenticatedCookie("/connections");
    const tampered = cookie.replace(
      /session_token=([^;]+)/,
      (_match, value: string) =>
        `session_token=${value.slice(0, -1)}${value.at(-1) === "a" ? "b" : "a"}`
    );

    let response: Response | undefined;
    try {
      await callGuard("https://accounts.example.com/connections", tampered);
    } catch (thrown) {
      response = thrown as Response;
    }

    expect(response?.status).toBe(302);
    expect(response?.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2Fconnections"
    );
  });
});
