import { Button } from "../../../../components/ui/button";
import {
  type LinkProvider,
  providerLabel,
} from "../../../../lib/idp/providers";

interface ConnectFormProps {
  idpOrigin: string;
  provider: LinkProvider;
  /** True once the provider already has at least one linked account. */
  additional?: boolean;
}

/**
 * Starts the link flow with a plain HTML form POST, not `fetch()`, so the
 * browser follows the Provider OAuth redirect chain as an ordinary
 * navigation instead of an XHR.
 */
export const ConnectForm = ({
  idpOrigin,
  provider,
  additional,
}: ConnectFormProps) => (
  <form method="post" action={`${idpOrigin}/auth/link/${provider}`}>
    <Button type="submit" variant="outline" size="lg">
      {additional
        ? `別の${providerLabel(provider)}アカウントを連携する`
        : `${providerLabel(provider)}を連携する`}
    </Button>
  </form>
);
