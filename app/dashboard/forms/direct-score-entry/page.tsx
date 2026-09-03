import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import DirectScoreEntryAssignment from "@/app/components/forms/DirectScoreEntryAssignment";
import { requireModuleEditPage } from "@/lib/auth/require-module-page";

export const dynamic = "force-dynamic";

export default async function DirectScoreEntryPage() {
  await requireModuleEditPage("FORMS");

  return (
    <div className="space-y-5 text-text-primary">
      <div>
        <Link
          href="/dashboard/forms"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
        >
          <ArrowLeft className="size-4" />
          Back to Forms
        </Link>
   
      </div>

      <DirectScoreEntryAssignment />
    </div>
  );
}
