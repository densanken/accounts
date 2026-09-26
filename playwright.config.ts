import { defineConfig, devices } from "@playwright/test";
import { E2E_SESSION_SECRET } from "./e2e/auth-session";

const PORT = 8799;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Run against the production build (via the Cloudflare Workers runtime)
    // instead of the Vite dev server: no HMR websocket, no on-demand
    // transforms, and a much more deterministic hydration timeline.
    // ACCOUNTS_SESSION_SECRET/ACCOUNTS_BASE_URL are pinned here (rather than
    // read from `.dev.vars`, which in CI is a copy of `.dev.vars.example`
    // with blank secrets) so auth-session.ts can sign cookies this worker
    // accepts. OIDC_CLIENT_SECRET is also pinned to a non-empty placeholder:
    // better-auth's genericOAuth plugin requires one for every session check
    // (not just an actual OAuth exchange, which these tests never trigger).
    command: `pnpm run build && pnpm exec wrangler dev --port ${PORT} --var ACCOUNTS_SESSION_SECRET:${E2E_SESSION_SECRET} --var ACCOUNTS_BASE_URL:${BASE_URL} --var OIDC_CLIENT_SECRET:e2e-placeholder-client-secret`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
