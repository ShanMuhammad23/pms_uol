import MatricesAndCyclesTabs from "@/app/components/matrices-and-cycles/MatricesAndCyclesTabs";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";
import { LibraryBig } from "lucide-react";

export default async function MatricesAndCyclesPage() {
  await requireSuperAdminSession();

  return (
    <div className="space-y-8 text-text-primary">
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
          Configuration
        </span>

        <div className="mt-2 flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm shadow-primary/30">
            <LibraryBig className="size-5" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold leading-tight text-text-primary"
              style={{ fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif" }}
            >
              Matrices and Cycles
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-foreground/70">
              Configure financial years, performance level and quartile matrices, and
              sub-category increment percentages for appraisal scoring.
            </p>
          </div>
        </div>

        <div className="mt-5 h-px w-full bg-gradient-to-r from-primary/40 via-secondary/40 to-transparent" />
      </div>

      <MatricesAndCyclesTabs />
    </div>
  );
}