import FormBuilderWizard from "@/app/components/forms/FormBuilderWizard";
import { requireModuleEditPage } from "@/lib/auth/require-module-page";
import { listAppraisalCycles } from "@/lib/queries/appraisal-cycles";
import { withDb } from "@/lib/db-context";

export default async function NewFormPage() {
  return withDb(async () => {
    await requireModuleEditPage("FORMS");
    const appraisalCycles = await listAppraisalCycles();

    return (
      <div className="-m-4 flex h-[100dvh] flex-col overflow-hidden">
        <FormBuilderWizard appraisalCycles={appraisalCycles} />
      </div>
    );
  });
}
