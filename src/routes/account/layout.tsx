import { Blocks, UserRound, UserRoundCog } from "lucide-react";
import { Form, Link, Outlet, useLocation } from "react-router";
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
import { ThemeToggle } from "./_components/theme-toggle";

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

const AccountLayout = () => {
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
