/**
 * End-to-end notification test script.
 *
 * Sends one real email per template to a configurable test recipient address,
 * using the actual SMTP transporter and the actual template functions.
 *
 * Usage (from project root, after setting SMTP_* in .env):
 *   node --env-file=.env scripts/test-notifications.mjs <recipient-email>
 *
 * This DOES send real emails — use a mailbox you control.
 */

import nodemailer from "nodemailer";

const recipient = process.argv[2];
if (!recipient) {
  console.error("Usage: node --env-file=.env scripts/test-notifications.mjs <recipient-email>");
  process.exit(2);
}

const REQUIRED = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"];
const missing = REQUIRED.filter((k) => !process.env[k] || !String(process.env[k]).trim());
const fromEmail =
  (process.env.SMTP_FROM_EMAIL && String(process.env.SMTP_FROM_EMAIL).trim()) ||
  (process.env.MAIL_FROM_EMAIL && String(process.env.MAIL_FROM_EMAIL).trim()) ||
  "";
const fromName =
  (process.env.SMTP_FROM_NAME && String(process.env.SMTP_FROM_NAME).trim()) ||
  (process.env.MAIL_FROM_NAME && String(process.env.MAIL_FROM_NAME).trim()) ||
  "Performance Management System";
if (missing.length > 0 || !fromEmail) {
  const report = [...missing];
  if (!fromEmail) report.push("SMTP_FROM_EMAIL (or MAIL_FROM_EMAIL)");
  console.error(`Missing env vars: ${report.join(", ")}`);
  process.exit(2);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: String(process.env.SMTP_SECURE).trim().toLowerCase() === "true",
  auth: { user: process.env.SMTP_USER, pass: String(process.env.SMTP_PASSWORD).trim() },
});

const from = `"${fromName}" <${fromEmail}>`;

// --- Inline template reproductions (mirror lib/mail/notifications/templates.ts) ---
// Using plain text for the test to keep the script self-contained.

const SIGNATURE = `\n\nRegards,\nPerformance Management System\nUniversity of Lahore`;

const tests = [
  {
    event: "self_assessment_submitted",
    subject: "PMS Submission Received \u2013 Self-Assessment Completed",
    body: `Dear Test Employee,\n\nYour self-assessment has been completed and submitted successfully.\n\nCurrent Status: Self-Assessment Completed\n\nYour submission will now proceed to the next stage of the performance assessment process.\n\nYou do not need to take any further action at this stage unless requested by the PMS.${SIGNATURE}`,
  },
  {
    event: "board_approved",
    subject: "PMS Submission Approved \u2013 Final Approval",
    body: `Dear Test Employee,\n\nWe are pleased to inform you that your performance assessment has been approved by the Board.\n\nStatus: Final Approval Completed\n\nThank you for completing the performance assessment process.${SIGNATURE}`,
  },
  {
    event: "returned_to_employee",
    subject: "Action Required \u2013 PMS Submission Returned",
    body: `Dear Test Employee,\n\nYour self-assessment submission has been returned to you for further review and action.\n\nCurrent Status: Returned to Employee\n\nPlease log in to the Performance Management System, review your submission, and make the required changes.\n\nPlease ensure that all required information is complete before submitting again.\n\nReturn Reason:\nPlease update the KPI scores for Q3.${SIGNATURE}`,
  },
  {
    event: "returned_to_manager1_manager",
    subject: "Action Required \u2013 PMS Submission Returned to Manager 1",
    body: `Dear Test Manager,\n\nA self-assessment submission of your staff has been returned to you for further review and action.\n\nEmployee: Test Employee\nCurrent Status: Returned to Manager 1\n\nPlease log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.\n\nReturn Reason:\nPlease re-evaluate the scores.${SIGNATURE}`,
  },
  {
    event: "returned_to_manager2_manager",
    subject: "Action Required \u2013 PMS Submission Returned to Manager 2",
    body: `Dear Test Manager,\n\nA self-assessment submission of your staff has been returned to you for further review and action.\n\nEmployee: Test Employee\nCurrent Status: Returned to Manager 2\n\nPlease log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.\n\nReturn Reason:\nPlease re-evaluate the scores.${SIGNATURE}`,
  },
  {
    event: "self_assessment_reminder",
    subject: "Reminder \u2013 Complete Your PMS Self-Assessment",
    body: `Dear Test Employee,\n\nThis is a reminder that your self-assessment is still pending in the Performance Management System.\n\nForm: Annual Faculty Evaluation Form\nAppraisal Cycle: 2026\nCurrent Status: Pending Self-Assessment\n\nPlease log in to the Performance Management System and complete your self-assessment at your earliest convenience.\n\nLog in to the PMS Portal:\nhttps://pms-hr.uol.edu.pk${SIGNATURE}`,
  },
  {
    event: "manager_pending_work_reminder",
    subject: "Reminder \u2013 5 Pending PMS Assessment Items",
    body: `Dear Test Manager,\n\nThis is a reminder that you have pending assessment work in the Performance Management System.\n\nAppraisal Cycle: 2026\nDirect assessments to complete: 2\nSubmissions awaiting your review: 3\nTotal pending items: 5\n\nPlease log in to the Performance Management System to complete your direct assessments and review submitted appraisals.\n\nLog in to the PMS Portal:\nhttps://pms-hr.uol.edu.pk${SIGNATURE}`,
  },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject: t.subject,
      text: t.body,
    });
    console.log(`[PASS] ${t.event} -> messageId=${info.messageId}`);
    passed++;
  } catch (error) {
    const msg = error && typeof error === "object" && "message" in error ? error.message : "unknown";
    console.error(`[FAIL] ${t.event} -> ${msg}`);
    failed++;
  }
}

try { await transporter.close(); } catch {}

console.log(`\nResults: ${passed} passed, ${failed} failed (out of ${tests.length}).`);
process.exit(failed > 0 ? 1 : 0);
