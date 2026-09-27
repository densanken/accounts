import { cn } from "cn";
import { ProviderIcon } from "../../../../components/provider-icon";
import type { LinkedAccount } from "../../../../lib/idp/linked-accounts";
import {
  LAST_DISCORD_ACCOUNT_MESSAGE,
  type LinkProvider,
  providerLabel,
} from "../../../../lib/idp/providers";
import { AccountIdentity } from "./account-identity";
import { ConnectForm } from "./connect-form";
import { UnlinkDialog } from "./unlink-dialog";

const guildMembershipBadges = {
  allowed: {
    label: "サーバーメンバー",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  denied: {
    label: "サーバー未参加",
    className: "border-destructive/50 bg-destructive/10 text-destructive",
  },
  unchecked: {
    label: "未確認",
    className: "border-border bg-muted text-muted-foreground",
  },
} as const;

// The IdP requires at least one Discord account, and at least one
// "allowed" one - both only enforced here as a UI nicety, the IdP enforces
// them regardless. Only ever called for Discord accounts.
const discordDisabledReason = (
  account: LinkedAccount,
  accounts: LinkedAccount[]
): string | null => {
  if (accounts.length === 1) return LAST_DISCORD_ACCOUNT_MESSAGE;
  const isOnlyAllowed =
    account.guildMembership === "allowed" &&
    !accounts.some(
      (other) => other.id !== account.id && other.guildMembership === "allowed"
    );
  return isOnlyAllowed
    ? "サーバーメンバーのアカウントを1件以上残す必要があります。"
    : null;
};

interface AccountRowProps {
  idpOrigin: string;
  provider: LinkProvider;
  account: LinkedAccount;
  disabledReason: string | null;
}

const AccountRow = ({
  idpOrigin,
  provider,
  account,
  disabledReason,
}: AccountRowProps) => {
  // Membership only means anything for Discord.
  const badge =
    provider === "discord"
      ? guildMembershipBadges[account.guildMembership ?? "unchecked"]
      : undefined;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <AccountIdentity
          provider={provider}
          account={account}
          className="flex-1"
        />
        {badge && (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-medium text-xs",
              badge.className
            )}
          >
            {badge.label}
          </span>
        )}
        <UnlinkDialog
          idpOrigin={idpOrigin}
          provider={provider}
          account={account}
          disabled={disabledReason !== null}
        />
      </div>
      {disabledReason && (
        <p className="text-muted-foreground text-xs">{disabledReason}</p>
      )}
    </div>
  );
};

interface ConnectionCardProps {
  idpOrigin: string;
  provider: LinkProvider;
  accounts: LinkedAccount[];
}

/**
 * One Provider's section of the Connections list: its linked accounts (if
 * any), each with its own Disconnect, plus a Connect button that stays
 * available even once linked (the IdP allows more than one account per
 * Provider). Kept as a list of accounts (not a single optional one) so
 * several accounts for the same Provider each render their own row.
 */
export const ConnectionCard = ({
  idpOrigin,
  provider,
  accounts,
}: ConnectionCardProps) => {
  // `null` means unchecked (the IdP rechecks at login), so only warn once
  // every account has actually come back denied.
  const allDenied =
    provider === "discord" &&
    accounts.length > 0 &&
    accounts.every((account) => account.guildMembership === "denied");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <ProviderIcon provider={provider} className="size-6" />
        {providerLabel(provider)}
      </h2>
      {allDenied && (
        <p role="alert" className="text-destructive text-xs">
          現在サーバーメンバーのDiscordアカウントがないため、ログインできない可能性があります。サーバーに参加してから再度ログインしてください。
        </p>
      )}
      {accounts.length === 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3">
          <span className="text-muted-foreground text-sm">未接続</span>
          <ConnectForm idpOrigin={idpOrigin} provider={provider} />
        </div>
      ) : (
        <>
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              idpOrigin={idpOrigin}
              provider={provider}
              account={account}
              disabledReason={
                provider === "discord"
                  ? discordDisabledReason(account, accounts)
                  : null
              }
            />
          ))}
          <ConnectForm idpOrigin={idpOrigin} provider={provider} additional />
        </>
      )}
    </section>
  );
};
