import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import SubmissionDetailView from "@/app/components/submissions/SubmissionDetailView";
import { requireSubmissionAccessSession } from "@/lib/auth/require-submission-reviewer";

interface SubmissionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SubmissionDetailPage({
  params,
}: SubmissionDetailPageProps) {
  await requireSubmissionAccessSession();

  const { id } = await params;
  const submissionId = Number(id);

  if (Number.isNaN(submissionId)) {
    notFound();
  }

  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-x-hidden text-text-primary">
      <Link
        href="/dashboard"
        className="no-print inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>

      <SubmissionDetailView submissionId={submissionId} />
    </div>
  );
}
