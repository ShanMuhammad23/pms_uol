import "server-only";

import { APPRAISAL_STATUS_LABELS, type AppraisalStatus } from "@/types/forms";
import {
  escapeHtml,
  infoRowHtml,
  infoRowText,
  renderHtmlEmail,
  renderTextFooter,
  returnReasonHtml,
  returnReasonText,
} from "./layout";

/**
 * PMS notification email templates.
 *
 * Each template function returns `{ subject, html, text }`.
 * Templates contain NO business logic — they only format data passed in.
 * Recipient names and return reasons are HTML-escaped via `escapeHtml`.
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/** Human-readable label for an appraisal status. */
export function statusLabel(status: AppraisalStatus): string {
  return APPRAISAL_STATUS_LABELS[status] ?? status;
}

/* -------------------------------------------------------------------------- */
/* 1. Self-Assessment Submitted                                               */
/* -------------------------------------------------------------------------- */

export function selfAssessmentSubmittedTemplate(params: {
  employeeName: string;
  nextStatus: AppraisalStatus;
}): EmailContent {
  const { employeeName, nextStatus } = params;
  const nextLabel = statusLabel(nextStatus);

  const bodyHtml = `
    <p>Dear ${escapeHtml(employeeName)},</p>
    <p>Your performance assessment submission has been successfully received.</p>
    <p>Your self-assessment has been completed and submitted successfully.</p>
    ${infoRowHtml("Current Status", "Self-Assessment Completed")}
    ${infoRowHtml("Next Stage", nextLabel)}
    <p>Your submission will now proceed to the next stage of the performance assessment process.</p>
    <p>You do not need to take any further action at this stage unless requested by the PMS.</p>`;

  const bodyText = `Dear ${employeeName},

Your performance assessment submission has been successfully received.

Your self-assessment has been completed and submitted successfully.

${infoRowText("Current Status", "Self-Assessment Completed")}
${infoRowText("Next Stage", nextLabel)}

Your submission will now proceed to the next stage of the performance assessment process.

You do not need to take any further action at this stage unless requested by the PMS.`;

  return {
    subject: "PMS Submission Received \u2013 Self-Assessment Completed",
    html: renderHtmlEmail(bodyHtml),
    text: bodyText + renderTextFooter(),
  };
}

/* -------------------------------------------------------------------------- */
/* 2. Manager 1 Approved                                                      */
/* -------------------------------------------------------------------------- */

export function manager1ApprovedTemplate(params: {
  employeeName: string;
  nextStatus: AppraisalStatus;
}): EmailContent {
  const { employeeName, nextStatus } = params;
  const nextLabel = statusLabel(nextStatus);

  const bodyHtml = `
    <p>Dear ${escapeHtml(employeeName)},</p>
    <p>Your performance assessment submission has been reviewed and approved by Manager 1.</p>
    ${infoRowHtml("Current Status", "Manager 1 Approved")}
    ${infoRowHtml("Next Stage", nextLabel)}
    <p>Your submission will now proceed to the next stage of the performance assessment process.</p>
    <p>No further action is required from you at this stage unless the PMS requests it.</p>`;

  const bodyText = `Dear ${employeeName},

Your performance assessment submission has been reviewed and approved by Manager 1.

${infoRowText("Current Status", "Manager 1 Approved")}
${infoRowText("Next Stage", nextLabel)}

Your submission will now proceed to the next stage of the performance assessment process.

No further action is required from you at this stage unless the PMS requests it.`;

  return {
    subject: "PMS Submission Update \u2013 Manager 1 Approval",
    html: renderHtmlEmail(bodyHtml),
    text: bodyText + renderTextFooter(),
  };
}

/* -------------------------------------------------------------------------- */
/* 3. Manager 2 Approved                                                      */
/* -------------------------------------------------------------------------- */

export function manager2ApprovedTemplate(params: {
  employeeName: string;
  nextStatus: AppraisalStatus;
}): EmailContent {
  const { employeeName, nextStatus } = params;
  const nextLabel = statusLabel(nextStatus);

  const bodyHtml = `
    <p>Dear ${escapeHtml(employeeName)},</p>
    <p>Your performance assessment submission has been reviewed and approved by Manager 2.</p>
    ${infoRowHtml("Current Status", "Manager 2 Approved")}
    ${infoRowHtml("Next Stage", nextLabel)}
    <p>Your submission will now proceed to the next stage of the performance assessment process.</p>
    <p>No further action is required from you at this stage unless the PMS requests it.</p>`;

  const bodyText = `Dear ${employeeName},

Your performance assessment submission has been reviewed and approved by Manager 2.

${infoRowText("Current Status", "Manager 2 Approved")}
${infoRowText("Next Stage", nextLabel)}

Your submission will now proceed to the next stage of the performance assessment process.

No further action is required from you at this stage unless the PMS requests it.`;

  return {
    subject: "PMS Submission Update \u2013 Manager 2 Approval",
    html: renderHtmlEmail(bodyHtml),
    text: bodyText + renderTextFooter(),
  };
}

/* -------------------------------------------------------------------------- */
/* 4. HR Approved                                                             */
/* -------------------------------------------------------------------------- */

export function hrApprovedTemplate(params: {
  employeeName: string;
  nextStatus: AppraisalStatus;
}): EmailContent {
  const { employeeName, nextStatus } = params;
  const nextLabel = statusLabel(nextStatus);

  const bodyHtml = `
    <p>Dear ${escapeHtml(employeeName)},</p>
    <p>Your performance assessment submission has been reviewed and approved by Human Resources.</p>
    ${infoRowHtml("Current Status", "HR Approved")}
    ${infoRowHtml("Next Stage", nextLabel)}
    <p>Your submission will now proceed to the next stage of the performance assessment process.</p>
    <p>No further action is required from you at this stage unless the PMS requests it.</p>`;

  const bodyText = `Dear ${employeeName},

Your performance assessment submission has been reviewed and approved by Human Resources.

${infoRowText("Current Status", "HR Approved")}
${infoRowText("Next Stage", nextLabel)}

Your submission will now proceed to the next stage of the performance assessment process.

No further action is required from you at this stage unless the PMS requests it.`;

  return {
    subject: "PMS Submission Update \u2013 HR Approval",
    html: renderHtmlEmail(bodyHtml),
    text: bodyText + renderTextFooter(),
  };
}

/* -------------------------------------------------------------------------- */
/* 5. Board Approved (Final)                                                  */
/* -------------------------------------------------------------------------- */

export function boardApprovedTemplate(params: {
  employeeName: string;
}): EmailContent {
  const { employeeName } = params;

  const bodyHtml = `
    <p>Dear ${escapeHtml(employeeName)},</p>
    <p>We are pleased to inform you that your performance assessment submission has been approved by the Board.</p>
    <p>Your submission has successfully completed the required approval process.</p>
    ${infoRowHtml("Current Status", "Board Approved")}
    ${infoRowHtml("Status", "Final Approval Completed")}
    <p>Thank you for completing the performance assessment process.</p>`;

  const bodyText = `Dear ${employeeName},

We are pleased to inform you that your performance assessment submission has been approved by the Board.

Your submission has successfully completed the required approval process.

${infoRowText("Current Status", "Board Approved")}
${infoRowText("Status", "Final Approval Completed")}

Thank you for completing the performance assessment process.`;

  return {
    subject: "PMS Submission Approved \u2013 Final Approval",
    html: renderHtmlEmail(bodyHtml),
    text: bodyText + renderTextFooter(),
  };
}

/* -------------------------------------------------------------------------- */
/* 6. Returned to Employee                                                    */
/* -------------------------------------------------------------------------- */

export function returnedToEmployeeTemplate(params: {
  employeeName: string;
  returnReason: string | null;
}): EmailContent {
  const { employeeName, returnReason } = params;

  const bodyHtml = `
    <p>Dear ${escapeHtml(employeeName)},</p>
    <p>Your performance assessment submission has been returned to you for further review and action.</p>
    ${infoRowHtml("Current Status", "Returned to Employee")}
    <p>Please log in to the Performance Management System, review the submission, make the required changes, and resubmit it when ready.</p>
    <p>Please ensure that all required information is complete before submitting again.</p>
    ${returnReasonHtml(returnReason)}`;

  const bodyText = `Dear ${employeeName},

Your performance assessment submission has been returned to you for further review and action.

${infoRowText("Current Status", "Returned to Employee")}

Please log in to the Performance Management System, review the submission, make the required changes, and resubmit it when ready.

Please ensure that all required information is complete before submitting again.
${returnReasonText(returnReason)}`;

  return {
    subject: "Action Required \u2013 PMS Submission Returned",
    html: renderHtmlEmail(bodyHtml),
    text: bodyText + renderTextFooter(),
  };
}

/* -------------------------------------------------------------------------- */
/* 7. Returned to Manager 1 (Manager only)                                    */
/* -------------------------------------------------------------------------- */

export function returnedToManager1ManagerTemplate(params: {
  managerName: string;
  employeeName: string;
  returnReason: string | null;
}): EmailContent {
  const { managerName, employeeName, returnReason } = params;

  const bodyHtml = `
    <p>Dear ${escapeHtml(managerName)},</p>
    <p>A performance assessment submission has been returned to you for further review and action.</p>
    ${infoRowHtml("Employee", employeeName)}
    ${infoRowHtml("Current Status", "Returned to Manager 1")}
    <p>Please log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.</p>
    ${returnReasonHtml(returnReason)}`;

  const bodyText = `Dear ${managerName},

A performance assessment submission has been returned to you for further review and action.

${infoRowText("Employee", employeeName)}
${infoRowText("Current Status", "Returned to Manager 1")}

Please log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.
${returnReasonText(returnReason)}`;

  return {
    subject: "Action Required \u2013 PMS Submission Returned to Manager 1",
    html: renderHtmlEmail(bodyHtml),
    text: bodyText + renderTextFooter(),
  };
}

/* -------------------------------------------------------------------------- */
/* 8. Returned to Manager 2 (Manager only)                                    */
/* -------------------------------------------------------------------------- */

export function returnedToManager2ManagerTemplate(params: {
  managerName: string;
  employeeName: string;
  returnReason: string | null;
}): EmailContent {
  const { managerName, employeeName, returnReason } = params;

  const bodyHtml = `
    <p>Dear ${escapeHtml(managerName)},</p>
    <p>A performance assessment submission has been returned to you for further review and action.</p>
    ${infoRowHtml("Employee", employeeName)}
    ${infoRowHtml("Current Status", "Returned to Manager 2")}
    <p>Please log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.</p>
    ${returnReasonHtml(returnReason)}`;

  const bodyText = `Dear ${managerName},

A performance assessment submission has been returned to you for further review and action.

${infoRowText("Employee", employeeName)}
${infoRowText("Current Status", "Returned to Manager 2")}

Please log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.
${returnReasonText(returnReason)}`;

  return {
    subject: "Action Required \u2013 PMS Submission Returned to Manager 2",
    html: renderHtmlEmail(bodyHtml),
    text: bodyText + renderTextFooter(),
  };
}
