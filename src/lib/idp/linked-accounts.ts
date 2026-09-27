import * as v from "valibot";
import { idpFetch } from "./client";

const linkedAccountSchema = v.object({
  id: v.string(),
  provider: v.string(),
  providerAvatarUrl: v.nullable(v.string()),
  providerDisplayName: v.nullable(v.string()),
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
