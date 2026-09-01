import { notFound } from "next/navigation";
import FormBuilderWizard from "@/app/components/forms/FormBuilderWizard";
import { requireModuleEditPage } from "@/lib/auth/require-module-page";
import { listAppraisalCycles } from "@/lib/queries/appraisal-cycles";
import { getFormTemplateById } from "@/lib/queries/forms";
import { withDb } from "@/lib/db-context";

export const dynamic = "force-dynamic";

interface CopyFormPageProps {
  params: Promise<{ id: string }>;
}

export default async function CopyFormPage({ params }: CopyFormPageProps) {
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

    return (
      <div className="-m-4 flex h-[100dvh] flex-col overflow-hidden">
        <FormBuilderWizard
          initialData={template}
          appraisalCycles={appraisalCycles}
          copyMode
        />
      </div>
    );
  });
}
