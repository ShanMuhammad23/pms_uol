import MatricesAndCyclesTabs from "@/app/components/matrices-and-cycles/MatricesAndCyclesTabs";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";

export default async function MatricesAndCyclesPage() {
  await requireSuperAdminSession();

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">Matrices and Cycles</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Configure financial years, performance level and quartile matrices, and
          sub-category increment percentages for appraisal scoring.
        </p>
      </div>

      <MatricesAndCyclesTabs />
    </div>
  );
}
