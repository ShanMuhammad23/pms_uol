"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { signOutAndRedirect } from "@/lib/queries/auth-client";
import {
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Shield,
  TableProperties,
  Users,
} from "lucide-react";
import ThemeToggle from "@/app/components/layout/ThemeToggle";
import { ViewAsDropdown } from "@/app/components/layout/ViewAsDropdown";
import { SignOutConfirmModal } from "@/app/components/layout/SignOutConfirmModal";
import { useSidebar } from "@/app/components/layout/sidebar-context";
import { isEmployeeRole } from "@/lib/auth/home-path";
import {
  canAccessDashboardSubmissions,
  isAdminRole,
} from "@/lib/auth/submission-review-roles";
import { cn } from "@/lib/utils";
import { useAdditionalAccess } from "@/app/queries/use-additional-access";
import { type AdditionalAccessModule } from "@/types/additional-access";

const ADMIN_LINKS = [
  {
    href: "/dashboard/forms",
    label: "Forms",
    icon: FileText,
    match: (pathname: string) => pathname.startsWith("/dashboard/forms"),
    module: "FORMS" as AdditionalAccessModule | undefined,
  },
  {
    href: "/dashboard/users",
    label: "Users",
    icon: Users,
    match: (pathname: string) => pathname.startsWith("/dashboard/users"),
    module: "USERS" as AdditionalAccessModule | undefined,
  },
  {
    href: "/dashboard/matrices-and-cycles",
    label: "Matrices and Cycles",
    icon: Grid3X3,
    match: (pathname: string) =>
      pathname.startsWith("/dashboard/matrices-and-cycles"),
    module: "MATRICES_AND_CYCLES" as AdditionalAccessModule | undefined,
  },
  {
    href: "/dashboard/entity-categories",
    label: "Organization Levels",
    icon: Building2,
    match: (pathname: string) =>
      pathname.startsWith("/dashboard/entity-categories"),
    module: "ORGANIZATION_LEVELS" as AdditionalAccessModule | undefined,
  },
] as const;

const SUPER_ADMIN_ONLY_LINKS = [
  {
    href: "/dashboard/security-events",
    label: "Security Events",
    icon: Shield,
    match: (pathname: string) =>
      pathname.startsWith("/dashboard/security-events"),
  },
] as const;

const Sidebar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { collapsed, toggle } = useSidebar();
  const user = session?.user;
  const isEmployee = isEmployeeRole(user?.role);
  const canBulkReview = canAccessDashboardSubmissions(user?.role);
  const isDashboard = pathname === "/dashboard";
  const isMyForms = pathname.startsWith("/dashboard/my-forms");
  const isBulkReview = pathname.startsWith("/dashboard/bulk-assessment");
  const isOrgAdmin = isAdminRole(user?.role);
  const isTrueSuperAdmin = user?.role === "SUPER_ADMIN";
  const { canView } = useAdditionalAccess(
    user?.id ? Number(user.id) : undefined,
    user?.role,
  );

  const allAdminLinks = [
    ...ADMIN_LINKS,
    ...(isTrueSuperAdmin ? SUPER_ADMIN_ONLY_LINKS : []),
  ];

  const adminLinks = isOrgAdmin
    ? allAdminLinks
    : allAdminLinks.filter(
        (link) =>
          "module" in link &&
          link.module &&
          canView(link.module as AdditionalAccessModule),
      );

  const showAdminDropdown = adminLinks.length > 0;
  const isAdminRouteActive = adminLinks.some((link) => link.match(pathname));

  const [adminOpen, setAdminOpen] = useState(isAdminRouteActive);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [wasAdminRouteActive, setWasAdminRouteActive] =
    useState(isAdminRouteActive);
  if (isAdminRouteActive !== wasAdminRouteActive) {
    setWasAdminRouteActive(isAdminRouteActive);
    if (isAdminRouteActive) {
      setAdminOpen(true);
    }
  }

  const initials = user?.name
    ? user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "?";

  const navLinkClass = (active: boolean) =>
    cn(
      "sidebar-nav-link",
      collapsed && "justify-center px-0",
      active
        ? "border-r-4 border-primary "
        : "border-primary hover:border-r-4 hover:bg-primary/10",
    );

  return (
    <aside
      className={cn(
        "no-print fixed top-0 left-0 z-40 flex h-full flex-col overflow-auto border border-r border-slate-300/80 py-6 transition-[width,colors] duration-300 ease-in-out dark:border-white/15",
        collapsed ? "w-[72px]" : "w-[264px]",
      )}
    >
      <div
        className={cn(
          "relative flex items-center gap-2 px-3",
          collapsed ? "flex-col" : "gap-4 px-4",
        )}
      >
        {!collapsed ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <h2 className="text-4xl font-bold">PMS</h2>
          </div>
        ) : null}

        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          <ThemeToggle />
          <button
            type="button"
            onClick={toggle}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300/80 bg-surface text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      <hr className="my-6 border-slate-300/80 dark:border-white/15" />

      <nav aria-label="Primary sidebar navigation" className="flex-1">
        <ul className="space-y-0.5 text-sm font-medium text-foreground/75">
          {isEmployee ? (
            <>
              <li>
                <Link
                  href="/dashboard/my-forms"
                  aria-current={isMyForms ? "page" : undefined}
                  title="My Forms"
                  className={navLinkClass(isMyForms)}
                >
                  <ClipboardList className="size-4 shrink-0" />
                  {!collapsed ? "My Forms" : null}
                </Link>
              </li>

              {showAdminDropdown ? (
                <li className="pt-2">
                  {collapsed ? (
                    <div className="space-y-0.5 transition-all duration-300 hover:text-primary">
                      <div
                        className="flex justify-center py-2 text-secondary"
                        title="Administration"
                      >
                        <Settings2 className="size-4" />
                      </div>
                      {adminLinks.map((link) => {
                        const Icon = link.icon;
                        const active = link.match(pathname);
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            aria-current={active ? "page" : undefined}
                            title={link.label}
                            className={navLinkClass(active)}
                          >
                            <Icon className="size-4 shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => setAdminOpen((open) => !open)}
                        aria-expanded={adminOpen}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50 transition hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          isAdminRouteActive && "text-primary",
                        )}
                      >
                        <Settings2 className="size-4 shrink-0" />
                        <span className="flex-1">Administration</span>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 transition-transform duration-200",
                            adminOpen && "rotate-180",
                          )}
                        />
                      </button>

                      {adminOpen ? (
                        <ul className="mt-0.5 space-y-0.5 border-l border-slate-300/60 ml-6 dark:border-white/10">
                          {adminLinks.map((link) => {
                            const Icon = link.icon;
                            const active = link.match(pathname);
                            return (
                              <li key={link.href}>
                                <Link
                                  href={link.href}
                                  aria-current={active ? "page" : undefined}
                                  title={link.label}
                                  className={cn(
                                    navLinkClass(active),
                                    "pl-4",
                                  )}
                                >
                                  <Icon className="size-4 shrink-0" />
                                  {link.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  )}
                </li>
              ) : null}
            </>
          ) : (
            <>
              <li>
                <Link
                  href="/dashboard"
                  aria-current={isDashboard ? "page" : undefined}
                  title="Dashboard"
                  className={navLinkClass(isDashboard)}
                >
                  <LayoutDashboard className="size-4 shrink-0" />
                  {!collapsed ? "Dashboard" : null}
                </Link>
              </li>

              <li>
                <Link
                  href="/dashboard/my-forms"
                  aria-current={isMyForms ? "page" : undefined}
                  title="My Forms"
                  className={navLinkClass(isMyForms)}
                >
                  <ClipboardList className="size-4 shrink-0" />
                  {!collapsed ? "My Forms" : null}
                </Link>
              </li>

              {canBulkReview ? (
                <li>
                  <Link
                    href="/dashboard/bulk-assessment"
                    aria-current={isBulkReview ? "page" : undefined}
                    title="Bulk Assessment Review"
                    className={navLinkClass(isBulkReview)}
                  >
                    <TableProperties className="size-4 shrink-0" />
                    {!collapsed ? "Bulk Assessment Review" : null}
                  </Link>
                </li>
              ) : null}

              {showAdminDropdown ? (
                <li className="pt-2">
                  {collapsed ? (
                    <div className="space-y-0.5 transition-all duration-300 hover:text-primary">
                      <div
                        className="flex justify-center py-2 text-secondary"
                        title="Administration"
                      >
                        <Settings2 className="size-4" />
                      </div>
                      {adminLinks.map((link) => {
                        const Icon = link.icon;
                        const active = link.match(pathname);
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            aria-current={active ? "page" : undefined}
                            title={link.label}
                            className={navLinkClass(active)}
                          >
                            <Icon className="size-4 shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => setAdminOpen((open) => !open)}
                        aria-expanded={adminOpen}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50 transition hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          isAdminRouteActive && "text-primary",
                        )}
                      >
                        <Settings2 className="size-4 shrink-0" />
                        <span className="flex-1">Administration</span>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 transition-transform duration-200",
                            adminOpen && "rotate-180",
                          )}
                        />
                      </button>

                      {adminOpen ? (
                        <ul className="mt-0.5 space-y-0.5 border-l border-slate-300/60 ml-6 dark:border-white/10">
                          {adminLinks.map((link) => {
                            const Icon = link.icon;
                            const active = link.match(pathname);
                            return (
                              <li key={link.href}>
                                <Link
                                  href={link.href}
                                  aria-current={active ? "page" : undefined}
                                  title={link.label}
                                  className={cn(
                                    navLinkClass(active),
                                    "pl-4",
                                  )}
                                >
                                  <Icon className="size-4 shrink-0" />
                                  {link.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  )}
                </li>
              ) : null}
            </>
          )}
        </ul>
      </nav>

      <div
        className={cn(
          "mt-6 border-t border-slate-300/80 pt-4 dark:border-white/15",
          collapsed ? "px-2" : "px-4",
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {initials}
            </div>
            <button
              type="button"
              onClick={() => setSignOutOpen(true)}
              title="Sign out"
              className="flex size-9 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {user?.name ?? "User"}
                </p>
                <Link href="/dashboard/profile" className="text-xs text-white bg-secondary rounded-md px-2 py-1">Profile</Link>
                </div>
               
                <p className="truncate text-xs text-foreground/60">
                  {user?.designation ?? "—"}
                </p>
              </div>
            </div>
            <ViewAsDropdown />
            <button
              type="button"
              onClick={() => setSignOutOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300/80 py-2 text-xs font-medium text-red-500 transition hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-white/15"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
      <SignOutConfirmModal
        open={signOutOpen}
        onConfirm={() => {
          setSignOutOpen(false);
          void signOutAndRedirect();
        }}
        onClose={() => setSignOutOpen(false)}
      />
    </aside>
  );
};

export default Sidebar;
