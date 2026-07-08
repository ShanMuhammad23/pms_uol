import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AppraisalStatus } from "@/types/forms";

export function countWorkflowStage(
  submissions: FormSubmissionListItem[],
  awaitingState: AppraisalStatus,
  completedStates: AppraisalStatus[],
) {
  return {
    awaiting: submissions.filter((submission) => submission.status === awaitingState).length,
    completed: submissions.filter((submission) =>
      completedStates.includes(submission.status),
    ).length,
  };
}
