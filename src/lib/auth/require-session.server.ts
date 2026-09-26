import { redirect } from "react-router";
import { getAuth } from "./auth.server";

const getSession = (request: Request, env: Env) => {
  const auth = getAuth(env);
  return auth.api.getSession({ headers: request.headers });
};

/**
 * Guards a route behind an Accounts session. Redirects to `/auth/login`
 * with the current path as `returnTo` when there is none.
 */
export const requireSession = async (request: Request, env: Env) => {
  const session = await getSession(request, env);
  if (!session) {
    const url = new URL(request.url);
    const returnTo = `${url.pathname}${url.search}`;
    throw redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
};

/** Same check as `requireSession`, but reports the result instead of redirecting. */
export const hasSession = async (
  request: Request,
  env: Env
): Promise<boolean> => (await getSession(request, env)) !== null;
