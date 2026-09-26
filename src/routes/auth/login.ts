import { redirect } from "react-router";
import { cloudflareContext } from "../../context";
import { requireIdpProvider } from "../../lib/auth/auth.server";
import { sanitizeReturnTo } from "../../lib/auth/return-to.server";
import type { Route } from "./+types/login";

// better-auth handles state, nonce, and PKCE; this only sanitizes returnTo.
export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const callbackURL = sanitizeReturnTo(url.searchParams.get("returnTo"));

  const auth = await requireIdpProvider(env);
  const { headers, response } = await auth.api.signInSocial({
    body: { provider: "idp", callbackURL },
    returnHeaders: true,
  });

  if (!response.url) {
    throw new Response("Failed to start sign-in", { status: 502 });
  }

  // `headers` carries the encrypted OAuth state cookie better-auth set.
  headers.set("Cache-Control", "no-store");

  return redirect(response.url, { headers });
};
