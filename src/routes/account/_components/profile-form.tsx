import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import type * as React from "react";
import { useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../../components/ui/avatar";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Skeleton } from "../../../components/ui/skeleton";
import { Textarea } from "../../../components/ui/textarea";
import { useIdpOrigin } from "../../../hooks/use-idp-origin";
import { IdpApiError } from "../../../lib/idp/client";
import {
  getLinkedAccounts,
  type LinkedAccount,
} from "../../../lib/idp/linked-accounts";
import {
  getProfile,
  type Profile,
  type ProfileUpdate,
  updateProfile,
} from "../../../lib/idp/profile";
import { queryKeys } from "../../../lib/query/keys";
import { AvatarSelector, fieldLabelClassName } from "./avatar-selector";

const ErrorAlert = ({ children }: { children: React.ReactNode }) => (
  <div
    role="alert"
    className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm"
  >
    {children}
  </div>
);

const saveErrorMessage = (error: unknown): string =>
  error instanceof IdpApiError && error.code === "validation"
    ? "入力内容を確認してください。"
    : "プロフィールの更新に失敗しました。";

// Array.from splits by code point, so a multi-byte emoji is kept whole
// instead of showing half a surrogate pair.
const avatarInitial = (name: string): string =>
  (Array.from(name)[0] ?? "?").toUpperCase();

/**
 * The avatar for a given picture selection, while editing: the selected
 * candidate's avatar, or - while the selection still matches what's saved -
 * the IdP's own resolved `picture` (which works even before linked accounts
 * have loaded).
 */
const previewPictureUrl = (
  linkedAccounts: LinkedAccount[],
  pictureLinkedAccountId: string | null,
  saved: Pick<Profile, "picture" | "pictureLinkedAccountId">
): string | undefined =>
  pictureLinkedAccountId === saved.pictureLinkedAccountId
    ? (saved.picture ?? undefined)
    : (linkedAccounts.find((account) => account.id === pictureLinkedAccountId)
        ?.providerAvatarUrl ?? undefined);

const actionButtonClassName = "h-10 px-5";

// Shared with the loading skeleton so it matches the loaded layout.
const layoutClassName = "flex max-w-2xl flex-col gap-8";
const headerClassName =
  "flex flex-wrap items-center gap-5 rounded-xl bg-linear-to-r from-primary/15 to-primary/5 p-6";
// Its own full-width row on narrow screens, so the header height is the same
// in every mode.
const actionsClassName =
  "flex w-full items-center justify-end gap-3 sm:ml-auto sm:w-auto";

interface ProfileLayoutProps {
  avatarUrl: string | undefined;
  name: string;
  /** Edit mode: the header echoes the input, so hide it from screen readers. */
  nameHidden?: boolean;
  children: React.ReactNode;
  actions: React.ReactNode;
}

/** Shared layout for both modes: accent header band with the actions, then fields. */
const ProfileLayout = ({
  avatarUrl,
  name,
  nameHidden,
  children,
  actions,
}: ProfileLayoutProps) => {
  // In edit mode the name is only a visual echo of the input, not a heading.
  const NameTag = nameHidden ? "p" : "h2";
  return (
    <div className={layoutClassName}>
      <div className={headerClassName}>
        <Avatar className="size-20 ring-2 ring-primary ring-offset-2 ring-offset-background">
          <AvatarImage src={avatarUrl} alt="" />
          <AvatarFallback className="text-2xl">
            {avatarInitial(name)}
          </AvatarFallback>
        </Avatar>
        <NameTag
          aria-hidden={nameHidden}
          className={cn(
            "min-w-0 truncate font-semibold text-2xl",
            !name && "text-muted-foreground"
          )}
        >
          {name || "名前未設定"}
        </NameTag>
        <div className={actionsClassName}>{actions}</div>
      </div>
      <div className="flex flex-col gap-6 px-1">{children}</div>
    </div>
  );
};

interface ProfileViewProps {
  profile: Profile;
  showSaved: boolean;
  /** Set after leaving edit mode, to put focus back on 編集. */
  focusEdit: boolean;
  onEdit: () => void;
}

const ProfileView = ({
  profile,
  showSaved,
  focusEdit,
  onEdit,
}: ProfileViewProps) => (
  <ProfileLayout
    avatarUrl={profile.picture ?? undefined}
    name={profile.name ?? ""}
    actions={
      <>
        <span role="status" className="text-muted-foreground text-sm">
          {showSaved && "保存しました"}
        </span>
        <Button
          type="button"
          autoFocus={focusEdit}
          className={actionButtonClassName}
          onClick={onEdit}
        >
          編集
        </Button>
      </>
    }
  >
    <dl className="flex flex-col gap-1.5">
      <dt className={fieldLabelClassName}>自己紹介</dt>
      <dd
        className={cn(
          "whitespace-pre-wrap",
          !profile.bio && "text-muted-foreground"
        )}
      >
        {profile.bio || "未設定"}
      </dd>
    </dl>
  </ProfileLayout>
);

interface ProfileEditFormProps {
  profile: Profile;
  /** Undefined while linked accounts are still loading, or failed to load. */
  linkedAccounts: LinkedAccount[] | undefined;
  linkedAccountsError: boolean;
  idpOrigin: string;
  onCancel: () => void;
  onSaved: () => void;
}

const ProfileEditForm = ({
  profile,
  linkedAccounts,
  linkedAccountsError,
  idpOrigin,
  onCancel,
  onSaved,
}: ProfileEditFormProps) => {
  const queryClient = useQueryClient();
  // Frozen at mount: a background refetch mid-edit (e.g. from another tab)
  // must not change what an edit to a different field sends.
  const [initial] = useState(profile);
  const [name, setName] = useState(initial.name ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  // Kept as the raw saved id even if it's not currently selectable.
  const [pictureLinkedAccountId, setPictureLinkedAccountId] = useState(
    initial.pictureLinkedAccountId
  );

  // Trimmed before comparing, so a whitespace-only change isn't treated as
  // an edit, and before sending, since the trimmed value is what's PATCHed.
  const trimmedName = name.trim();
  const trimmedBio = bio.trim();
  const initialName = (initial.name ?? "").trim();
  const initialBio = (initial.bio ?? "").trim();

  // Only send the fields the user actually changed.
  const update: ProfileUpdate = {};
  if (trimmedName !== initialName) update.name = trimmedName;
  if (trimmedBio !== initialBio) update.bio = trimmedBio || null;
  if (pictureLinkedAccountId !== initial.pictureLinkedAccountId) {
    update.pictureLinkedAccountId = pictureLinkedAccountId;
  }
  const dirty = Object.keys(update).length > 0;

  const mutation = useMutation({
    mutationFn: () => updateProfile(idpOrigin, update),
    onSuccess: async (updatedProfile) => {
      // A GET still in flight may carry pre-save data and would otherwise
      // overwrite this once it lands.
      await queryClient.cancelQueries({ queryKey: queryKeys.profile });
      queryClient.setQueryData(queryKeys.profile, updatedProfile);
      onSaved();
    },
  });

  const selectedAvatarUrl = previewPictureUrl(
    linkedAccounts ?? [],
    pictureLinkedAccountId,
    initial
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit}>
      <ProfileLayout
        avatarUrl={selectedAvatarUrl}
        name={trimmedName}
        nameHidden
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className={actionButtonClassName}
              onClick={onCancel}
              disabled={mutation.isPending}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              className={actionButtonClassName}
              disabled={!dirty || !trimmedName || mutation.isPending}
            >
              保存
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-name" className={fieldLabelClassName}>
            表示名
          </label>
          <Input
            id="profile-name"
            autoFocus
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              mutation.reset();
            }}
            disabled={mutation.isPending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-bio" className={fieldLabelClassName}>
            自己紹介
          </label>
          <Textarea
            id="profile-bio"
            value={bio}
            onChange={(event) => {
              setBio(event.target.value);
              mutation.reset();
            }}
            disabled={mutation.isPending}
          />
        </div>

        {linkedAccounts === undefined ? (
          linkedAccountsError ? (
            <p className={cn(fieldLabelClassName, "font-normal")}>
              画像候補を読み込めませんでした。
            </p>
          ) : (
            <Skeleton className="h-11 w-full" />
          )
        ) : (
          <AvatarSelector
            linkedAccounts={linkedAccounts}
            value={pictureLinkedAccountId}
            onChange={(value) => {
              setPictureLinkedAccountId(value);
              mutation.reset();
            }}
            disabled={mutation.isPending}
          />
        )}

        {mutation.isError && (
          <ErrorAlert>{saveErrorMessage(mutation.error)}</ErrorAlert>
        )}
      </ProfileLayout>
    </form>
  );
};

export const ProfileForm = () => {
  const idpOrigin = useIdpOrigin();
  const [editing, setEditing] = useState(false);
  // How editing last ended; null until the user has edited once.
  const [lastEditEnd, setLastEditEnd] = useState<null | "cancel" | "saved">(
    null
  );

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => getProfile(idpOrigin),
  });
  const linkedAccountsQuery = useQuery({
    queryKey: queryKeys.linkedAccounts,
    queryFn: () => getLinkedAccounts(idpOrigin),
  });

  // Only the profile query gates the page: linked accounts are only needed
  // for the picture selector, so if they're slow or fail, the profile itself
  // (and, in edit mode, everything but that selector) still renders.
  if (profileQuery.isPending) {
    return (
      <div className={layoutClassName}>
        <div className={headerClassName}>
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="h-8 w-40" />
          <div className={actionsClassName}>
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
        <div className="flex flex-col gap-3 px-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  // `data`, not `isError`: a failed background refetch shouldn't discard
  // already-loaded data.
  if (profileQuery.data === undefined) {
    return <ErrorAlert>プロフィールを読み込めませんでした。</ErrorAlert>;
  }

  if (editing) {
    return (
      <ProfileEditForm
        profile={profileQuery.data}
        linkedAccounts={linkedAccountsQuery.data}
        linkedAccountsError={linkedAccountsQuery.isError}
        idpOrigin={idpOrigin}
        onCancel={() => {
          setEditing(false);
          setLastEditEnd("cancel");
        }}
        onSaved={() => {
          setEditing(false);
          setLastEditEnd("saved");
        }}
      />
    );
  }

  return (
    <ProfileView
      profile={profileQuery.data}
      showSaved={lastEditEnd === "saved"}
      focusEdit={lastEditEnd !== null}
      onEdit={() => setEditing(true)}
    />
  );
};
