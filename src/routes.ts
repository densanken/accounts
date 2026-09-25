import {
  index,
  layout,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  route("auth/login", "routes/auth/login.ts"),
  route("auth/callback", "routes/auth/callback.ts"),
  route("auth/logout", "routes/auth/logout.ts"),
  route("theme", "routes/theme.ts"),

  layout("routes/account/layout.tsx", [
    index("routes/account/index.tsx"),
    route("connections", "routes/account/connections/route.tsx"),
  ]),
] satisfies RouteConfig;
