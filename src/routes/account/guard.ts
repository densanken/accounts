import { cloudflareContext } from "../../context";
import { requireSession } from "../../lib/auth/require-session.server";
import type { Route } from "./+types/guard";

// Guards every route nested under it. Middleware runs before any loader in
// the tree, so - unlike a plain loader, which React Router runs in parallel
// with child loaders - this can't let an unauthenticated request reach a
// guarded child route's loader. Child routes fetch their own data from the
// IdP directly, so the only thing needed here is the session check itself.
// No component: a layout route with none just renders its child's <Outlet/>.
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const { env } = context.get(cloudflareContext);
    await requireSession(request, env);
    return next();
  },
];
