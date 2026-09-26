import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAuthForTests } from "../../lib/auth/auth.server";
import {
  TEST_ENV,
  testRouterContext,
} from "../../lib/auth/test-helpers/context";
import { createAuthenticatedCookie } from "../../lib/auth/test-helpers/session";
import { middleware as guardMiddleware } from "../account/guard";
import { action } from "./logout";

const [guard] = guardMiddleware as [(typeof guardMiddleware)[number]];

const callAction = (cookie: string) =>
  action({
    request: new Request("https://accounts.example.com/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie },
    }),
    context: testRouterContext(),
    params: {},
  } as never);

describe("auth/logout action", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuthForTests();
  });

  it("clears the Accounts session and redirects to the IdP's RP-Initiated Logout endpoint", async () => {
    const cookie = await createAuthenticatedCookie();

    const response = await callAction(cookie);

    expect(response.status).toBe(302);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const location = new URL(response.headers.get("Location") ?? "");
    expect(`${location.origin}${location.pathname}`).toBe(
      `${TEST_ENV.IDP_ISSUER}/oauth/logout`
    );
    expect(location.searchParams.get("client_id")).toBe(
      TEST_ENV.OIDC_CLIENT_ID
    );
    expect(location.searchParams.get("post_logout_redirect_uri")).toBe(
      TEST_ENV.OIDC_POST_LOGOUT_REDIRECT_URI
    );

    const clearedCookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");

    // "/" itself no longer redirects unauthenticated visitors, so verify the
    // session was actually cleared via a guarded route instead.
    let guardResponse: Response | undefined;
    try {
      await guard(
        {
          request: new Request("https://accounts.example.com/connections", {
            headers: { Cookie: clearedCookie },
          }),
          context: testRouterContext(),
          params: {},
        } as never,
        async () => new Response(null, { status: 204 })
      );
    } catch (thrown) {
      guardResponse = thrown as Response;
    }
    expect(guardResponse?.status).toBe(302);
    expect(guardResponse?.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2Fconnections"
    );
  });

  it("clears the session without waiting for an unavailable IdP", async () => {
    const cookie = await createAuthenticatedCookie();
    resetAuthForTests();
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    const response = await callAction(cookie);

    expect(response.status).toBe(302);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
