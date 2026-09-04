import "server-only";

import {
  escapeHtml,
  infoRowHtml,
  infoRowText,
  portalLoginButtonHtml,
  portalLoginText,
  renderHtmlEmail,
  renderTextFooter,
  returnReasonHtml,
  returnReasonText,
} from "./layout";


export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/* -------------------------------------------------------------------------- */
/* 1. Self-Assessment Submitted                                               */
/* -------------------------------------------------------------------------- */

export function selfAssessmentSubmittedTemplate(params: {
  employeeName: string;
}): EmailContent {
  const { employeeName } = params;

  const bodyHtml = `
    <p>Dear ${escapeHtml(employeeName)},</p>
    <p>Your self-assessment has been completed and submitted successfully.</p>
    ${infoRowHtml("Current Status", "Self-Assessment Completed")}
    <p>Your submission will now proceed to the next stage of the performance assessment process.</p>
    <p>You do not need to take any further action at this stage unless requested by the PMS.</p>`;

  const bodyText = `Dear ${employeeName},

Your self-assessment has been completed and submitted successfully.

${infoRowText("Current Status", "Self-Assessment Completed")}

Your submission will now proceed to the next stage of the performance assessment process.

You do not need to take any further action at this stage unless requested by the PMS.`;

  return {
    subject: "PMS Submission Received \u2013 Self-Assessment Completed",
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
    <p>We are pleased to inform you that your performance assessment has been approved by the Board.</p>
    ${infoRowHtml("Status", "Final Approval Completed")}
    <p>Thank you for completing the performance assessment process.</p>`;

  const bodyText = `Dear ${employeeName},

We are pleased to inform you that your performance assessment has been approved by the Board.

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
    <p>Your self-assessment submission has been returned to you for further review and action.</p>
    ${infoRowHtml("Current Status", "Returned to Employee")}
    <p>Please log in to the Performance Management System, review your submission, and make the required changes.</p>
    <p>Please ensure that all required information is complete before submitting again.</p>
    ${returnReasonHtml(returnReason)}`;

  const bodyText = `Dear ${employeeName},

Your self-assessment submission has been returned to you for further review and action.

${infoRowText("Current Status", "Returned to Employee")}

Please log in to the Performance Management System, review your submission, and make the required changes.

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
    <p>A self-assessment submission of your staff has been returned to you for further review and action.</p>
    ${infoRowHtml("Employee", employeeName)}
    ${infoRowHtml("Current Status", "Returned to Manager 1")}
    <p>Please log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.</p>
    ${returnReasonHtml(returnReason)}`;

  const bodyText = `Dear ${managerName},

A self-assessment submission of your staff has been returned to you for further review and action.

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
    <p>A self-assessment submission of your staff has been returned to you for further review and action.</p>
    ${infoRowHtml("Employee", employeeName)}
    ${infoRowHtml("Current Status", "Returned to Manager 2")}
    <p>Please log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.</p>
    ${returnReasonHtml(returnReason)}`;

  const bodyText = `Dear ${managerName},

A self-assessment submission of your staff has been returned to you for further review and action.

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

/* -------------------------------------------------------------------------- */
/* 9. Employee self-assessment reminder                                       */
/* -------------------------------------------------------------------------- */

export function selfAssessmentReminderTemplate(params: {
  employeeName: string;
  formTitle: string;
  cycleFiscalYear: number;
}): EmailContent {
  const { employeeName, formTitle, cycleFiscalYear } = params;

  const bodyHtml = `
    <p>Dear ${escapeHtml(employeeName)},</p>
    <p>This is a reminder that your self-assessment is still pending in the Performance Management System.</p>
    ${infoRowHtml("Form", formTitle)}
    ${infoRowHtml("Appraisal Cycle", String(cycleFiscalYear))}
    ${infoRowHtml("Current Status", "Pending Self-Assessment")}
    <p>Please log in to the Performance Management System and complete your self-assessment at your earliest convenience.</p>
    ${portalLoginButtonHtml()}`;

  const bodyText = `Dear ${employeeName},

This is a reminder that your self-assessment is still pending in the Performance Management System.

${infoRowText("Form", formTitle)}
${infoRowText("Appraisal Cycle", String(cycleFiscalYear))}
${infoRowText("Current Status", "Pending Self-Assessment")}

Please log in to the Performance Management System and complete your self-assessment at your earliest convenience.
${portalLoginText()}`;

  return {
    subject: "Reminder \u2013 Complete Your PMS Self-Assessment",
    html: renderHtmlEmail(bodyHtml),
    text: bodyText + renderTextFooter(),
  };
}

/* -------------------------------------------------------------------------- */
/* 10. Manager pending-work reminder digest                                   */
/* -------------------------------------------------------------------------- */

export function managerPendingWorkReminderTemplate(params: {
  managerName: string;
  directAssessmentCount: number;
  pendingReviewCount: number;
  cycleFiscalYear: number;
}): EmailContent {
  const {
    managerName,
    directAssessmentCount,
    pendingReviewCount,
    cycleFiscalYear,
  } = params;

  const total = directAssessmentCount + pendingReviewCount;

  const bodyHtml = `
    <p>Dear ${escapeHtml(managerName)},</p>
    <p>This is a reminder that you have pending assessment work in the Performance Management System.</p>
    ${infoRowHtml("Appraisal Cycle", String(cycleFiscalYear))}
    ${infoRowHtml("Direct assessments to complete", String(directAssessmentCount))}
    ${infoRowHtml("Submissions awaiting your review", String(pendingReviewCount))}
    ${infoRowHtml("Total pending items", String(total))}
    <p>Please log in to the Performance Management System to complete your direct assessments and review submitted appraisals.</p>
    ${portalLoginButtonHtml()}`;

  const bodyText = `Dear ${managerName},

This is a reminder that you have pending assessment work in the Performance Management System.

${infoRowText("Appraisal Cycle", String(cycleFiscalYear))}
${infoRowText("Direct assessments to complete", String(directAssessmentCount))}
${infoRowText("Submissions awaiting your review", String(pendingReviewCount))}
${infoRowText("Total pending items", String(total))}

Please log in to the Performance Management System to complete your direct assessments and review submitted appraisals.
${portalLoginText()}`;

  return {
    subject: `Reminder \u2013 ${total} Pending PMS Assessment Item${total === 1 ? "" : "s"}`,
    html: renderHtmlEmail(bodyHtml),
    text: bodyText + renderTextFooter(),
  };
}
