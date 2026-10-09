import { redirect } from "react-router";
import { cloudflareContext } from "../../context";
import { hasSession } from "../../lib/auth/require-session.server";
import type { Route } from "./+types/guard";

// Guards every route nested under it. Middleware runs before any loader in
// the tree, so - unlike a plain loader, which React Router runs in parallel
// with child loaders - this can't let an unauthenticated request reach a
// guarded child route's loader. Child routes fetch their own data from the
// IdP directly, so the only thing needed here is the session check itself.
// No component: a layout route with none just renders its child's <Outlet/>.
//
// Redirects to the account root instead of straight into `/auth/login`, so
// an unauthenticated visit lands on the same in-app login screen as `/`
// (with a chance to see an auth error banner) rather than bouncing straight
// through to the IdP.
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const { env } = context.get(cloudflareContext);
    if (!(await hasSession(request, env))) {
      const url = new URL(request.url);
      const returnTo = `${url.pathname}${url.search}`;
      throw redirect(`/?return_to=${encodeURIComponent(returnTo)}`);
    }
    return next();
  },
];
