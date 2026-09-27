import { pageTitle } from "../../lib/page-title";
import { ProfileForm } from "./_components/profile-form";

// Public: the parent layout renders a login screen here instead of this
// component when there's no session. Any loader added to this route must
// handle the unauthenticated case itself (see routes/account/layout.tsx).
export const meta = () => [{ title: pageTitle("プロフィール") }];

const Profile = () => (
  <div className="flex flex-col gap-6">
    <h1 className="font-semibold text-xl">プロフィール</h1>
    <ProfileForm />
  </div>
);

export default Profile;
