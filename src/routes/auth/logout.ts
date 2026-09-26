import { redirect } from "react-router";
import { cloudflareContext } from "../../context";
import { getAuth } from "../../lib/auth/auth.server";
import type { Route } from "./+types/logout";

// The IdP session outlives the Accounts session, so clearing only the
// Accounts cookie would let the next visit SSO straight back in. RP-Initiated
// Logout (https://openid.net/specs/openid-connect-rpinitiated-1_0.html) ends
// that session too; without an id_token_hint the IdP shows its own
// confirmation prompt before doing so, which this app doesn't need to
// replicate.
// No CSRF protection needed here: a cross-site POST can at most clear the
// Accounts session (a forced logout, which is an acceptable outcome), since
// the IdP's own logout still stops at its confirmation prompt before it
// touches the IdP session.
export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.get(cloudflareContext);
  const auth = getAuth(env);
  const { headers } = await auth.api.signOut({
    headers: request.headers,
    returnHeaders: true,
  });
  headers.set("Cache-Control", "no-store");

  const idpLogoutUrl = new URL("/oauth/logout", env.IDP_ISSUER);
  idpLogoutUrl.searchParams.set("client_id", env.OIDC_CLIENT_ID);
  idpLogoutUrl.searchParams.set(
    "post_logout_redirect_uri",
    env.OIDC_POST_LOGOUT_REDIRECT_URI
  );

  return redirect(idpLogoutUrl.toString(), { headers });
};
