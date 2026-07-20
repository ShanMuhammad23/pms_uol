"use client";

import { useCallback, useEffect, useState } from "react";
import { EmployeeAccessGuard } from "@/app/components/layout/EmployeeAccessGuard";
import Sidebar from "@/app/components/layout/Sidebar";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_STORAGE_KEY,
  SidebarContext,
} from "@/app/components/layout/sidebar-context";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  const resolvedWidth = hydrated ? width : SIDEBAR_EXPANDED_WIDTH;

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, width }}>
      <div className="flex min-h-screen w-screen max-w-[100vw] overflow-x-hidden bg-background text-foreground transition-colors">
        <Sidebar />
        <main
          className="dashboard-main min-h-screen min-w-0 overflow-x-hidden bg-background p-4 text-foreground transition-[margin,width] duration-300 ease-in-out"
          style={{
            marginLeft: resolvedWidth,
            width: `calc(100vw - ${resolvedWidth}px)`,
            maxWidth: `calc(100vw - ${resolvedWidth}px)`,
          }}
        >
          <EmployeeAccessGuard>{children}</EmployeeAccessGuard>
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
