"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { EmployeeAccessGuard } from "@/app/components/layout/EmployeeAccessGuard";
import GlobalAskHrButton from "@/app/components/layout/GlobalAskHrButton";
import Sidebar from "@/app/components/layout/Sidebar";
import { useIsClient } from "@/app/hooks/use-is-client";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_LAYOUT_TRANSITION,
  SIDEBAR_STORAGE_KEY,
  SidebarContext,
} from "@/app/components/layout/sidebar-context";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  if (isClient && !hydrated) {
    setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    setHydrated(true);
  }

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
      <div className="flex min-h-screen w-screen max-w-[100vw] overflow-x-hidden bg-background text-foreground transition-colors print:block print:overflow-visible">
        <Sidebar />
        <motion.main
          className="dashboard-main min-h-screen min-w-0 overflow-x-hidden bg-background p-4 text-foreground print:p-0"
          initial={false}
          animate={{
            marginLeft: resolvedWidth,
            width: `calc(100vw - ${resolvedWidth}px)`,
            maxWidth: `calc(100vw - ${resolvedWidth}px)`,
          }}
          transition={SIDEBAR_LAYOUT_TRANSITION}
        >
          <EmployeeAccessGuard>{children}</EmployeeAccessGuard>
        </motion.main>
        <GlobalAskHrButton />
      </div>
    </SidebarContext.Provider>
  );
}
