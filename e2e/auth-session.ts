import type { BrowserContext } from "@playwright/test";
import { createCookieGetter } from "better-auth/cookies";
import { makeSignature, symmetricEncodeJWT } from "better-auth/crypto";

// Pinned for the e2e webServer via `--var ACCOUNTS_SESSION_SECRET:...` (see
// playwright.config.ts), so this test helper can sign/encrypt cookies the
// running worker will accept without depending on `.dev.vars`.
export const E2E_SESSION_SECRET = "e2e-test-session-secret-0123456789abcdef";

/**
 * Adds a session cookie pair to `context` that better-auth's stateless
 * `getSession` will accept as already logged in, without going through a
 * real IdP login. Mirrors what `setSessionCookie` writes on a real sign-in:
 * a signed `session_token` cookie plus a JWE-encrypted `session_data` cache
 * cookie (see better-auth's cookies/index.ts and api/routes/session.ts).
 */
export const seedAuthenticatedSession = async (
  context: BrowserContext,
  baseURL: string,
  sub = "e2e-user"
): Promise<void> => {
  const token = `e2e-session-${sub}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const sessionData = {
    session: {
      id: `e2e-session-id-${sub}`,
      token,
      userId: sub,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    user: {
      id: sub,
      sub,
      name: "E2E Test User",
      email: `${sub}@idp.invalid`,
      emailVerified: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    updatedAt: Date.now(),
    version: "1",
  };

  // baseURL matches the pinned ACCOUNTS_BASE_URL (see playwright.config.ts),
  // which decides whether cookie names/attributes get the secure prefix.
  const getCookie = createCookieGetter({ baseURL });
  const sessionTokenCookie = getCookie("session_token");
  const sessionDataCookie = getCookie("session_data");
  const signedToken = `${token}.${await makeSignature(token, E2E_SESSION_SECRET)}`;
  const encryptedSessionData = await symmetricEncodeJWT(
    sessionData,
    E2E_SESSION_SECRET,
    "better-auth-session",
    7 * 24 * 60 * 60
  );

  await context.addCookies([
    {
      name: sessionTokenCookie.name,
      value: signedToken,
      url: baseURL,
      httpOnly: sessionTokenCookie.attributes.httpOnly,
      sameSite: "Lax",
    },
    {
      name: sessionDataCookie.name,
      value: encryptedSessionData,
      url: baseURL,
      httpOnly: sessionDataCookie.attributes.httpOnly,
      sameSite: "Lax",
    },
  ]);
};
