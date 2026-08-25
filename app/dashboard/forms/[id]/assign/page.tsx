import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import FormEmployeeAssignment from "@/app/components/forms/FormEmployeeAssignment";
import { requireModuleEditPage } from "@/lib/auth/require-module-page";
import { getFormTemplateById } from "@/lib/queries/forms";
import { withDb } from "@/lib/db-context";

export const dynamic = "force-dynamic";

interface AssignFormPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssignFormPage({ params }: AssignFormPageProps) {
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

    return (
      <div className="space-y-5 text-text-primary">
        <div>
          <Link
            href={`/dashboard/forms/${templateId}/view`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
          >
            <ArrowLeft className="size-4" />
            Back to Form
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-primary">Assign Form to Employees</h1>
          <p className="mt-1 text-sm text-foreground/70">
            Choose any number of employees for this form template.
          </p>
        </div>

        <FormEmployeeAssignment templateId={templateId} templateTitle={template.title} />
      </div>
    );
  });
}

