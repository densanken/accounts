import { Blocks, UserRound, UserRoundCog } from "lucide-react";
import { Form, Link, Outlet, useLocation, useSearchParams } from "react-router";
import { Button } from "../../components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "../../components/ui/sidebar";
import { cloudflareContext } from "../../context";
import { loginPath } from "../../lib/auth/login-path";
import { hasSession } from "../../lib/auth/require-session.server";
import { ThemeToggle } from "./_components/theme-toggle";
import type { Route } from "./+types/layout";

// This layout has no middleware of its own: the index route is public (see
// routes.ts), and guarded routes below it run their own session check via
// guard.ts. This loader only needs to report whether there's a session, so
// the component can pick the login screen or the authenticated shell.
export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { env } = context.get(cloudflareContext);
  return { authenticated: await hasSession(request, env) };
};

const navItems = [
  { to: "/", label: "プロフィール", icon: UserRound },
  { to: "/connections", label: "外部アカウント連携", icon: Blocks },
];

const AppTitle = () => (
  <span className="flex items-center gap-2 font-semibold text-sm">
    <UserRoundCog className="size-5" />
    CCS Account
  </span>
);

// Maps better-auth's onAPIError `error` query param to a Japanese message.
// The IdP collapses its own login errors (Discord server membership,
// already-linked accounts, disabled users, ...) into the standard OAuth codes,
// so access_denied covers more than a cancellation. Anything not listed falls
// back to a generic message.
const authErrorMessages: Record<string, string> = {
  access_denied: "ログインがキャンセルされたか、許可されませんでした",
  login_required:
    "ログインの有効期限が切れました。もう一度ログインしてください",
};

const AuthErrorBanner = () => {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");
  if (!error) {
    return null;
  }

  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm"
    >
      {authErrorMessages[error] ?? "ログインに失敗しました"}
    </div>
  );
};

const LoginScreen = () => {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("return_to") ?? "/";

  return (
    <div className="grid min-h-svh grid-rows-[1fr_auto_2fr] justify-items-center p-6">
      <main className="row-start-2 flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <h1 className="flex items-center gap-2 font-bold text-2xl">
          <UserRoundCog className="size-7" />
          CCS Account
        </h1>
        <AuthErrorBanner />
        <Button
          size="lg"
          className="h-11 w-full text-base"
          render={<Link reloadDocument to={loginPath(returnTo)} />}
        >
          Sign in with CCS ID
        </Button>
      </main>
    </div>
  );
};

// Rendered inside <SidebarProvider>, so it can close the mobile sheet on navigation.
const AccountNav = () => {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenu className="gap-2">
      {navItems.map(({ to, label, icon: Icon }) => (
        <SidebarMenuItem key={to}>
          <SidebarMenuButton
            size="lg"
            isActive={location.pathname === to}
            onClick={() => setOpenMobile(false)}
            render={<Link to={to} />}
          >
            <Icon />
            {label}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
};

const AccountLayout = ({ loaderData }: Route.ComponentProps) => {
  if (!loaderData.authenticated) {
    return <LoginScreen />;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-6 pt-8 pb-4">
          <AppTitle />
        </SidebarHeader>
        <SidebarContent>
          {/* SidebarMenuButton adds its own p-2, so the group only needs
              p-4 for the icons to line up with the header's px-6. */}
          <SidebarGroup className="p-4">
            <AccountNav />
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="gap-4 p-4">
          <ThemeToggle />
          <Form method="post" action="/auth/logout" reloadDocument>
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              className="h-10 w-full"
            >
              ログアウト
            </Button>
          </Form>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center gap-4 border-b px-4 py-4 lg:hidden">
          <SidebarTrigger aria-label="メニューを開く" />
          <AppTitle />
        </header>
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AccountLayout;
