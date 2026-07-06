import FormBuilderWizard from "@/app/components/forms/FormBuilderWizard";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";
import { listAppraisalCycles } from "@/lib/queries/appraisal-cycles";

export default async function NewFormPage() {
  await requireSuperAdminSession();
  const appraisalCycles = await listAppraisalCycles();

  return (
    <div className="-m-6 h-screen overflow-hidden">
      <FormBuilderWizard appraisalCycles={appraisalCycles} />
    </div>
  );
}
