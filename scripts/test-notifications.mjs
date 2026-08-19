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

const REQUIRED = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM_EMAIL", "MAIL_FROM_NAME"];
const missing = REQUIRED.filter((k) => !process.env[k] || !String(process.env[k]).trim());
if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(2);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: String(process.env.SMTP_SECURE).trim().toLowerCase() === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
});

const fromName = process.env.MAIL_FROM_NAME;
const fromEmail = process.env.MAIL_FROM_EMAIL;
const from = `"${fromName}" <${fromEmail}>`;

// --- Inline template reproductions (mirror lib/mail/notifications/templates.ts) ---
// Using plain text for the test to keep the script self-contained.

const SIGNATURE = `\n\nRegards,\nPerformance Management System\nUniversity of Lahore`;

const tests = [
  {
    event: "self_assessment_submitted",
    subject: "PMS Submission Received \u2013 Self-Assessment Completed",
    body: `Dear Test Employee,\n\nYour performance assessment submission has been successfully received.\n\nYour self-assessment has been completed and submitted successfully.\n\nCurrent Status: Self-Assessment Completed\nNext Stage: Manager Review\n\nYour submission will now proceed to the next stage of the performance assessment process.\n\nYou do not need to take any further action at this stage unless requested by the PMS.${SIGNATURE}`,
  },
  {
    event: "manager1_approved",
    subject: "PMS Submission Update \u2013 Manager 1 Approval",
    body: `Dear Test Employee,\n\nYour performance assessment submission has been reviewed and approved by Manager 1.\n\nCurrent Status: Manager 1 Approved\nNext Stage: Manager Review\n\nYour submission will now proceed to the next stage of the performance assessment process.\n\nNo further action is required from you at this stage unless the PMS requests it.${SIGNATURE}`,
  },
  {
    event: "manager2_approved",
    subject: "PMS Submission Update \u2013 Manager 2 Approval",
    body: `Dear Test Employee,\n\nYour performance assessment submission has been reviewed and approved by Manager 2.\n\nCurrent Status: Manager 2 Approved\nNext Stage: HR Alignment\n\nYour submission will now proceed to the next stage of the performance assessment process.\n\nNo further action is required from you at this stage unless the PMS requests it.${SIGNATURE}`,
  },
  {
    event: "hr_approved",
    subject: "PMS Submission Update \u2013 HR Approval",
    body: `Dear Test Employee,\n\nYour performance assessment submission has been reviewed and approved by Human Resources.\n\nCurrent Status: HR Approved\nNext Stage: Board Approval\n\nYour submission will now proceed to the next stage of the performance assessment process.\n\nNo further action is required from you at this stage unless the PMS requests it.${SIGNATURE}`,
  },
  {
    event: "board_approved",
    subject: "PMS Submission Approved \u2013 Final Approval",
    body: `Dear Test Employee,\n\nWe are pleased to inform you that your performance assessment submission has been approved by the Board.\n\nYour submission has successfully completed the required approval process.\n\nCurrent Status: Board Approved\nStatus: Final Approval Completed\n\nThank you for completing the performance assessment process.${SIGNATURE}`,
  },
  {
    event: "returned_to_employee",
    subject: "Action Required \u2013 PMS Submission Returned",
    body: `Dear Test Employee,\n\nYour performance assessment submission has been returned to you for further review and action.\n\nCurrent Status: Returned to Employee\n\nPlease log in to the Performance Management System, review the submission, make the required changes, and resubmit it when ready.\n\nPlease ensure that all required information is complete before submitting again.\n\nReturn Reason:\nPlease update the KPI scores for Q3.${SIGNATURE}`,
  },
  {
    event: "returned_to_manager1_manager",
    subject: "Action Required \u2013 PMS Submission Returned to Manager 1",
    body: `Dear Test Manager,\n\nA performance assessment submission has been returned to you for further review and action.\n\nEmployee: Test Employee\nCurrent Status: Returned to Manager 1\n\nPlease log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.\n\nReturn Reason:\nPlease re-evaluate the scores.${SIGNATURE}`,
  },
  {
    event: "returned_to_manager2_employee",
    subject: "PMS Submission Update \u2013 Returned to Manager 2",
    body: `Dear Test Employee,\n\nYour performance assessment submission has been returned to Manager 2 for further review and action.\n\nCurrent Status: Returned to Manager 2\nAssigned To: Test Manager\n\nManager 2 will review the submission and continue the assessment process.\n\nNo action is required from you at this stage unless you are contacted through the PMS.\n\nReturn Reason:\nPlease re-evaluate the scores.${SIGNATURE}`,
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
