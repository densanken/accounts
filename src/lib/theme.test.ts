import { describe, expect, it } from "vitest";
import { parseTheme, themeCookie } from "./theme";

describe("parseTheme", () => {
  it("defaults to system when there is no cookie", async () => {
    expect(await parseTheme(null)).toBe("system");
  });

  it("defaults to system when the cookie value is invalid", async () => {
    const cookieHeader = await themeCookie.serialize("not-a-theme");
    expect(await parseTheme(cookieHeader)).toBe("system");
  });

  it("returns the stored theme for a valid cookie", async () => {
    const cookieHeader = await themeCookie.serialize("dark");
    expect(await parseTheme(cookieHeader)).toBe("dark");
  });
});
