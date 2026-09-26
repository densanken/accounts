import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAuthForTests } from "../../lib/auth/auth.server";
import {
  TEST_ENV,
  testRouterContext,
} from "../../lib/auth/test-helpers/context";
import { stubIdpFetch } from "../../lib/auth/test-helpers/idp";
import { createAuthenticatedCookie } from "../../lib/auth/test-helpers/session";
import { loader } from "./layout";

describe("account layout loader", () => {
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

  it("reports unauthenticated when there is no session", async () => {
    const result = await loader({
      request: new Request("https://accounts.example.com/"),
      context: testRouterContext(),
      params: {},
    } as never);

    expect(result).toEqual({ authenticated: false });
  });

  it("reports authenticated when there is a session", async () => {
    const cookie = await createAuthenticatedCookie("/");

    const result = await loader({
      request: new Request("https://accounts.example.com/", {
        headers: { Cookie: cookie },
      }),
      context: testRouterContext(),
      params: {},
    } as never);

    expect(result).toEqual({ authenticated: true });
  });

  it("reads an existing session without waiting for an unavailable IdP", async () => {
    const cookie = await createAuthenticatedCookie("/");
    resetAuthForTests();
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loader({
      request: new Request("https://accounts.example.com/", {
        headers: { Cookie: cookie },
      }),
      context: testRouterContext(),
      params: {},
    } as never);

    expect(result).toEqual({ authenticated: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
