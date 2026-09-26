import {
  index,
  layout,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  route("auth/login", "routes/auth/login.ts"),
  route("auth/logout", "routes/auth/logout.ts"),
  // Mounts better-auth's own handler for the OIDC callback only. See
  // routes/auth/callback.ts.
  route("oauth/callback", "routes/auth/callback.ts"),
  route("theme", "routes/theme.ts"),

  layout("routes/account/layout.tsx", [
    // Public: renders a login screen instead of the shell when unauthenticated.
    index("routes/account/index.tsx"),
    layout("routes/account/guard.ts", [
      route("connections", "routes/account/connections/route.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
