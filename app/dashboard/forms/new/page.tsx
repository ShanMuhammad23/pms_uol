import FormBuilderWizard from "@/app/components/forms/FormBuilderWizard";
import { requireModuleEditPage } from "@/lib/auth/require-module-page";
import { listAppraisalCycles } from "@/lib/queries/appraisal-cycles";

export default async function NewFormPage() {
  await requireModuleEditPage("FORMS");
  const appraisalCycles = await listAppraisalCycles();

  return (
    <div className="-m-6 h-screen overflow-hidden">
      <FormBuilderWizard appraisalCycles={appraisalCycles} />
    </div>
  );
}
