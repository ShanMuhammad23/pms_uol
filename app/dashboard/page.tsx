import { redirect } from "next/navigation";
import HRDashboardPage from "@/app/components/dashboard/HRDashboardPage";
import { getPostLoginPath, isEmployeeRole } from "@/lib/auth/home-path";
import { requireSession } from "@/lib/auth/require-session";
export default async function DashboardPage() {
  const session = await requireSession();

  if (isEmployeeRole(session.user?.role)) {
    redirect(getPostLoginPath(session.user?.role));
  }

  return <HRDashboardPage role={session.user?.role ?? null} />;
}
