import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../../components/ui/alert-dialog";
import { Button } from "../../../../components/ui/button";
import { IdpApiError } from "../../../../lib/idp/client";
import {
  type LinkedAccount,
  unlinkAccount,
} from "../../../../lib/idp/linked-accounts";
import {
  LAST_DISCORD_ACCOUNT_MESSAGE,
  type LinkProvider,
  providerLabel,
} from "../../../../lib/idp/providers";
import { queryKeys } from "../../../../lib/query/keys";
import { AccountIdentity } from "./account-identity";

// Already gone (e.g. unlinked from another tab) - there's nothing left to
// undo, so this isn't shown to the user as a failure.
const isAlreadyUnlinked = (error: unknown): boolean =>
  error instanceof IdpApiError && error.code === "linked_account_not_found";

const unlinkErrorMessage = (error: unknown): string => {
  if (error instanceof IdpApiError && error.code === "last_discord_account") {
    return LAST_DISCORD_ACCOUNT_MESSAGE;
  }
  return "連携解除に失敗しました。";
};

interface UnlinkDialogProps {
  idpOrigin: string;
  provider: LinkProvider;
  account: LinkedAccount;
  disabled: boolean;
}

export const UnlinkDialog = ({
  idpOrigin,
  provider,
  account,
  disabled,
}: UnlinkDialogProps) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => unlinkAccount(idpOrigin, account.provider, account.id),
    onSuccess: () => {
      setOpen(false);
    },
    onError: (error) => {
      if (isAlreadyUnlinked(error)) setOpen(false);
    },
    // Both queries, on success or error: an already-unlinked account still
    // needs the stale row cleared, and the unlinked account may have been
    // the Profile picture source.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.linkedAccounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Ignore outside-click/Escape while the request is in flight.
        if (mutation.isPending) return;
        // Clear a previous failed attempt so reopening starts clean.
        if (next) mutation.reset();
        setOpen(next);
      }}
    >
      <AlertDialogTrigger
        render={<Button type="button" variant="outline" size="lg" />}
        disabled={disabled}
      >
        連携解除
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {providerLabel(provider)}アカウントの連携を解除しますか？
          </AlertDialogTitle>
          <AlertDialogDescription>
            このアカウントでのログインができなくなります。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AccountIdentity
          provider={provider}
          account={account}
          className="rounded-lg border p-3"
        />
        {mutation.isError && !isAlreadyUnlinked(mutation.error) && (
          <p role="alert" className="text-destructive text-sm">
            {unlinkErrorMessage(mutation.error)}
          </p>
        )}
        <AlertDialogFooter>
          {/* No `disabled`: this routes through the `onOpenChange` guard
              above, same as an outside click or Escape. */}
          <AlertDialogClose
            render={<Button type="button" variant="outline" size="lg" />}
          >
            キャンセル
          </AlertDialogClose>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            連携解除
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
