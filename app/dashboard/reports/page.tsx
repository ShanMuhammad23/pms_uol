import ReportsPage from "@/app/components/reports/ReportsPage";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";

export default async function ReportsRoute() {
  await requireSuperAdminSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Hierarchical organization report with appraisal workflow progress
          counts.
        </p>
      </div>

      <ReportsPage />
    </div>
  );
}
