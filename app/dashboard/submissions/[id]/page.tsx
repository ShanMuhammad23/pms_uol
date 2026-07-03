import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import SubmissionDetailView from "@/app/components/submissions/SubmissionDetailView";
import { requireSubmissionReviewerSession } from "@/lib/auth/require-submission-reviewer";

interface SubmissionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SubmissionDetailPage({
  params,
}: SubmissionDetailPageProps) {
  await requireSubmissionReviewerSession();

  const { id } = await params;
  const submissionId = Number(id);

  if (Number.isNaN(submissionId)) {
    notFound();
  }

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <Link
          href="/dashboard/submissions"
          className="mb-3 inline-flex items-center gap-1 text-sm text-foreground/70 hover:text-text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to Submissions
        </Link>
        <h1 className="text-2xl font-bold">Submission Details</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Review the employee&apos;s submitted form and raw score.
        </p>
      </div>

      <SubmissionDetailView submissionId={submissionId} />
    </div>
  );
}
