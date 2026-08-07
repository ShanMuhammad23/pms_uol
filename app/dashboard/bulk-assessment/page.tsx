import { redirect } from "next/navigation";
import { canAccessDashboardSubmissions } from "@/lib/auth/submission-review-roles";
import { requireSession } from "@/lib/auth/require-session";
import BulkAssessmentReview from "@/app/components/bulk-assessment/BulkAssessmentReview";

export const dynamic = "force-dynamic";

export default async function BulkAssessmentPage() {
  const session = await requireSession();
  const role = session.user?.role;

  // Manager, HR, Board, and Super Admin can access the bulk review workspace.
  // Only submissions where the user is the assigned Manager 1 or Manager 2
  // (at the current manager_level) will appear in the queue.
  if (!canAccessDashboardSubmissions(role)) {
    redirect("/dashboard");
  }

  const userId = session.user?.id ? Number(session.user.id) : null;

  return <BulkAssessmentReview role={role ?? null} userId={userId} />;
}
