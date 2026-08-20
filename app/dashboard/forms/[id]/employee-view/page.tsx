import { notFound } from "next/navigation";
import EmployeeFormFill from "@/app/components/employee-forms/EmployeeFormFill";
import { requireModuleViewPage } from "@/lib/auth/require-module-page";
import { getFormTemplateById } from "@/lib/queries/forms";
import { withDb } from "@/lib/db-context";

export const dynamic = "force-dynamic";

interface EmployeeFormPreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeFormPreviewPage({
  params,
}: EmployeeFormPreviewPageProps) {
  return withDb(async () => {
    await requireModuleViewPage("FORMS");

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
      <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden p-4 text-text-primary sm:p-6">
        <EmployeeFormFill templateId={templateId} mode="preview" />
      </div>
    );
  });
}
