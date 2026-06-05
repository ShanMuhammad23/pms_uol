import FormBuilderWizard from "@/app/components/forms/FormBuilderWizard";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";

export default async function NewFormPage() {
  await requireSuperAdminSession();

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">Create Form</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Build a new appraisal form in three steps: design, category, and
          procedure setup.
        </p>
      </div>

      <FormBuilderWizard />
    </div>
  );
}
