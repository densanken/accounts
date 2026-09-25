import { useFetchers, useRouteLoaderData } from "react-router";
import { isTheme, type Theme } from "../lib/theme";
import type { loader as rootLoader } from "../root";

// Optimistic: while a submission to /theme is in flight, its value wins over
// the (stale, until revalidation completes) loader data.
export const useTheme = (): Theme => {
  const fetchers = useFetchers();
  const data = useRouteLoaderData<typeof rootLoader>("root");

  const pendingTheme = fetchers
    .filter((fetcher) => fetcher.formAction === "/theme")
    .map((fetcher) => fetcher.formData?.get("theme"))
    .find(isTheme);

  return pendingTheme ?? data?.theme ?? "system";
};
