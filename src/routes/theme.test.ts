import { describe, expect, it } from "vitest";
import { themeCookie } from "../lib/theme";
import { action } from "./theme";

const buildRequest = (theme: string) => {
  const formData = new FormData();
  formData.set("theme", theme);
  return new Request("https://example.com/theme", {
    method: "POST",
    body: formData,
  });
};

const getSetCookieHeader = (init: ResponseInit | null) => {
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.["Set-Cookie"] ?? null;
};

describe("theme route action", () => {
  it("sets the theme cookie without redirecting", async () => {
    const result = await action({ request: buildRequest("dark") } as never);

    expect(result.data).toBeNull();
    const cookieHeader = getSetCookieHeader(result.init);
    expect(cookieHeader).toBeTruthy();
    expect(await themeCookie.parse(cookieHeader)).toBe("dark");
  });

  it("falls back to system for an invalid theme value", async () => {
    const result = await action({
      request: buildRequest("not-a-theme"),
    } as never);

    const cookieHeader = getSetCookieHeader(result.init);
    expect(await themeCookie.parse(cookieHeader)).toBe("system");
  });
});
