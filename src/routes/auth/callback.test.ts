import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAuthForTests } from "../../lib/auth/auth.server";
import {
  TEST_ENV,
  testRouterContext,
} from "../../lib/auth/test-helpers/context";
import {
  generateTestIdpKeys,
  signTestIdToken,
  stubIdpFetch,
  type TestIdpKeys,
} from "../../lib/auth/test-helpers/idp";
import { loader as authLoader } from "./callback";
import { loader as loginLoader } from "./login";

const ISSUER = TEST_ENV.IDP_ISSUER;

/** Runs /auth/login and pulls the state/nonce it put on the authorize redirect, plus its Set-Cookie. */
const startLogin = async (returnTo = "/profile") => {
  const response = await loginLoader({
    request: new Request(
      `https://accounts.example.com/auth/login?return_to=${encodeURIComponent(returnTo)}`
    ),
    context: testRouterContext(),
    params: {},
  } as never);

  const location = new URL(response.headers.get("Location") ?? "");
  const cookie = (response.headers.get("Set-Cookie") ?? "").split(";")[0] ?? "";

  return {
    state: location.searchParams.get("state") ?? "",
    nonce: location.searchParams.get("nonce") ?? "",
    cookie,
  };
};

const callCallback = (query: string, cookie: string) =>
  authLoader({
    request: new Request(
      `https://accounts.example.com/oauth/callback?${query}`,
      { headers: { Cookie: cookie } }
    ),
    context: testRouterContext(),
    params: {},
  } as never);

const errorFromRedirect = (response: Response): string | null => {
  const location = new URL(
    response.headers.get("Location") ?? "",
    "https://accounts.example.com"
  );
  return location.searchParams.get("error");
};

describe("auth callback (mounted at /oauth/callback)", () => {
  let keys: TestIdpKeys;

  beforeEach(async () => {
    resetAuthForTests();
    keys = await generateTestIdpKeys();
    // /auth/login itself triggers the IdP discovery fetch (via getAuth), so
    // fetch must be stubbed before it runs; each test re-stubs the token
    // endpoint with the id_token it actually wants to present.
    stubIdpFetch({ issuer: ISSUER, keys, idToken: "" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuthForTests();
  });

  it("exchanges the code, verifies the ID token, creates a session, and redirects to return_to", async () => {
    const { state, nonce, cookie } = await startLogin("/profile");
    const idToken = await signTestIdToken(keys, {
      issuer: ISSUER,
      audience: TEST_ENV.OIDC_CLIENT_ID,
      subject: "user-1",
      nonce,
    });
    stubIdpFetch({ issuer: ISSUER, keys, idToken });

    const response = await callCallback(
      `code=abc&state=${state}&iss=${encodeURIComponent(ISSUER)}`,
      cookie
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/profile");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    // better-auth's stateless session cookie (JWE), not our own concern here.
    expect(response.headers.get("Set-Cookie")).toBeTruthy();
  });

  it("sends the authorization code request with code_verifier (PKCE) and Basic client auth", async () => {
    const { state, nonce, cookie } = await startLogin();
    const idToken = await signTestIdToken(keys, {
      issuer: ISSUER,
      audience: TEST_ENV.OIDC_CLIENT_ID,
      nonce,
    });
    const onTokenRequest = vi.fn();
    stubIdpFetch({ issuer: ISSUER, keys, idToken, onTokenRequest });

    await callCallback(
      `code=abc&state=${state}&iss=${encodeURIComponent(ISSUER)}`,
      cookie
    );

    expect(onTokenRequest).toHaveBeenCalledTimes(1);
    const [{ headers, body }] = onTokenRequest.mock.calls[0] as [
      { headers: Headers; body: URLSearchParams },
    ];
    expect(headers.get("Authorization")).toMatch(/^Basic /);
    expect(body.get("code_verifier")).toBeTruthy();
    expect(body.get("code")).toBe("abc");
  });

  it("rejects a callback without a code", async () => {
    const { state, cookie } = await startLogin();

    const response = await callCallback(
      `state=${state}&iss=${encodeURIComponent(ISSUER)}`,
      cookie
    );

    expect(response.status).toBe(302);
    expect(errorFromRedirect(response)).toBe("no_code");
  });

  it("forwards an error returned by the IdP", async () => {
    const { state, cookie } = await startLogin();

    const response = await callCallback(
      `error=access_denied&state=${state}&iss=${encodeURIComponent(ISSUER)}`,
      cookie
    );

    expect(response.status).toBe(302);
    expect(errorFromRedirect(response)).toBe("access_denied");
  });

  it("rejects a mismatched iss without hitting the token endpoint", async () => {
    const { state, cookie } = await startLogin();

    const response = await callCallback(
      `code=abc&state=${state}&iss=${encodeURIComponent("https://not-the-idp.example.com")}`,
      cookie
    );

    expect(response.status).toBe(302);
    expect(errorFromRedirect(response)).toBe("issuer_mismatch");
  });

  it("rejects a state that doesn't match any pending transaction", async () => {
    const { cookie } = await startLogin();

    const response = await callCallback(
      `code=abc&state=not-the-real-state&iss=${encodeURIComponent(ISSUER)}`,
      cookie
    );

    expect(response.status).toBe(302);
    // better-auth doesn't export this one as a named error code constant.
    expect(errorFromRedirect(response)).toBe("state_mismatch");
  });

  it("rejects an ID token whose nonce doesn't match the authorization request", async () => {
    const { state, cookie } = await startLogin();
    const idToken = await signTestIdToken(keys, {
      issuer: ISSUER,
      audience: TEST_ENV.OIDC_CLIENT_ID,
      nonce: "a-different-nonce",
    });
    stubIdpFetch({ issuer: ISSUER, keys, idToken });

    const response = await callCallback(
      `code=abc&state=${state}&iss=${encodeURIComponent(ISSUER)}`,
      cookie
    );

    expect(response.status).toBe(302);
    expect(errorFromRedirect(response)).toBe("unable_to_get_user_info");
  });

  it("rejects an ID token issued for a different audience", async () => {
    const { state, nonce, cookie } = await startLogin();
    const idToken = await signTestIdToken(keys, {
      issuer: ISSUER,
      audience: "some-other-client",
      nonce,
    });
    stubIdpFetch({ issuer: ISSUER, keys, idToken });

    const response = await callCallback(
      `code=abc&state=${state}&iss=${encodeURIComponent(ISSUER)}`,
      cookie
    );

    expect(response.status).toBe(302);
    expect(errorFromRedirect(response)).toBe("unable_to_get_user_info");
  });

  it("rejects an expired ID token", async () => {
    const { state, nonce, cookie } = await startLogin();
    const idToken = await signTestIdToken(keys, {
      issuer: ISSUER,
      audience: TEST_ENV.OIDC_CLIENT_ID,
      nonce,
      expiresIn: "-1m",
    });
    stubIdpFetch({ issuer: ISSUER, keys, idToken });

    const response = await callCallback(
      `code=abc&state=${state}&iss=${encodeURIComponent(ISSUER)}`,
      cookie
    );

    expect(response.status).toBe(302);
    expect(errorFromRedirect(response)).toBe("unable_to_get_user_info");
  });

  it("rejects an ID token signed by a different key", async () => {
    const { state, nonce, cookie } = await startLogin();
    const idToken = await signTestIdToken(await generateTestIdpKeys(), {
      issuer: ISSUER,
      audience: TEST_ENV.OIDC_CLIENT_ID,
      nonce,
    });
    stubIdpFetch({ issuer: ISSUER, keys, idToken });

    const response = await callCallback(
      `code=abc&state=${state}&iss=${encodeURIComponent(ISSUER)}`,
      cookie
    );

    expect(response.status).toBe(302);
    expect(errorFromRedirect(response)).toBe("unable_to_get_user_info");
  });
});
