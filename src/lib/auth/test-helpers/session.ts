import { loader as callbackLoader } from "../../../routes/auth/callback";
import { loader as loginLoader } from "../../../routes/auth/login";
import { resetAuthForTests } from "../auth.server";
import { TEST_ENV, testRouterContext } from "./context";
import { generateTestIdpKeys, signTestIdToken, stubIdpFetch } from "./idp";

/**
 * Runs a full login -> callback round trip against a stubbed IdP and returns
 * the Cookie header an authenticated browser would send on its next request.
 * Stubs and resets better-auth's cached instance itself, so callers don't
 * need their own IdP stubbing to get an authenticated session.
 */
export const createAuthenticatedCookie = async (
  returnTo = "/"
): Promise<string> => {
  resetAuthForTests();
  const keys = await generateTestIdpKeys();
  stubIdpFetch({ issuer: TEST_ENV.IDP_ISSUER, keys, idToken: "" });

  const loginResponse = await loginLoader({
    request: new Request(
      `${TEST_ENV.ACCOUNTS_BASE_URL}/auth/login?returnTo=${encodeURIComponent(returnTo)}`
    ),
    context: testRouterContext(),
    params: {},
  } as never);
  const location = new URL(loginResponse.headers.get("Location") ?? "");
  const transactionCookie =
    (loginResponse.headers.get("Set-Cookie") ?? "").split(";")[0] ?? "";
  const nonce = location.searchParams.get("nonce") ?? "";
  const state = location.searchParams.get("state") ?? "";

  const idToken = await signTestIdToken(keys, {
    issuer: TEST_ENV.IDP_ISSUER,
    audience: TEST_ENV.OIDC_CLIENT_ID,
    nonce,
  });
  stubIdpFetch({ issuer: TEST_ENV.IDP_ISSUER, keys, idToken });

  const callbackResponse = await callbackLoader({
    request: new Request(
      `${TEST_ENV.ACCOUNTS_BASE_URL}/oauth/callback?code=abc&state=${state}&iss=${encodeURIComponent(TEST_ENV.IDP_ISSUER)}`,
      { headers: { Cookie: transactionCookie } }
    ),
    context: testRouterContext(),
    params: {},
  } as never);

  return callbackResponse.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
};
