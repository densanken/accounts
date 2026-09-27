import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "../root";

/** The IdP's origin, provided by the root loader from `IDP_ISSUER`. */
export const useIdpOrigin = (): string =>
  // biome-ignore lint/style/noNonNullAssertion: the root loader always runs.
  useRouteLoaderData<typeof rootLoader>("root")!.idpOrigin;
