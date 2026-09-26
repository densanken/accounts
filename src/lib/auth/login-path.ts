/** Builds the login route path, redirecting back to `returnTo` after sign-in. */
export const loginPath = (returnTo: string): string =>
  `/auth/login?return_to=${encodeURIComponent(returnTo)}`;
