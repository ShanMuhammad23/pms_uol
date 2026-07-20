"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { signOutAndRedirect } from "@/lib/queries/auth-client";
import {
  ClipboardList,
  FileText,
  Grid3X3,
  LayoutDashboard,
  List,
  Layers,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  SquareUserRound,
  UserRound,
  Users,
} from "lucide-react";
import ThemeToggle from "@/app/components/layout/ThemeToggle";
import { useSidebar } from "@/app/components/layout/sidebar-context";
import { isEmployeeRole } from "@/lib/auth/home-path";
import { cn } from "@/lib/utils";

const Sidebar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { collapsed, toggle } = useSidebar();
  const user = session?.user;
  const isEmployee = isEmployeeRole(user?.role);
  const isDashboard = pathname === "/dashboard";
  const isProfile = pathname === "/dashboard/profile";
  const isMyForms = pathname.startsWith("/dashboard/my-forms");
  const isForms = pathname.startsWith("/dashboard/forms");
  const isUsers = pathname.startsWith("/dashboard/users");
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isEntityCategories = pathname === "/dashboard/entity-categories";
  const isStaffCategories = pathname.startsWith("/dashboard/staff-categories");
  const isMatricesAndCycles = pathname.startsWith("/dashboard/matrices-and-cycles");

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
        "fixed top-0 left-0 z-40 flex h-full flex-col  overflow-auto border border-r border-slate-300/80  py-6 transition-[width,colors] duration-300 ease-in-out dark:border-white/15",
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

              {isSuperAdmin ? (
                <li>
                  <Link
                    href="/dashboard/forms"
                    aria-current={isForms ? "page" : undefined}
                    title="Forms"
                    className={navLinkClass(isForms)}
                  >
                    <FileText className="size-4 shrink-0" />
                    {!collapsed ? "Forms" : null}
                  </Link>
                </li>
              ) : null}

              {isSuperAdmin ? (
                <li>
                  <Link
                    href="/dashboard/users"
                    aria-current={isUsers ? "page" : undefined}
                    title="Users"
                    className={navLinkClass(isUsers)}
                  >
                    <Users className="size-4 shrink-0" />
                    {!collapsed ? "Users" : null}
                  </Link>
                </li>
              ) : null}

              {isSuperAdmin ? (
                <li>
                  <Link
                    href="/dashboard/matrices-and-cycles"
                    aria-current={isMatricesAndCycles ? "page" : undefined}
                    title="Matrices and Cycles"
                    className={navLinkClass(isMatricesAndCycles)}
                  >
                    <Grid3X3 className="size-4 shrink-0" />
                    {!collapsed ? "Matrices and Cycles" : null}
                  </Link>
                </li>
              ) : null}

              <li>
                <Link
                  href="/dashboard/profile"
                  aria-current={isProfile ? "page" : undefined}
                  title="Profile"
                  className={navLinkClass(isProfile)}
                >
                  <SquareUserRound className="size-4 shrink-0" />
                  {!collapsed ? "Profile" : null}
                </Link>
              </li>

              <li>
                <Link
                  href="/dashboard/entity-categories"
                  aria-current={isEntityCategories ? "page" : undefined}
                  title="Entity & Categories"
                  className={navLinkClass(isEntityCategories)}
                >
                  <List className="size-4 shrink-0" />
                  {!collapsed ? "Entity & Categories" : null}
                </Link>
              </li>

              {isSuperAdmin ? (
                <li>
                  <Link
                    href="/dashboard/staff-categories"
                    aria-current={isStaffCategories ? "page" : undefined}
                    title="Staff Categories"
                    className={navLinkClass(isStaffCategories)}
                  >
                    <Layers className="size-4 shrink-0" />
                    {!collapsed ? "Staff Categories" : null}
                  </Link>
                </li>
              ) : null}
            </>
          )}
        </ul>
      </nav>

      <button
        type="button"
        onClick={() => void signOutAndRedirect()}
        title={collapsed ? "Sign out" : undefined}
        className={cn(
          "mt-6 flex cursor-pointer items-center border-t border-slate-300/80 pt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/15",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        <UserRound className="size-4 shrink-0" />
        {!collapsed ? (
          <>
            <div className="min-w-0 flex-1 px-2 text-left">
              <p className="truncate text-xs font-medium text-text-primary">{user?.name}</p>
              <p className="mt-0.5 truncate text-xs text-foreground/70">{user?.email}</p>
            </div>
            <LogOut className="size-4 shrink-0 text-red-500" />
          </>
        ) : (
          <span className="sr-only">Sign out</span>
        )}
      </button>
    </aside>
  );
};

export default Sidebar;
