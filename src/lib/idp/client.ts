import * as v from "valibot";

const BODY_ERROR_CODES = [
  "last_discord_account",
  "linked_account_not_found",
] as const;

export type IdpApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "validation"
  | (typeof BODY_ERROR_CODES)[number]
  | "network"
  | "server"
  | "unknown";

export class IdpApiError extends Error {
  override name = "IdpApiError";
  code: IdpApiErrorCode;
  status?: number;

  constructor(code: IdpApiErrorCode, status?: number) {
    super(`IdP API error: ${code}`);
    this.code = code;
    this.status = status;
  }
}

const errorCodeForStatus = (status: number): IdpApiErrorCode => {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 400) return "validation";
  if (status >= 500) return "server";
  return "unknown";
};

// The IdP reports a few conditions as a specific error code in the response
// body rather than through the status alone.
const errorBodySchema = v.object({
  error: v.picklist(BODY_ERROR_CODES),
});

const errorCodeForResponse = async (
  response: Response
): Promise<IdpApiErrorCode> => {
  const body: unknown = await response.json().catch(() => undefined);
  if (v.is(errorBodySchema, body)) return body.error;
  return errorCodeForStatus(response.status);
};

/**
 * Fetches from the IdP API. No screen calls the raw `fetch()` for this
 * directly - this is the one place that adds the IdP origin, sends
 * credentials, and normalizes the response (status, JSON parsing, schema)
 * into either `T` or an `IdpApiError`.
 */
export const idpFetch = async <T>(
  idpOrigin: string,
  path: string,
  schema: v.GenericSchema<unknown, T>,
  init?: { method?: string; json?: unknown }
): Promise<T> => {
  const { method, json } = init ?? {};
  const body = json !== undefined ? JSON.stringify(json) : undefined;
  const headers =
    body !== undefined ? { "Content-Type": "application/json" } : undefined;

  let response: Response;
  try {
    response = await fetch(`${idpOrigin}${path}`, {
      method,
      body,
      headers,
      credentials: "include",
    });
  } catch {
    throw new IdpApiError("network");
  }

  if (!response.ok) {
    throw new IdpApiError(
      await errorCodeForResponse(response),
      response.status
    );
  }

  const data: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => {
          throw new IdpApiError("unknown", response.status);
        });

  const result = v.safeParse(schema, data);
  if (!result.success) {
    throw new IdpApiError("unknown", response.status);
  }
  return result.output;
};
