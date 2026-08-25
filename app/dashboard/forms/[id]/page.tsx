import { notFound } from "next/navigation";
import FormBuilderWizard from "@/app/components/forms/FormBuilderWizard";
import { requireModuleEditPage } from "@/lib/auth/require-module-page";
import { listAppraisalCycles } from "@/lib/queries/appraisal-cycles";
import { getFormTemplateAppraisalCount, getFormTemplateById } from "@/lib/queries/forms";
import { withDb } from "@/lib/db-context";

export const dynamic = "force-dynamic";

interface EditFormPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditFormPage({ params }: EditFormPageProps) {
  return withDb(async () => {
    await requireModuleEditPage("FORMS");

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
    const appraisalCount = await getFormTemplateAppraisalCount(templateId);

    return (
      <div className="-m-6 h-screen overflow-hidden">
        <FormBuilderWizard
          templateId={templateId}
          initialData={template}
          appraisalCycles={appraisalCycles}
          appraisalCount={appraisalCount}
        />
      </div>
    );
  });
}
