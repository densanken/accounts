import { getAuth } from "./auth.server";

const getSession = (request: Request, env: Env) => {
  const auth = getAuth(env);
  return auth.api.getSession({ headers: request.headers });
};

/** Reports whether the request carries a valid Accounts session. */
export const hasSession = async (
  request: Request,
  env: Env
): Promise<boolean> => (await getSession(request, env)) !== null;
