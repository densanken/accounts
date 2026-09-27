import * as v from "valibot";
import { idpFetch } from "./client";

const profileSchema = v.object({
  name: v.nullable(v.string()),
  bio: v.nullable(v.string()),
  picture: v.nullable(v.string()),
  pictureLinkedAccountId: v.nullable(v.string()),
});

export type Profile = v.InferOutput<typeof profileSchema>;

export const getProfile = (idpOrigin: string): Promise<Profile> =>
  idpFetch(idpOrigin, "/users/me", profileSchema);

// PATCH semantics: only fields present in the update are changed, so callers
// should only include the ones the user actually edited.
export interface ProfileUpdate {
  name?: string;
  bio?: string | null;
  pictureLinkedAccountId?: string | null;
}

export const updateProfile = (
  idpOrigin: string,
  update: ProfileUpdate
): Promise<Profile> =>
  idpFetch(idpOrigin, "/users/me", profileSchema, {
    method: "PATCH",
    json: update,
  });
