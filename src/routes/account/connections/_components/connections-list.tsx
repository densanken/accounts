import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Skeleton } from "../../../../components/ui/skeleton";
import { useIdpOrigin } from "../../../../hooks/use-idp-origin";
import { getLinkedAccounts } from "../../../../lib/idp/linked-accounts";
import { LINK_PROVIDERS } from "../../../../lib/idp/providers";
import { queryKeys } from "../../../../lib/query/keys";
import { ConnectionCard } from "./connection-card";

const ErrorAlert = ({ children }: { children: React.ReactNode }) => (
  <div
    role="alert"
    className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm"
  >
    {children}
  </div>
);

// The IdP's public error codes for the link flow; anything else falls back
// to a generic message.
const linkErrorMessages: Record<string, string> = {
  access_denied: "連携がキャンセルされました。",
  // The IdP reports this even if the account is already linked to the
  // current user (it doesn't compare user ids), so the wording stays
  // neutral rather than implying it's necessarily someone else's.
  account_already_linked: "このアカウントはすでにCCS IDに連携されています。",
  // The IdP returns this when /auth/link/:provider is started without an
  // IdP session (Accounts's own session can outlive it).
  login_forbidden: "セッションが切れています。再度ログインしてください。",
  provider_unconfigured: "このサービスとの連携は現在利用できません。",
};

const linkErrorMessage = (code: string): string =>
  linkErrorMessages[code] ?? "アカウントの連携に失敗しました。";

/**
 * Reads the IdP callback's `linked`/`error` query parameters once on mount
 * and then strips them from the URL, so a page reload doesn't re-show the
 * result.
 */
const useLinkResult = (): {
  type: "success" | "error";
  message: string;
} | null => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [result] = useState(() => {
    if (searchParams.get("linked") === "true") {
      return {
        type: "success" as const,
        message: "アカウントを連携しました。",
      };
    }
    const error = searchParams.get("error");
    if (error) {
      return { type: "error" as const, message: linkErrorMessage(error) };
    }
    return null;
  });

  useEffect(() => {
    if (!result) return;
    setSearchParams(
      (prev) => {
        prev.delete("linked");
        prev.delete("error");
        return prev;
      },
      { replace: true }
    );
  }, [result, setSearchParams]);

  return result;
};

const LinkResultBanner = () => {
  const result = useLinkResult();
  if (!result) return null;

  return result.type === "success" ? (
    <div
      role="status"
      className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm"
    >
      {result.message}
    </div>
  ) : (
    <ErrorAlert>{result.message}</ErrorAlert>
  );
};

export const ConnectionsList = () => {
  const idpOrigin = useIdpOrigin();
  const query = useQuery({
    queryKey: queryKeys.linkedAccounts,
    queryFn: () => getLinkedAccounts(idpOrigin),
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <LinkResultBanner />

      {query.isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {/* `!query.data`, not just `isError`: a failed background refetch
          shouldn't hide an already-loaded list. */}
      {query.isError && !query.data && (
        <ErrorAlert>連携アカウントを読み込めませんでした。</ErrorAlert>
      )}

      {query.data && (
        <div className="flex flex-col gap-6">
          {LINK_PROVIDERS.map((provider) => (
            <ConnectionCard
              key={provider}
              idpOrigin={idpOrigin}
              provider={provider}
              accounts={query.data.filter(
                (account) => account.provider === provider
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};
