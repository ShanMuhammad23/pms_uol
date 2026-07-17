import React from "react";
import DashboardShell from "@/app/components/layout/DashboardShell";
import { requireSession } from "@/lib/auth/require-session";

const layout = async ({ children }: { children: React.ReactNode }) => {
  await requireSession();

  return <DashboardShell>{children}</DashboardShell>;
};

export default layout;
