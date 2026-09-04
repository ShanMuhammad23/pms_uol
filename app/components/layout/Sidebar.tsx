"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { signOutAndRedirect } from "@/lib/queries/auth-client";
import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,

} from "lucide-react";
import ThemeToggle from "@/app/components/layout/ThemeToggle";
import { ViewAsDropdown } from "@/app/components/layout/ViewAsDropdown";
import { SignOutConfirmModal } from "@/app/components/layout/SignOutConfirmModal";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_LAYOUT_TRANSITION,
  useSidebar,
} from "@/app/components/layout/sidebar-context";
import { isEmployeeRole } from "@/lib/auth/home-path";
import formIcon from '@/public/icons8-form-80.png';
import usersIcon from '@/public/icons8-users-64.png';
import matricesIcon from '@/public/icons8-matrix-60.png';
import levelsIcon from '@/public/icons8-organization-64.png';
import reportsIcon from '@/public/icons8-process-48.png';
import securityIcon from '@/public/icons8-security-shield-64.png';
import dashboardIcon from '@/public/icons8-dashboard-50.png';
import {
  canAccessDashboardSubmissions,
  isAdminRole,
} from "@/lib/auth/submission-review-roles";
import { cn } from "@/lib/utils";
import { useAdditionalAccess } from "@/app/queries/use-additional-access";
import { type AdditionalAccessModule } from "@/types/additional-access";
import Image from "next/image";

const ADMIN_LINKS = [
  {
    href: "/dashboard/forms",
    label: "Forms",
    icon: formIcon,
    match: (pathname: string) => pathname.startsWith("/dashboard/forms"),
    module: "FORMS" as AdditionalAccessModule | undefined,
  },
  {
    href: "/dashboard/users",
    label: "Users",
    icon: usersIcon,
    match: (pathname: string) => pathname.startsWith("/dashboard/users"),
    module: "USERS" as AdditionalAccessModule | undefined,
  },
  {
    href: "/dashboard/matrices-and-cycles",
    label: "Matrices and Cycles",
    icon: matricesIcon,
    match: (pathname: string) =>
      pathname.startsWith("/dashboard/matrices-and-cycles"),
    module: "MATRICES_AND_CYCLES" as AdditionalAccessModule | undefined,
  },
  {
    href: "/dashboard/entity-categories",
    label: "Organization Levels",
    icon: levelsIcon,
    match: (pathname: string) =>
      pathname.startsWith("/dashboard/entity-categories"),
    module: "ORGANIZATION_LEVELS" as AdditionalAccessModule | undefined,
  },
  {
    href: "/dashboard/reports",
    label: "Process Status Summary",
    icon: reportsIcon,
    match: (pathname: string) => pathname.startsWith("/dashboard/reports"),
    module: undefined as AdditionalAccessModule | undefined,
  },
] as const;

const SUPER_ADMIN_ONLY_LINKS = [
  {
    href: "/dashboard/security-events",
    label: "Security Events",
    icon: securityIcon,
    match: (pathname: string) =>
      pathname.startsWith("/dashboard/security-events"),
  },
] as const;

const ADMIN_SUBMENU_TRANSITION = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

const NAV_ICON_CLASS = "size-6 shrink-0";

function SidebarLabel({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <motion.span
      initial={false}
      animate={{
        opacity: collapsed ? 0 : 1,
        maxWidth: collapsed ? 0 : 200,
      }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden whitespace-nowrap"
    >
      {children}
    </motion.span>
  );
}

function AnimatedAdminLinks({
  open,
  links,
  pathname,
  navLinkClass,
}: {
  open: boolean;
  links: Array<{
    href: string;
    label: string;
    icon: (typeof ADMIN_LINKS)[number]["icon"] | (typeof SUPER_ADMIN_ONLY_LINKS)[number]["icon"];
    match: (pathname: string) => boolean;
  }>;
  pathname: string;
  navLinkClass: (active: boolean) => string;
}) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="admin-submenu"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={ADMIN_SUBMENU_TRANSITION}
          className="overflow-hidden"
        >
          <ul className="mt-0.5 ml-6 space-y-0.5 border-l border-slate-300/60 dark:border-white/10">
            {links.map((link, index) => {
              const Icon = link.icon;
              const active = link.match(pathname);
              return (
                <motion.li
                  key={link.href}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: index * 0.035,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    title={link.label}
                    className={cn(navLinkClass(active), "pl-4")}
                  >
                    <Image src={Icon} alt={link.label} width={24} height={24} className={NAV_ICON_CLASS} />
                    {link.label}
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

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
      collapsed ? "justify-center px-2" : "px-6",
      active
        ? "border-r-4 border-primary "
        : "border-primary hover:border-r-4 hover:bg-primary/10",
    );

  return (
    <motion.aside
      className="no-print fixed top-0 no-scrollbar left-0 z-40 flex h-full flex-col overflow-x-hidden overflow-y-auto border border-r border-slate-300/80 py-6 dark:border-white/15"
      initial={false}
      animate={{
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
      }}
      transition={SIDEBAR_LAYOUT_TRANSITION}
    >
      <motion.div
        layout
        className={cn(
          "relative flex items-center gap-2 px-3",
          collapsed ? "flex-col" : "gap-4 px-4",
        )}
        transition={SIDEBAR_LAYOUT_TRANSITION}
      >
        <motion.div
          initial={false}
          animate={{ opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : 160 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-1 items-center overflow-hidden whitespace-nowrap"
        >
          <h2 className="text-4xl font-bold">PMS</h2>
        </motion.div>

        <motion.div
          layout
          className={cn("flex items-center gap-2", collapsed && "flex-col")}
          transition={SIDEBAR_LAYOUT_TRANSITION}
        >
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
        </motion.div>
      </motion.div>

      <hr className="my-6 border-slate-300/80 dark:border-white/15" />

      <nav aria-label="Primary sidebar navigation" className="flex-1 no-scrollbar">
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
                  <Image src={formIcon} alt="My Forms" width={24} height={24} className={NAV_ICON_CLASS} />
                  <SidebarLabel>My Forms</SidebarLabel>
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
                        <Settings2 className="size-6" />
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
                            <Image src={Icon} alt={link.label} width={24} height={24} className={NAV_ICON_CLASS} />
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
                        <motion.span
                          className="inline-flex shrink-0"
                          animate={{ rotate: adminOpen ? 180 : 0 }}
                          transition={ADMIN_SUBMENU_TRANSITION}
                        >
                          <ChevronDown className="size-4" />
                        </motion.span>
                      </button>

                      <AnimatedAdminLinks
                        open={adminOpen}
                        links={adminLinks}
                        pathname={pathname}
                        navLinkClass={navLinkClass}
                      />
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
                  <Image src={dashboardIcon} alt="Dashboard" width={24} height={24} className={NAV_ICON_CLASS} />
                  <SidebarLabel>Dashboard</SidebarLabel>
                </Link>
              </li>

              <li>
                <Link
                  href="/dashboard/my-forms"
                  aria-current={isMyForms ? "page" : undefined}
                  title="My Forms"
                  className={navLinkClass(isMyForms)}
                >
                  <Image src={formIcon} alt="My Forms" width={24} height={24} className={NAV_ICON_CLASS} />
                  <SidebarLabel>My Forms</SidebarLabel>
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
                    <Image src={reportsIcon} alt="Bulk Assessment Review" width={24} height={24} className={NAV_ICON_CLASS} />
                    <SidebarLabel>Bulk Assessment Review</SidebarLabel>
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
                        <Image src={securityIcon} alt="Security Events" width={24} height={24} className={NAV_ICON_CLASS} />
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
                            <Image src={Icon} alt={link.label} width={24} height={24} className={NAV_ICON_CLASS} />
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
                        <Image src={securityIcon} alt="Security Events" width={24} height={24} className={NAV_ICON_CLASS} />
                        <span className="flex-1">Administration</span>
                        <motion.span
                          className="inline-flex shrink-0"
                          animate={{ rotate: adminOpen ? 180 : 0 }}
                          transition={ADMIN_SUBMENU_TRANSITION}
                        >
                          <ChevronDown className="size-4" />
                        </motion.span>
                      </button>

                      <AnimatedAdminLinks
                        open={adminOpen}
                        links={adminLinks}
                        pathname={pathname}
                        navLinkClass={navLinkClass}
                      />
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
          "mt-6 overflow-hidden border-t border-slate-300/80 pt-4 dark:border-white/15",
          collapsed ? "px-2" : "px-4",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {collapsed ? (
            <motion.div
              key="sidebar-footer-collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="flex flex-col items-center gap-2"
            >
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
            </motion.div>
          ) : (
            <motion.div
              key="sidebar-footer-expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {user?.name ?? "User"}
                    </p>
                    <Link
                      href="/dashboard/profile"
                      className="rounded-md bg-secondary px-2 py-1 text-xs text-white"
                    >
                      Profile
                    </Link>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <SignOutConfirmModal
        open={signOutOpen}
        onConfirm={() => {
          setSignOutOpen(false);
          void signOutAndRedirect();
        }}
        onClose={() => setSignOutOpen(false)}
      />
    </motion.aside>
  );
};

export default Sidebar;
