import { pageTitle } from "../../lib/page-title";

export const meta = () => [{ title: pageTitle("プロフィール") }];

const Profile = () => (
  <div>
    <h1 className="font-semibold text-xl">プロフィール</h1>
  </div>
);

export default Profile;
