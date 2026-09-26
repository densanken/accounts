import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "../../../context";

export const TEST_ENV = {
  IDP_ISSUER: "https://id.example.com",
  OIDC_CLIENT_ID: "accounts-client",
  OIDC_CLIENT_SECRET: "s3cr3t",
  ACCOUNTS_SESSION_SECRET: "test-secret-at-least-32-characters-long!!",
  ACCOUNTS_BASE_URL: "https://accounts.example.com",
  OIDC_POST_LOGOUT_REDIRECT_URI: "https://accounts.example.com/",
} as unknown as Env;

/** A RouterContextProvider carrying `TEST_ENV`, as loaders read it via `cloudflareContext`. */
export const testRouterContext = (): RouterContextProvider => {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: TEST_ENV,
    ctx: {} as ExecutionContext,
  });
  return context;
};
