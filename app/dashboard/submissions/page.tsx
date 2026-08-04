import SubmissionsListTable from "@/app/components/submissions/SubmissionsListTable";
import { requireSubmissionReviewerSession } from "@/lib/auth/require-submission-reviewer";

export default async function SubmissionsPage() {
  await requireSubmissionReviewerSession();

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">Form Submissions</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Review forms submitted by employees, including raw scores and responses.
        </p>
      </div>

      <SubmissionsListTable />
    </div>
  );
}
