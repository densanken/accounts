import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { loginPath } from "../auth/login-path";
import { IdpApiError } from "../idp/client";

const isRetryableError = (error: unknown): boolean =>
  error instanceof IdpApiError &&
  (error.code === "network" || error.code === "server");

// At most 1 retry, and only for network/server errors - never 401/403/4xx.
const retry = (failureCount: number, error: unknown): boolean =>
  failureCount < 1 && isRetryableError(error);

const redirectToLogin = (): void => {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(loginPath(returnTo));
};

/**
 * The app's QueryClient. Accounts session cookies can outlive the IdP
 * session, so a 401 from the IdP API means the current page's data can't be
 * trusted - every such failure sends the browser back through login instead
 * of leaving a bare "Unauthorized" on screen.
 */
export const createQueryClient = (): QueryClient => {
  const handleError = (error: unknown) => {
    if (error instanceof IdpApiError && error.code === "unauthorized") {
      redirectToLogin();
    }
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry,
      },
    },
  });
};
