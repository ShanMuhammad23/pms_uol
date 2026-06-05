import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import FormTemplateView from "@/app/components/forms/FormTemplateView";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";
import { getFormTemplateById } from "@/lib/queries/forms";

interface ViewFormPageProps {
  params: Promise<{ id: string }>;
}

export default async function ViewFormPage({ params }: ViewFormPageProps) {
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
        <Link
          href="/dashboard/forms"
          className="inline-flex items-center gap-1.5 text-sm text-foreground/70 hover:text-text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to Forms
        </Link>
        <h1 className="mt-3 text-2xl font-bold">View Form</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Read-only preview of this form template and its configuration.
        </p>
      </div>

      <FormTemplateView template={template} />
    </div>
  );
}
