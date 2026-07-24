"use client";

import type { ReactNode } from "react";
import {
  Bot,
  CalendarDays,
  History,
  ListChecks,
  LogOut,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceView =
  | "today"
  | "operations-agent"
  | "workflow-snapshot"
  | "client-records"
  | "action-queue"
  | "activity";

type NavigationItem = {
  icon: LucideIcon;
  label: string;
  view: WorkspaceView;
};

const navigationItems: NavigationItem[] = [
  {
    icon: CalendarDays,
    label: "Today",
    view: "today",
  },
  {
    icon: Bot,
    label: "Operations Agent",
    view: "operations-agent",
  },
  {
    icon: Workflow,
    label: "Workflow Snapshot",
    view: "workflow-snapshot",
  },
  {
    icon: Users,
    label: "Client Records",
    view: "client-records",
  },
  {
    icon: ListChecks,
    label: "Action Queue",
    view: "action-queue",
  },
  {
    icon: History,
    label: "Activity",
    view: "activity",
  },
];

type WorkspaceNavigationProps = {
  activeView: WorkspaceView;
  isCompact?: boolean;
  onViewChange: (view: WorkspaceView) => void;
};

function WorkspaceNavigation({
  activeView,
  isCompact = false,
  onViewChange,
}: WorkspaceNavigationProps) {
  return (
    <nav
      aria-label="Workspace navigation"
      className={
        isCompact
          ? "flex w-full max-w-full gap-2 overflow-x-auto px-4 pb-3 sm:px-6"
          : "grid gap-1"
      }
    >
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.view;

        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-bold transition-colors ${
              isCompact ? "shrink-0" : "w-full"
            } ${
              isActive
                ? isCompact
                  ? "bg-[#174F42] text-white"
                  : "bg-white text-[#174F42]"
                : isCompact
                  ? "bg-[#EDF3EF] text-[#17201C] hover:bg-[#D9DED8]"
                  : "text-[#DCE8E3] hover:bg-[#1A4037] hover:text-white"
            }`}
            key={item.view}
            onClick={() => onViewChange(item.view)}
            type="button"
          >
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

type WorkspaceShellProps = {
  activeView: WorkspaceView;
  children: ReactNode;
  onSignOut: () => void;
  onViewChange: (view: WorkspaceView) => void;
  userEmail: string | null;
  workspaceName: string;
};

export function WorkspaceShell({
  activeView,
  children,
  onSignOut,
  onViewChange,
  userEmail,
  workspaceName,
}: WorkspaceShellProps) {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#F7F8F6] text-[#17201C] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-md bg-white px-4 py-3 font-bold text-[#174F42] shadow-lg transition-transform focus:translate-y-0"
        href="#workspace-view"
      >
        Skip to workspace content
      </a>
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-[#285247] bg-[#10372F] px-4 py-5 text-white lg:flex">
        <div className="border-b border-[#386157] px-2 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#BDD0C9]">
            Client Operations
          </p>
          <h1
            className="mt-2 truncate text-xl font-bold"
            title={workspaceName}
          >
            {workspaceName}
          </h1>
          {userEmail ? (
            <p
              className="mt-1 truncate text-sm text-[#BDD0C9]"
              title={userEmail}
            >
              {userEmail}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex-1">
          <WorkspaceNavigation
            activeView={activeView}
            onViewChange={onViewChange}
          />
        </div>

        <button
          className="flex min-h-11 w-full items-center gap-3 rounded-md border border-[#4D746A] px-3 py-2 text-sm font-bold text-white hover:bg-[#1A4037]"
          onClick={onSignOut}
          type="button"
        >
          <LogOut aria-hidden="true" className="h-5 w-5" />
          Sign out
        </button>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 max-w-full border-b border-[#D9DED8] bg-white lg:hidden">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5F6862]">
                Client Operations
              </p>
              <p className="truncate font-bold" title={workspaceName}>
                {workspaceName}
              </p>
            </div>
            <button
              aria-label="Sign out"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#D9DED8] text-[#174F42] hover:bg-[#EDF3EF]"
              onClick={onSignOut}
              title="Sign out"
              type="button"
            >
              <LogOut aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <WorkspaceNavigation
            activeView={activeView}
            isCompact
            onViewChange={onViewChange}
          />
        </header>

        <main className="min-w-0" id="workspace-view" tabIndex={-1}>
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
