import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import DirectScoreEntryAssignment from "@/app/components/forms/DirectScoreEntryAssignment";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";

export const dynamic = "force-dynamic";

export default async function DirectScoreEntryPage() {
  await requireSuperAdminSession();

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
        <h1 className="mt-3 text-2xl font-bold">Direct Score Entry</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Mark employees for direct score entry. Their Score (O) will be adjusted
          manually from the main dashboard by HR, Board, and Super Admin. These
          employees will not fill any form or go through self-assessment or
          manager review.
        </p>
      </div>

      <DirectScoreEntryAssignment />
    </div>
  );
}
