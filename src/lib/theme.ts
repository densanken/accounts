import { createCookie } from "react-router";

export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export const isTheme = (value: unknown): value is Theme =>
  THEMES.includes(value as Theme);

export const themeCookie = createCookie("theme", {
  path: "/",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 400,
});

export const parseTheme = async (
  cookieHeader: string | null
): Promise<Theme> => {
  const value = await themeCookie.parse(cookieHeader);
  return isTheme(value) ? value : "system";
};
