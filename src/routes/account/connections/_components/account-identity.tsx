import { cn } from "cn";
import { ProviderIcon } from "../../../../components/provider-icon";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../../../components/ui/avatar";
import type { LinkedAccount } from "../../../../lib/idp/linked-accounts";
import {
  type LinkProvider,
  providerLabel,
} from "../../../../lib/idp/providers";

interface AccountIdentityProps {
  provider: LinkProvider;
  account: LinkedAccount;
  className?: string;
}

/** Avatar (falling back to the Provider's mark) plus display name, shared by the account list row and the unlink confirmation dialog. */
export const AccountIdentity = ({
  provider,
  account,
  className,
}: AccountIdentityProps) => (
  <div className={cn("flex min-w-0 items-center gap-3", className)}>
    <Avatar className="size-9 shrink-0">
      <AvatarImage src={account.providerAvatarUrl ?? undefined} alt="" />
      <AvatarFallback>
        <ProviderIcon provider={provider} className="size-4" />
      </AvatarFallback>
    </Avatar>
    <span className="min-w-0 flex-1 truncate text-sm">
      {account.providerDisplayName ?? providerLabel(provider)}
    </span>
  </div>
);
