import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAuthForTests } from "../../lib/auth/auth.server";
import {
  TEST_ENV,
  testRouterContext,
} from "../../lib/auth/test-helpers/context";
import { stubIdpFetch } from "../../lib/auth/test-helpers/idp";
import { loader } from "./login";

const callLoader = (url: string) =>
  loader({
    request: new Request(url),
    context: testRouterContext(),
    params: {},
  } as never);

describe("auth/login loader", () => {
  beforeEach(() => {
    resetAuthForTests();
    stubIdpFetch({ issuer: TEST_ENV.IDP_ISSUER });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuthForTests();
  });

  it("redirects to the IdP authorize endpoint with state, nonce, and PKCE", async () => {
    const response = await callLoader(
      "https://accounts.example.com/auth/login?return_to=/profile"
    );

    expect(response.status).toBe(302);

    const location = new URL(response.headers.get("Location") ?? "");
    expect(`${location.origin}${location.pathname}`).toBe(
      "https://id.example.com/oauth/authorize"
    );
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("client_id")).toBe("accounts-client");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://accounts.example.com/oauth/callback"
    );
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toBeTruthy();
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(location.searchParams.get("nonce")).toBeTruthy();

    const scope = location.searchParams.get("scope")?.split(" ") ?? [];
    expect(scope).toEqual(expect.arrayContaining(["openid", "profile"]));

    // The encrypted OAuth transaction (state/nonce/PKCE verifier/returnTo)
    // rides in this cookie - see auth.server.ts's stateless-mode comment.
    expect(response.headers.get("Set-Cookie")).toBeTruthy();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("still redirects when return_to is an off-site URL (sanitized to /)", async () => {
    const response = await callLoader(
      "https://accounts.example.com/auth/login?return_to=https://evil.example"
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location") ?? "");
    expect(location.hostname).toBe("id.example.com");
  });
});
