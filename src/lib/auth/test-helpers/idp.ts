import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { vi } from "vitest";

const TEST_KID = "test-key";

/** A test Ed25519 key pair plus the public JWK the IdP's JWKS endpoint would serve. */
export interface TestIdpKeys {
  privateKey: CryptoKey;
  kid: string;
  publicJwk: Record<string, unknown>;
}

export const generateTestIdpKeys = async (): Promise<TestIdpKeys> => {
  const { privateKey, publicKey } = await generateKeyPair("Ed25519", {
    extractable: true,
  });
  const publicJwk = {
    ...(await exportJWK(publicKey)),
    alg: "Ed25519",
    kid: TEST_KID,
    use: "sig",
  };
  return { privateKey, kid: TEST_KID, publicJwk };
};

export interface SignTestIdTokenOptions {
  issuer: string;
  audience: string;
  subject?: string;
  nonce?: string;
  expiresIn?: string;
}

/** Signs an ID Token the way the IdP does: alg "Ed25519", with the given kid. */
export const signTestIdToken = (
  keys: TestIdpKeys,
  {
    issuer,
    audience,
    subject = "user-1",
    nonce = "the-nonce",
    expiresIn = "5m",
  }: SignTestIdTokenOptions
): Promise<string> =>
  new SignJWT({ nonce })
    .setProtectedHeader({ alg: "Ed25519", kid: keys.kid })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setExpirationTime(expiresIn)
    .sign(keys.privateKey);

/** The subset of the IdP's discovery document that better-auth reads. */
export interface TestDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  id_token_signing_alg_values_supported: string[];
}

/** Builds a discovery document shaped like the IdP's. */
export const testDiscoveryDocument = (
  issuer: string
): TestDiscoveryDocument => ({
  issuer,
  authorization_endpoint: new URL("/oauth/authorize", issuer).toString(),
  token_endpoint: new URL("/oauth/token", issuer).toString(),
  jwks_uri: new URL("/.well-known/jwks.json", issuer).toString(),
  id_token_signing_alg_values_supported: ["Ed25519"],
});

export interface StubIdpOptions {
  issuer: string;
  /** Serve the JWKS endpoint with this key's public JWK. Omit to leave it unstubbed. */
  keys?: TestIdpKeys;
  /**
   * Serve the token endpoint with this ID Token, requiring client_secret_basic
   * (the IdP's token endpoint accepts nothing else). Omit to leave it unstubbed.
   */
  idToken?: string;
  /** Inspects the token endpoint request (e.g. to assert on `code_verifier`). */
  onTokenRequest?: (request: {
    headers: Headers;
    body: URLSearchParams;
  }) => void;
}

/**
 * Stubs global `fetch` to serve discovery always, plus JWKS and/or a token
 * response when `keys`/`idToken` are given. Pair with `vi.unstubAllGlobals()`
 * in `afterEach`.
 */
export const stubIdpFetch = ({
  issuer,
  keys,
  idToken,
  onTokenRequest,
}: StubIdpOptions): void => {
  const discoveryUrl = new URL(
    "/.well-known/openid-configuration",
    issuer
  ).toString();
  const jwksUrl = new URL("/.well-known/jwks.json", issuer).toString();
  const tokenUrl = new URL("/oauth/token", issuer).toString();

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url === discoveryUrl) {
        return new Response(JSON.stringify(testDiscoveryDocument(issuer)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (keys && url === jwksUrl) {
        return new Response(JSON.stringify({ keys: [keys.publicJwk] }), {
          status: 200,
        });
      }
      if (idToken !== undefined && url === tokenUrl) {
        const headers =
          input instanceof Request ? input.headers : new Headers(init?.headers);
        if (!headers.get("Authorization")?.startsWith("Basic ")) {
          return new Response(JSON.stringify({ error: "invalid_client" }), {
            status: 401,
          });
        }
        if (onTokenRequest) {
          const bodyText =
            input instanceof Request
              ? await input.clone().text()
              : String(init?.body ?? "");
          onTokenRequest({ headers, body: new URLSearchParams(bodyText) });
        }
        return new Response(
          JSON.stringify({
            access_token: "test-access-token",
            token_type: "Bearer",
            expires_in: 3600,
            id_token: idToken,
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch to ${url}`);
    })
  );
};
