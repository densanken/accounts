import { data } from "react-router";
import { isTheme, themeCookie } from "../lib/theme";
import type { Route } from "./+types/theme";

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const theme = formData.get("theme");

  return data(null, {
    headers: {
      "Set-Cookie": await themeCookie.serialize(
        isTheme(theme) ? theme : "system"
      ),
    },
  });
};
