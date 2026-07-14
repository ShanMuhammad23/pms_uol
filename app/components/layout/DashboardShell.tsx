"use client";

import { useCallback, useEffect, useState } from "react";
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

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, width }}>
      <div className="flex min-h-screen bg-background text-foreground transition-colors">
        <Sidebar />
        <main
          className="min-h-screen flex-1 bg-background p-4 text-foreground transition-[margin] duration-300 ease-in-out"
          style={{ marginLeft: hydrated ? width : SIDEBAR_EXPANDED_WIDTH }}
        >
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
