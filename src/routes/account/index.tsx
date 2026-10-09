import { pageTitle } from "../../lib/page-title";
import { ProfileForm } from "./_components/profile-form";
import type { Route } from "./+types/index";

type Match = Route.MetaArgs["matches"][number];

// Public: the parent layout renders a login screen here instead of this
// component when there's no session, so the title reflects the parent
// layout's `authenticated` loader data rather than assuming this page renders.
export const meta: Route.MetaFunction = ({ matches }) => {
  const layout = matches.find(
    (match): match is Extract<Match, { id: "routes/account/layout" }> =>
      match?.id === "routes/account/layout"
  );
  const title = layout?.loaderData.authenticated ? "プロフィール" : "ログイン";
  return [{ title: pageTitle(title) }];
};

const Profile = () => (
  <div className="flex flex-col gap-6">
    <h1 className="font-semibold text-xl">プロフィール</h1>
    <ProfileForm />
  </div>
);

export default Profile;
