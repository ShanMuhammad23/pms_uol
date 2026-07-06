import { notFound } from "next/navigation";
import FormBuilderWizard from "@/app/components/forms/FormBuilderWizard";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";
import { getFormTemplateById } from "@/lib/queries/forms";

interface EditFormPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditFormPage({ params }: EditFormPageProps) {
  await requireSuperAdminSession();

  const { id } = await params;
  const templateId = Number(id);

  if (Number.isNaN(templateId)) {
    notFound();
  }

  const template = await getFormTemplateById(templateId);

  if (!template) {
    notFound();
  }

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">Edit Form</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Update the form design and category routing.
        </p>
      </div>

      <FormBuilderWizard templateId={templateId} initialData={template} />
    </div>
  );
}
