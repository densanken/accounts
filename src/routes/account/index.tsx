import { pageTitle } from "../../lib/page-title";

// Public: the parent layout renders a login screen here instead of this
// component when there's no session. Any loader added to this route must
// handle the unauthenticated case itself (see routes/account/layout.tsx).
export const meta = () => [{ title: pageTitle("プロフィール") }];

const Profile = () => (
  <div>
    <h1 className="font-semibold text-xl">プロフィール</h1>
  </div>
);

export default Profile;
