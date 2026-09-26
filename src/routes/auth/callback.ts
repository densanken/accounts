import { cloudflareContext } from "../../context";
import {
  BETTER_AUTH_CALLBACK_PATH,
  requireIdpProvider,
} from "../../lib/auth/auth.server";
import type { Route } from "./+types/callback";

// The only better-auth endpoint exposed over HTTP; login.ts calls the
// sign-in API in-process.
export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const auth = await requireIdpProvider(context.get(cloudflareContext).env);
  // Served at OIDC_CALLBACK_PATH; better-auth only routes its own path.
  const url = new URL(request.url);
  url.pathname = BETTER_AUTH_CALLBACK_PATH;
  const response = await auth.handler(new Request(url, request));
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers });
};
