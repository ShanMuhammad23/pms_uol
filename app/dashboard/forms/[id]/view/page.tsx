import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import FormTemplateView from "@/app/components/forms/FormTemplateView";
import PrintTrigger from "@/app/components/forms/PrintTrigger";
import PdfDownloadTrigger from "@/app/components/forms/PdfDownloadTrigger";
import PrintButton from "@/app/components/forms/PrintButton";
import { cn } from "@/lib/utils";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";
import { getFormTemplateById } from "@/lib/queries/forms";

interface ViewFormPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string; download?: string }>;
}

export default async function ViewFormPage({
  params,
  searchParams,
}: ViewFormPageProps) {
  await requireSuperAdminSession();

  const { id } = await params;
  const { print, download } = await searchParams;
  const isPrintMode = print === "true";
  const isDownloadMode = download === "true";

  const templateId = Number(id);

  if (Number.isNaN(templateId)) {
    notFound();
  }

  const template = await getFormTemplateById(templateId);

  if (!template) {
    notFound();
  }

  if (isDownloadMode) {
    return (
      <div className="bg-white">
        <PdfDownloadTrigger templateTitle={template.title} />
        <div id="pdf-content" className="bg-white p-6">
          <FormTemplateView template={template} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6 text-text-primary", isPrintMode && "print:space-y-0")}>
      {isPrintMode ? <PrintTrigger /> : null}

      <div className={isPrintMode ? "no-print" : ""}>
        <Link
          href="/dashboard/forms"
          className="inline-flex items-center gap-1.5 text-sm text-foreground/70 hover:text-text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to Forms
        </Link>
      </div>

      <div className={isPrintMode ? "print-content print-full-width" : ""}>
        {isPrintMode ? (
          <div className="print-title">{template.title}</div>
        ) : null}
        <FormTemplateView
          template={template}
          headerActions={
            <>
              <Link
                href={`/dashboard/forms/${templateId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 dark:border-primary/50 dark:bg-primary/15 dark:hover:bg-primary/25"
              >
                <Pencil className="size-3.5" />
                Edit Form
              </Link>
              <Link
                href={`/dashboard/forms/${templateId}/assign`}
                className="inline-flex items-center rounded-lg border border-success/30 bg-success/10 px-3 py-1.5 text-sm font-medium text-success hover:bg-success/20 dark:border-success/50 dark:bg-success/15 dark:hover:bg-success/25"
              >
                Assign Employees
              </Link>
              <PrintButton
                className="inline-flex items-center gap-1.5 rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-1.5 text-sm font-medium text-secondary hover:bg-secondary/20 dark:border-secondary/50 dark:bg-secondary/15 dark:hover:bg-secondary/25"
                printUrl={`/dashboard/forms/${templateId}/view?print=true`}
              />
            </>
          }
        />
      </div>
    </div>
  );
}
