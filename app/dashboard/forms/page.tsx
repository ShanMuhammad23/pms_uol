import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import FormsListTable from "@/app/components/forms/FormsListTable";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";
import { listFormTemplates } from "@/lib/queries/forms";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  await requireSuperAdminSession();
  const templates = await listFormTemplates();

  return (
    <div className="space-y-6 text-text-primary">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Forms</h1>
          <p className="mt-1 text-sm text-foreground/70">
            Design and manage appraisal form templates and assign them to employees.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/forms/direct-score-entry"
            className="inline-flex items-center gap-2 rounded-lg border border-violet-300 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:text-violet-300 dark:hover:bg-violet-950/40"
          >
            <ClipboardCheck className="size-4" />
            Direct Score Entry
          </Link>
          <Link
            href="/dashboard/forms/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Create Form
          </Link>
        </div>
      </div>

      <FormsListTable templates={templates} />
    </div>
  );
}
