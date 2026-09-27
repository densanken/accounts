import { pageTitle } from "../../../lib/page-title";
import { ConnectionsList } from "./_components/connections-list";

export const meta = () => [{ title: pageTitle("外部アカウント連携") }];

const Connections = () => (
  <div className="flex flex-col gap-6">
    <h1 className="font-semibold text-xl">外部アカウント連携</h1>
    <ConnectionsList />
  </div>
);

export default Connections;
