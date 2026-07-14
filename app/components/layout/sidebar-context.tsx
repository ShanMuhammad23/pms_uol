"use client";

import { createContext, useContext } from "react";

export const SIDEBAR_EXPANDED_WIDTH = 264;
export const SIDEBAR_COLLAPSED_WIDTH = 72;
export const SIDEBAR_STORAGE_KEY = "pms-sidebar-collapsed";

export type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
  width: number;
};

export const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within DashboardShell");
  }
  return context;
}
