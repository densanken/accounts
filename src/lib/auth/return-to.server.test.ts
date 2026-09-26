import { describe, expect, it } from "vitest";
import { sanitizeReturnTo } from "./return-to.server";

describe("sanitizeReturnTo", () => {
  it("accepts a same-origin relative path", () => {
    expect(sanitizeReturnTo("/profile")).toBe("/profile");
  });

  it("preserves query and hash on a relative path", () => {
    expect(sanitizeReturnTo("/profile?tab=security#top")).toBe(
      "/profile?tab=security#top"
    );
  });

  it("falls back to / for null", () => {
    expect(sanitizeReturnTo(null)).toBe("/");
  });

  it("falls back to / for an empty string", () => {
    expect(sanitizeReturnTo("")).toBe("/");
  });

  it("falls back to / for a path that doesn't start with /", () => {
    expect(sanitizeReturnTo("profile")).toBe("/");
  });

  it("falls back to / for an absolute URL", () => {
    expect(sanitizeReturnTo("https://evil.example/")).toBe("/");
  });

  it("falls back to / for a protocol-relative URL", () => {
    expect(sanitizeReturnTo("//evil.example")).toBe("/");
  });

  it("falls back to / for a backslash trick browsers treat as protocol-relative", () => {
    expect(sanitizeReturnTo("/\\evil.example")).toBe("/");
  });

  it("falls back to / for a javascript: URL", () => {
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe("/");
  });
});
