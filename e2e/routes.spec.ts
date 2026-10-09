import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./auth-session";

test("shows a login screen instead of redirecting an unauthenticated visitor", async ({
  page,
}) => {
  const response = await page.request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(200);

  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Sign in with CCS ID" })
  ).toBeVisible();
});

test("sends an unauthenticated visitor on a guarded route to the login screen", async ({
  page,
}) => {
  await page.goto("/connections");
  await expect(page).toHaveURL("/?return_to=%2Fconnections");
  await expect(page).toHaveTitle("ログイン | CCS Account");
  await expect(
    page.getByRole("link", { name: "Sign in with CCS ID" })
  ).toHaveAttribute("href", "/auth/login?return_to=%2Fconnections");
});

test("shows an error banner on the login screen when redirected with an error", async ({
  page,
}) => {
  await page.goto("/?error=access_denied");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "ログインがキャンセルされたか、許可されませんでした" })
  ).toBeVisible();
});

test("shows a 404 page for an unknown route", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});

// The tests below exercise the authenticated account shell (nav, theme
// toggle, responsive sidebar). They seed a session cookie directly (see
// ./auth-session.ts) instead of driving a real IdP login.
test.describe("authenticated account shell", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) {
      throw new Error("playwright config must set a baseURL");
    }
    await seedAuthenticatedSession(context, baseURL);
  });

  test("navigates between account pages via the layout nav", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "外部アカウント連携" }).click();
    await expect(page).toHaveURL("/connections");
    await expect(
      page.getByRole("heading", { name: "外部アカウント連携" })
    ).toBeVisible();
  });

  test("choosing the dark theme persists across reload", async ({ page }) => {
    await page.goto("/");
    // No HMR websocket against the production build, so this reliably signals
    // hydration has finished before we start clicking JS-driven controls.
    await page.waitForLoadState("networkidle");
    const html = page.locator("html");

    await expect(html).not.toHaveClass(/dark/);

    await page.getByRole("button", { name: "システム" }).click();
    const darkOption = page.getByRole("menuitemradio", { name: "ダーク" });
    await expect(darkOption).toBeVisible();
    await expect(darkOption).toHaveCSS("cursor", "pointer");
    // Wait for the actual /theme request to land (the UI updates
    // optimistically before this resolves, so asserting on the DOM alone
    // isn't enough to know the cookie has been set before we reload).
    const themeRequest = page.waitForResponse(
      (res) => new URL(res.url()).pathname.startsWith("/theme") && res.ok()
    );
    await darkOption.click();
    await themeRequest;
    await expect(html).toHaveCSS("color-scheme", "dark");

    await page.reload();
    await expect(html).toHaveCSS("color-scheme", "dark");
    await expect(page.getByRole("button", { name: "ダーク" })).toBeVisible();
  });

  test("on a mobile viewport, the hamburger trigger opens the nav and closes it after navigating", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const connectionsLink = page.getByRole("link", {
      name: "外部アカウント連携",
    });
    await expect(connectionsLink).not.toBeVisible();

    await page.getByRole("button", { name: "メニューを開く" }).click();
    await expect(connectionsLink).toBeVisible();

    await connectionsLink.click();
    await expect(page).toHaveURL("/connections");

    // The mobile sheet should close itself after navigating.
    await expect(connectionsLink).not.toBeVisible();
  });

  test("on a tablet viewport, the hamburger trigger is used instead of a persistent sidebar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "外部アカウント連携" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "メニューを開く" })
    ).toBeVisible();
  });

  test("on a desktop viewport, the sidebar nav is visible without opening anything", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "プロフィール" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "外部アカウント連携" })
    ).toBeVisible();
  });
});
