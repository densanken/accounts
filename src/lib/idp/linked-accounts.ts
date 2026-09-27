import * as v from "valibot";
import { idpFetch } from "./client";

const linkedAccountSchema = v.object({
  id: v.string(),
  provider: v.string(),
  providerAvatarUrl: v.nullable(v.string()),
  providerDisplayName: v.nullable(v.string()),
  // null for a non-Discord account, or a Discord account not checked yet.
  guildMembership: v.nullable(v.picklist(["allowed", "denied"])),
});

export type LinkedAccount = v.InferOutput<typeof linkedAccountSchema>;

const linkedAccountsResponseSchema = v.object({
  linkedAccounts: v.array(linkedAccountSchema),
});

export const getLinkedAccounts = async (
  idpOrigin: string
): Promise<LinkedAccount[]> => {
  const { linkedAccounts } = await idpFetch(
    idpOrigin,
    "/users/me/linked-accounts",
    linkedAccountsResponseSchema
  );
  return linkedAccounts;
};

export const unlinkAccount = (
  idpOrigin: string,
  provider: string,
  linkedAccountId: string
): Promise<void> =>
  idpFetch(
    idpOrigin,
    `/auth/link/${provider}/${linkedAccountId}`,
    v.undefined(),
    { method: "DELETE" }
  );
