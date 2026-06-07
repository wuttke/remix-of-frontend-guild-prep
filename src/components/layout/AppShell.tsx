import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FolderGit2, MessageSquare, Terminal } from "lucide-react";
import { isMockMode } from "@/lib/pdg/client";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/repos", label: "Repos", icon: FolderGit2 },
  { to: "/conversations", label: "Chats", icon: MessageSquare },
  { to: "/jobs", label: "Jobs", icon: Terminal },
] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/repos" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground font-bold">
              ⌥
            </span>
            <span className="font-display text-base font-semibold tracking-tight">
              Pocket Dev Guild
            </span>
          </Link>
          {isMockMode ? (
            <span className="rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              mock
            </span>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-3xl grid-cols-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_var(--primary)]")} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}