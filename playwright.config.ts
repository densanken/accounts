import { defineConfig, devices } from "@playwright/test";

const PORT = 8799;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Run against the production build (via the Cloudflare Workers runtime)
    // instead of the Vite dev server: no HMR websocket, no on-demand
    // transforms, and a much more deterministic hydration timeline.
    command: `pnpm run build && pnpm exec wrangler dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
