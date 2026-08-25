import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import FormsListTable from "@/app/components/forms/FormsListTable";
import { countDirectScoreEntryEmployees, listFormTemplates } from "@/lib/queries/forms";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { isAdminRole } from "@/lib/auth/submission-review-roles";
import { canViewModule, canEditModule } from "@/lib/auth/additional-access";
import { redirect } from "next/navigation";
import { withDb } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  return withDb(async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      redirect("/");
    }

    const isOrgAdmin = isAdminRole(session.user.role);
    const canViewForms = await canViewModule(
      Number(session.user.id),
      "FORMS",
      session.user.role,
    );

    if (!isOrgAdmin && !canViewForms) {
      redirect("/dashboard");
    }

    const canEditForms = isOrgAdmin || await canEditModule(
      Number(session.user.id),
      "FORMS",
      session.user.role,
    );
    const [templates, directScoreEntryCount] = await Promise.all([
      listFormTemplates(),
      countDirectScoreEntryEmployees(),
    ]);

    return (
      <div className="space-y-6 text-text-primary">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Forms</h1>
            <p className="mt-1 text-sm text-foreground/70">
              Design and manage appraisal form templates and assign them to employees.
            </p>
          </div>

          {canEditForms ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/forms/direct-score-entry"
                className="inline-flex items-center gap-2 rounded-lg border border-violet-300 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:text-violet-300 dark:hover:bg-violet-950/40"
              >
                <ClipboardCheck className="size-4" />
                Direct Score Entry
                <span
                  className="inline-flex min-w-6 items-center justify-center rounded-full bg-violet-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white dark:bg-violet-500"
                  title={`${directScoreEntryCount} employee${directScoreEntryCount === 1 ? "" : "s"} with Direct Scoring enabled`}
                >
                  {directScoreEntryCount}
                </span>
              </Link>
              <Link
                href="/dashboard/forms/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
              >
                <Plus className="size-4" />
                Create Form
              </Link>
            </div>
          ) : null}
        </div>

        <FormsListTable templates={templates} canEdit={canEditForms} />
      </div>
    );
  });
}
