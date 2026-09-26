import { type BetterAuthOptions, betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { decodeJwt } from "jose";

// Provider id for our IdP inside better-auth's generic-oauth plugin.
const IDP_PROVIDER_ID = "idp";

// Where the IdP sends the browser back. It sits outside better-auth's
// basePath, so routes/auth/callback.ts rewrites it to better-auth's own
// callback endpoint before handing the request over.
export const OIDC_CALLBACK_PATH = "/oauth/callback";
export const BETTER_AUTH_CALLBACK_PATH = `/auth/callback/${IDP_PROVIDER_ID}`;

// The IdP's ID Tokens have no `email` claim, but better-auth requires one on
// every user. This placeholder (".invalid" is reserved by RFC 2606) only
// satisfies that requirement and carries no identity meaning.
const syntheticEmail = (sub: string): string =>
  `${sub}@${IDP_PROVIDER_ID}.invalid`;

const buildAuthOptions = (env: Env) => {
  // better-auth only refuses a missing secret when NODE_ENV=production; here
  // it would otherwise silently fall back to its public default secret.
  if (!env.ACCOUNTS_SESSION_SECRET)
    throw new Error("ACCOUNTS_SESSION_SECRET is required");
  return {
    baseURL: env.ACCOUNTS_BASE_URL,
    basePath: "/auth",
    secret: env.ACCOUNTS_SESSION_SECRET,
    // No `database`: stateless mode keeps OAuth state and the session in
    // encrypted cookies.
    // Errors land on "/", which shows the error banner (see routes/account/layout.tsx).
    onAPIError: { errorURL: "/" },
    // better-auth assigns its own internal user id and discards the `id`
    // getUserInfo returns, so the IdP's `sub` (the actual identity) is
    // carried through as a plain additional field instead.
    user: {
      additionalFields: {
        // input: true (not false): better-auth applies the same "input"
        // allowlist to mapProfileToUser's output as it does to client-supplied
        // data, so input: false would silently drop `sub` on every sign-in
        // (parseAdditionalUserInputFromProviderProfile filters it out before
        // user creation, making this a required field with no value). This
        // app doesn't mount better-auth's own user-update endpoint (see
        // routes.ts), so there's no HTTP path for a client to overwrite it.
        sub: { type: "string", required: true, input: true },
      },
    },
    // Stateless mode defaults this to true, storing the OAuth tokens in an
    // extra encrypted cookie. Nothing reads it back (logout doesn't send
    // id_token_hint), so there's no reason to set it.
    account: { storeAccountCookie: false },
  } satisfies BetterAuthOptions;
};

const buildIdpPlugin = (env: Env) =>
  genericOAuth({
    config: [
      {
        providerId: IDP_PROVIDER_ID,
        clientId: env.OIDC_CLIENT_ID,
        clientSecret: env.OIDC_CLIENT_SECRET,
        redirectURI: new URL(
          OIDC_CALLBACK_PATH,
          env.ACCOUNTS_BASE_URL
        ).toString(),
        // generic-oauth needs discovery for the issuer/JWKS used to verify
        // ID Tokens, so OAuth initialization can wait on the IdP.
        discoveryUrl: new URL(
          "/.well-known/openid-configuration",
          env.IDP_ISSUER
        ).toString(),
        // The IdP's token endpoint accepts client_secret_basic only.
        authentication: "basic",
        pkce: true,
        scopes: ["profile"],
        // Fail closed rather than fall back to unverified ID Tokens.
        requireIdTokenVerification: true,
        // The default getUserInfo discards ID Tokens without `email`.
        // The token is already verified at this point, so decoding it
        // is safe.
        getUserInfo: async (tokens) => {
          if (!tokens.idToken) {
            return null;
          }
          const claims = decodeJwt(tokens.idToken);
          if (typeof claims.sub !== "string" || claims.sub === "") {
            return null;
          }
          const name =
            typeof claims.name === "string" ? claims.name : claims.sub;
          return {
            id: claims.sub,
            sub: claims.sub,
            email: syntheticEmail(claims.sub),
            emailVerified: false,
            name,
            image:
              typeof claims.picture === "string" ? claims.picture : undefined,
          };
        },
        // The plugin only carries email/emailVerified/image/name from
        // getUserInfo's return value into the user it creates; anything
        // else (here, `sub`) needs to be mapped through explicitly.
        mapProfileToUser: (profile) => ({ sub: profile.sub as string }),
      },
    ],
  });

const buildSessionAuth = (env: Env) => betterAuth(buildAuthOptions(env));
const buildIdpAuth = (env: Env) =>
  betterAuth({ ...buildAuthOptions(env), plugins: [buildIdpPlugin(env)] });

type SessionAuth = ReturnType<typeof buildSessionAuth>;
type IdpAuth = ReturnType<typeof buildIdpAuth>;

let cachedSessionAuth: SessionAuth | undefined;
let cachedIdpAuth: IdpAuth | undefined;

// Session checks and sign-out don't need OAuth provider metadata. Keeping
// this instance free of generic-oauth means IdP discovery cannot delay them.
export const getAuth = (env: Env): SessionAuth => {
  if (!cachedSessionAuth) {
    cachedSessionAuth = buildSessionAuth(env);
  }
  return cachedSessionAuth;
};

const idpProviderRegistered = async (auth: IdpAuth): Promise<boolean> => {
  const context = await auth.$context;
  return context.socialProviders.some(
    (provider) => provider.id === IDP_PROVIDER_ID
  );
};

// login/callback additionally need the "idp" provider that genericOAuth only
// registers once discovery succeeds. A failed discovery fetch doesn't throw -
// it just leaves the provider unregistered - so if the cached instance never
// got it, rebuild once to retry rather than getting stuck with a provider
// that will never work.
export const requireIdpProvider = async (env: Env): Promise<IdpAuth> => {
  const auth = cachedIdpAuth ?? buildIdpAuth(env);
  if (await idpProviderRegistered(auth)) {
    cachedIdpAuth = auth;
    return auth;
  }
  const retry = buildIdpAuth(env);
  if (await idpProviderRegistered(retry)) {
    cachedIdpAuth = retry;
    return retry;
  }
  cachedIdpAuth = undefined;
  throw new Error(
    "Failed to initialize the IdP OAuth provider (discovery fetch failed)"
  );
};

export const resetAuthForTests = (): void => {
  cachedSessionAuth = undefined;
  cachedIdpAuth = undefined;
};
