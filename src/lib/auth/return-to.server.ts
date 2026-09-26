const FALLBACK_RETURN_TO = "/";

// Any origin works here; it only exists so URL parsing can tell a same-origin
// relative path apart from something that resolves off-site.
const RETURN_TO_BASE = "http://return-to.invalid";

/**
 * Restricts `returnTo` to a same-origin relative path so the OIDC login/callback
 * flow can never be used as an open redirect.
 *
 * Rejects absolute URLs, protocol-relative URLs (`//evil.example`), and
 * backslash tricks (`/\evil.example`, which browsers treat as `//evil.example`),
 * falling back to `/` for anything that doesn't resolve to a same-origin path.
 */
export const sanitizeReturnTo = (value: string | null): string => {
  if (!value?.startsWith("/")) {
    return FALLBACK_RETURN_TO;
  }

  try {
    const resolved = new URL(value, RETURN_TO_BASE);
    return resolved.origin === RETURN_TO_BASE
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : FALLBACK_RETURN_TO;
  } catch {
    return FALLBACK_RETURN_TO;
  }
};
