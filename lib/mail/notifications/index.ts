import "server-only";

import type { ReturnLevel } from "@/types/form-submissions";
import { getSubmissionRecipients, type NotificationRecipient } from "./recipients";
import { dispatchNotification, type NotificationTarget } from "./dispatch";
import {
  boardApprovedTemplate,
  returnedToEmployeeTemplate,
  returnedToManager1ManagerTemplate,
  returnedToManager2ManagerTemplate,
  selfAssessmentSubmittedTemplate,
  selfAssessmentReminderTemplate,
  managerPendingWorkReminderTemplate,
} from "./templates";

/**
 * High-level notification triggers.
 *
 * Each function is called AFTER the corresponding workflow operation has
 * successfully committed. They are fire-and-forget — callers should use `void`.
 *
 * Recipients are resolved from the existing PMS data relationships
 * (employee_id, head_id, manager_2_id) via a single query.
 */

function toTarget(recipient: NotificationRecipient | null): NotificationTarget | null {
  if (!recipient || !recipient.email) return null;
  return { email: recipient.email, name: recipient.name };
}

/* -------------------------------------------------------------------------- */
/* 1. Self-Assessment Submitted                                               */
/* -------------------------------------------------------------------------- */

export async function notifySelfAssessmentSubmitted(
  appraisalId: number,
): Promise<void> {
  const recipients = await getSubmissionRecipients(appraisalId);
  if (!recipients?.employee) return;

  const content = selfAssessmentSubmittedTemplate({
    employeeName: recipients.employee.name,
  });

  void dispatchNotification(appraisalId, "self_assessment_submitted", recipients.employee, content);
}

/* -------------------------------------------------------------------------- */
/* 5. Board Approved (Final)                                                  */
/* -------------------------------------------------------------------------- */

export async function notifyBoardApproved(
  appraisalId: number,
): Promise<void> {
  const recipients = await getSubmissionRecipients(appraisalId);
  if (!recipients?.employee) return;

  const content = boardApprovedTemplate({
    employeeName: recipients.employee.name,
  });
  void dispatchNotification(appraisalId, "board_approved", recipients.employee, content);
}

/* -------------------------------------------------------------------------- */
/* 6, 7 & 8. Submission Returned                                              */
/* -------------------------------------------------------------------------- */

export async function notifySubmissionReturned(
  appraisalId: number,
  returnLevel: ReturnLevel,
  returnReason: string,
): Promise<void> {
  const recipients = await getSubmissionRecipients(appraisalId);
  if (!recipients) return;

  const employee = toTarget(recipients.employee);

  if (returnLevel === "employee") {
    if (!employee) return;
    const content = returnedToEmployeeTemplate({
      employeeName: recipients.employee!.name,
      returnReason,
    });
    void dispatchNotification(appraisalId, "returned_to_employee", employee, content);
    return;
  }

  if (returnLevel === "manager1") {
    const manager = toTarget(recipients.manager1);
    if (manager) {
      const mgrContent = returnedToManager1ManagerTemplate({
        managerName: recipients.manager1!.name,
        employeeName: recipients.employee?.name ?? "the employee",
        returnReason,
      });
      void dispatchNotification(appraisalId, "returned_to_manager1_manager", manager, mgrContent);
    }
    return;
  }

  // returnLevel === "manager2"
  const manager = toTarget(recipients.manager2);
  if (manager) {
    const mgrContent = returnedToManager2ManagerTemplate({
      managerName: recipients.manager2!.name,
      employeeName: recipients.employee?.name ?? "the employee",
      returnReason,
    });
    void dispatchNotification(appraisalId, "returned_to_manager2_manager", manager, mgrContent);
  }
}

/* -------------------------------------------------------------------------- */
/* Re-exports                                                                 */
/* -------------------------------------------------------------------------- */

export { getSubmissionRecipients, type NotificationRecipient, type SubmissionRecipients } from "./recipients";
export { dispatchNotification, type NotificationTarget } from "./dispatch";
export type { EmailContent } from "./templates";
export {
  selfAssessmentReminderTemplate,
  managerPendingWorkReminderTemplate,
};
