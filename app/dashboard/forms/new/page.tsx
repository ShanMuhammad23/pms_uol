import FormBuilderWizard from "@/app/components/forms/FormBuilderWizard";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";

export default async function NewFormPage() {
  await requireSuperAdminSession();

  return (
    <div className="-m-6 h-screen overflow-hidden">
      <FormBuilderWizard />
    </div>
  );
}
