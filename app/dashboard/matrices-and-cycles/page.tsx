import MatricesAndCyclesTabs from "@/app/components/matrices-and-cycles/MatricesAndCyclesTabs";
import { requireModuleViewPage } from "@/lib/auth/require-module-page";

export default async function MatricesAndCyclesPage() {
  await requireModuleViewPage("MATRICES_AND_CYCLES");

  return (
    <div className="space-y-8 text-text-primary">
      <div>
    
        <div className="mt-2 flex items-start gap-3.5">
         
          <div>
            <h1
              className="text-2xl font-bold leading-tight text-text-primary"
              
            >
              Matrices and Cycles
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-foreground/70">
              Configure financial years, performance level and quartile matrices, and
              sub-category increment percentages for appraisal scoring.
            </p>
          </div>
        </div>

      </div>

      <MatricesAndCyclesTabs />
    </div>
  );
}