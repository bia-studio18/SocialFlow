import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  ChartColumn,
  CircleHelp,
  CreditCard,
  Image,
  LayoutDashboard,
  History,
  Link2,
  PenLine,
  Settings,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { toast } from "sonner";
import { UserButton, RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { actions, errText, useAction, useBoot } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app")({ component: AppLayout });

const LINKS: { to: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/compose", label: "Composer", icon: PenLine },
  { to: "/app/media", label: "Media", icon: Image },
  { to: "/app/accounts", label: "Accounts", icon: Link2 },
  { to: "/app/history", label: "History", icon: History },
  { to: "/app/analytics", label: "Analytics", icon: ChartColumn },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/team", label: "Team", icon: Users },
  { to: "/app/notifications", label: "Inbox", icon: Bell },
  { to: "/app/settings", label: "Workspace", icon: Settings },
  { to: "/app/profile", label: "Profile", icon: UserRound },
  { to: "/app/help", label: "Help", icon: CircleHelp },
  { to: "/app/admin", label: "Admin", icon: Shield },
];

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const boot = useBoot();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const switcher = useAction(actions.setActiveWorkspace);

  if (isPending || (user && boot.isPending)) {
    return (
      <div className="min-h-screen bg-paper px-6 py-8 text-ink">
        <p className="font-display text-3xl">SocialFlow</p>
        <div className="mt-6 h-24 animate-pulse rounded-card bg-line" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (boot.isError) {
    const message = errText(boot.error);
    if (message.toLowerCase().includes("unauthorized")) return <RedirectToSignIn />;
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-6 text-center">
        <div>
          <h1 className="font-display text-3xl">Could not open your workspace</h1>
          <p className="mt-2 text-sm text-muted">{message}</p>
        </div>
      </main>
    );
  }
  const data = boot.data;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-paper text-ink md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="bg-navy text-accent-ink md:min-h-screen">
        <div className="px-4 py-4">
          <Link to="/app" className="font-display text-2xl">
            SocialFlow
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {LINKS.map((link) => {
            const active = link.to === "/app" ? path === "/app" : path.startsWith(link.to);
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex min-h-11 items-center gap-2 rounded-control px-3 text-sm whitespace-nowrap ${active ? "bg-navy-2" : "hover:bg-navy-2"}`}
              >
                <Icon className="size-4 shrink-0" />
                {link.label}
                {link.to === "/app/notifications" && data.unread > 0 ? (
                  <span className="ml-auto rounded-full bg-accent px-1.5 text-xs tabular-nums text-accent-ink">
                    {data.unread}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 hidden rounded-card bg-card p-3 text-ink md:block">
          <UserButton />
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <label className="text-sm font-medium">
            <span className="mr-2 text-muted">Workspace</span>
            <select
              className="sf-input w-auto min-w-40"
              value={data.activeWorkspaceId}
              onChange={(event) => {
                switcher.mutate(
                  { workspaceId: event.target.value },
                  { onError: (error) => toast.error(errText(error)) },
                );
              }}
            >
              {data.workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} · {workspace.role}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-card bg-card px-3 py-1 md:hidden">
            <UserButton />
          </div>
        </header>
        <main className="px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
