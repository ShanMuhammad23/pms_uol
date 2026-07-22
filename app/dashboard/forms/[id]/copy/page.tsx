import { notFound } from "next/navigation";
import FormBuilderWizard from "@/app/components/forms/FormBuilderWizard";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";
import { listAppraisalCycles } from "@/lib/queries/appraisal-cycles";
import { getFormTemplateById } from "@/lib/queries/forms";

export const dynamic = "force-dynamic";

interface CopyFormPageProps {
  params: Promise<{ id: string }>;
}

export default async function CopyFormPage({ params }: CopyFormPageProps) {
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

  const appraisalCycles = await listAppraisalCycles();

  return (
    <div className="-m-6 h-screen overflow-hidden">
      <FormBuilderWizard
        initialData={template}
        appraisalCycles={appraisalCycles}
        copyMode
      />
    </div>
  );
}
