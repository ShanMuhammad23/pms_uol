/**
 * Preview / send one employee + one manager reminder email.
 *
 * Writes HTML previews to scripts/preview/ (open in a browser).
 * Optionally sends the same two emails via SMTP.
 *
 * Usage:
 *   node --env-file=.env scripts/send-reminder-previews.mjs
 *   node --env-file=.env scripts/send-reminder-previews.mjs you@uol.edu.pk
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const previewDir = join(__dirname, "preview");
const recipient = process.argv[2]?.trim() || null;

const PRIMARY_COLOR = "#1e3a5f";
const LIGHT_BG = "#f8fafc";
const BORDER_COLOR = "#e2e8f0";
const TEXT_COLOR = "#334155";
const BRAND_NAME = "Performance Management System";
const BRAND_ORG = "University of Lahore";
const PMS_PORTAL_URL =
  (process.env.PMS_PORTAL_URL && String(process.env.PMS_PORTAL_URL).trim()) ||
  "https://pms-hr.uol.edu.pk";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function infoRowHtml(label, value) {
  return `<p class="email-info-row" style="margin:8px 0;word-wrap:break-word;overflow-wrap:break-word;"><strong style="color:${PRIMARY_COLOR};">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function portalLoginButtonHtml() {
  const href = escapeHtml(PMS_PORTAL_URL);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:24px 0 8px;">
  <tr>
    <td align="center" style="border-radius:6px;background-color:${PRIMARY_COLOR};">
      <a class="email-cta-btn" href="${href}" style="display:block;width:100%;box-sizing:border-box;background-color:${PRIMARY_COLOR};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;line-height:1.3;padding:14px 20px;border-radius:6px;text-align:center;">
        Log in to PMS Portal
      </a>
    </td>
  </tr>
</table>
<p class="email-url-fallback" style="margin:0;font-size:12px;line-height:1.5;color:#64748b;word-break:break-all;">
  Or open: <a href="${href}" style="color:${PRIMARY_COLOR};text-decoration:underline;">${href}</a>
</p>`;
}

function portalLoginText() {
  return `\nLog in to the PMS Portal:\n${PMS_PORTAL_URL}\n`;
}

function renderHtmlEmail(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Performance Management System</title>
  <style type="text/css">
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    body { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    a { word-break: break-word; }
    .email-card { width: 100% !important; max-width: 600px !important; }
    @media only screen and (max-width: 620px) {
      .email-outer-pad { padding: 12px 0 !important; }
      .email-header-pad { padding: 18px 16px !important; }
      .email-body-pad { padding: 20px 16px !important; }
      .email-footer-pad { padding: 14px 16px 18px !important; }
      .email-brand-title { font-size: 16px !important; line-height: 1.35 !important; }
      .email-cta-btn {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        padding: 14px 16px !important;
        text-align: center !important;
      }
      .email-url-fallback { font-size: 12px !important; word-break: break-all !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${LIGHT_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT_COLOR};font-size:15px;line-height:1.6;-webkit-text-size-adjust:100%;">
  <table role="presentation" class="email-outer-pad" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:${LIGHT_BG};padding:24px 0;">
    <tr>
      <td align="center" style="padding:0 12px;">
        <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${BORDER_COLOR};">
          <tr>
            <td class="email-header-pad" style="background-color:${PRIMARY_COLOR};padding:24px 28px;">
              <div class="email-brand-title" style="font-size:18px;font-weight:700;color:#ffffff;line-height:1.3;">${BRAND_NAME}</div>
              <div style="font-size:13px;color:#cbd5e1;margin-top:4px;">${BRAND_ORG}</div>
            </td>
          </tr>
          <tr>
            <td class="email-body-pad" style="padding:28px;font-size:15px;line-height:1.6;color:${TEXT_COLOR};word-wrap:break-word;overflow-wrap:break-word;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td class="email-footer-pad" style="padding:16px 28px 22px;border-top:1px solid ${BORDER_COLOR};">
              <div style="font-size:12px;line-height:1.5;color:#94a3b8;">
                This is an automated message from the ${BRAND_NAME}. Please do not reply to this email.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function employeeTemplate({ employeeName, formTitle, cycleFiscalYear }) {
  const bodyHtml = `
    <p>Dear ${escapeHtml(employeeName)},</p>
    <p>This is a reminder that your self-assessment is still pending in the Performance Management System.</p>
    ${infoRowHtml("Form", formTitle)}
    ${infoRowHtml("Appraisal Cycle", String(cycleFiscalYear))}
    ${infoRowHtml("Current Status", "Pending Self-Assessment")}
    <p>Please log in to the Performance Management System and complete your self-assessment at your earliest convenience.</p>
    ${portalLoginButtonHtml()}`;

  return {
    subject: "Reminder \u2013 Complete Your PMS Self-Assessment",
    html: renderHtmlEmail(bodyHtml),
    text: `Dear ${employeeName},\n\nThis is a reminder that your self-assessment is still pending in the Performance Management System.\n\nForm: ${formTitle}\nAppraisal Cycle: ${cycleFiscalYear}\nCurrent Status: Pending Self-Assessment\n\nPlease log in to the Performance Management System and complete your self-assessment at your earliest convenience.\n${portalLoginText()}\n--\nRegards,\n${BRAND_NAME}\n${BRAND_ORG}`,
  };
}

function managerTemplate({
  managerName,
  directAssessmentCount,
  pendingReviewCount,
  cycleFiscalYear,
}) {
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

  return {
    subject: `Reminder \u2013 ${total} Pending PMS Assessment Item${total === 1 ? "" : "s"}`,
    html: renderHtmlEmail(bodyHtml),
    text: `Dear ${managerName},\n\nThis is a reminder that you have pending assessment work in the Performance Management System.\n\nAppraisal Cycle: ${cycleFiscalYear}\nDirect assessments to complete: ${directAssessmentCount}\nSubmissions awaiting your review: ${pendingReviewCount}\nTotal pending items: ${total}\n\nPlease log in to the Performance Management System to complete your direct assessments and review submitted appraisals.\n${portalLoginText()}\n--\nRegards,\n${BRAND_NAME}\n${BRAND_ORG}`,
  };
}

async function loadSampleRecipients(pool) {
  const cycle = (
    await pool.query(
      `SELECT id, fiscal_year
       FROM appraisal_cycles
       ORDER BY is_active DESC, fiscal_year DESC
       LIMIT 1`,
    )
  ).rows[0];

  if (!cycle) throw new Error("No appraisal cycle found.");

  const employee = (
    await pool.query(
      `SELECT
         CONCAT(u.first_name, ' ', u.last_name) AS name,
         ft.title AS form_title
       FROM employee_form_assignments efa
       INNER JOIN form_templates ft ON ft.id = efa.template_id
       INNER JOIN users u ON u.id = efa.employee_id
       LEFT JOIN appraisals ap
         ON ap.employee_id = u.id AND ap.cycle_id = ft.cycle_id
       WHERE ft.cycle_id = $1
         AND efa.self_assessment_disabled = FALSE
         AND u.is_active = TRUE
         AND COALESCE(u.assessment_eligibility, TRUE) = TRUE
         AND (
           ap.id IS NULL
           OR (ap.status = 'PENDING_SELF_ASSESSMENT' AND ap.submitted_at IS NULL)
         )
       ORDER BY efa.id
       LIMIT 1`,
      [cycle.id],
    )
  ).rows[0];

  const manager = (
    await pool.query(
      `WITH pending AS (
         SELECT
           CASE
             WHEN COALESCE(ap.manager_level, 1) <= 1 THEN emp.head_id
             ELSE emp.manager_2_id
           END AS manager_id,
           efa.self_assessment_disabled
         FROM appraisals ap
         INNER JOIN users emp ON emp.id = ap.employee_id
         INNER JOIN employee_form_assignments efa
           ON efa.employee_id = emp.id AND efa.template_id = ap.template_id
         WHERE ap.cycle_id = $1
           AND ap.status = 'PENDING_HEAD_REVIEW'
           AND ap.template_id IS NOT NULL
           AND emp.is_active = TRUE
       ),
       counts AS (
         SELECT
           manager_id,
           COUNT(*) FILTER (WHERE self_assessment_disabled = TRUE)::int AS direct_assessment_count,
           COUNT(*) FILTER (WHERE self_assessment_disabled = FALSE)::int AS pending_review_count
         FROM pending
         WHERE manager_id IS NOT NULL
         GROUP BY manager_id
       )
       SELECT
         CONCAT(m.first_name, ' ', m.last_name) AS name,
         c.direct_assessment_count,
         c.pending_review_count
       FROM counts c
       INNER JOIN users m ON m.id = c.manager_id
       WHERE (c.direct_assessment_count + c.pending_review_count) > 0
       ORDER BY (c.direct_assessment_count + c.pending_review_count) DESC
       LIMIT 1`,
      [cycle.id],
    )
  ).rows[0];

  return {
    cycleFiscalYear: Number(cycle.fiscal_year),
    employee: employee ?? {
      name: "Sample Employee",
      form_title: "Performance Evaluation Form",
    },
    manager: manager ?? {
      name: "Sample Manager",
      direct_assessment_count: 3,
      pending_review_count: 5,
    },
  };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const sample = await loadSampleRecipients(pool);
    const employeeMail = employeeTemplate({
      employeeName: sample.employee.name,
      formTitle: sample.employee.form_title,
      cycleFiscalYear: sample.cycleFiscalYear,
    });
    const managerMail = managerTemplate({
      managerName: sample.manager.name,
      directAssessmentCount: Number(sample.manager.direct_assessment_count),
      pendingReviewCount: Number(sample.manager.pending_review_count),
      cycleFiscalYear: sample.cycleFiscalYear,
    });

    mkdirSync(previewDir, { recursive: true });
    const employeePath = join(previewDir, "employee-self-assessment-reminder.html");
    const managerPath = join(previewDir, "manager-pending-work-reminder.html");
    writeFileSync(employeePath, employeeMail.html, "utf8");
    writeFileSync(managerPath, managerMail.html, "utf8");

    console.log("HTML previews written (open in browser):");
    console.log(`  ${employeePath}`);
    console.log(`  ${managerPath}`);
    console.log(`\nEmployee sample: ${sample.employee.name} / ${sample.employee.form_title}`);
    console.log(
      `Manager sample: ${sample.manager.name} / direct=${sample.manager.direct_assessment_count} reviews=${sample.manager.pending_review_count}`,
    );

    if (!recipient) {
      console.log(
        "\nNo recipient provided — HTML only. To also send via SMTP:\n  node --env-file=.env scripts/send-reminder-previews.mjs you@uol.edu.pk",
      );
      return;
    }

    const fromEmail =
      (process.env.SMTP_FROM_EMAIL && String(process.env.SMTP_FROM_EMAIL).trim()) ||
      (process.env.MAIL_FROM_EMAIL && String(process.env.MAIL_FROM_EMAIL).trim());
    const fromName =
      (process.env.SMTP_FROM_NAME && String(process.env.SMTP_FROM_NAME).trim()) ||
      (process.env.MAIL_FROM_NAME && String(process.env.MAIL_FROM_NAME).trim()) ||
      BRAND_NAME;

    const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"];
    const missing = required.filter((k) => !process.env[k]?.trim());
    if (missing.length || !fromEmail) {
      throw new Error(
        `Missing SMTP config: ${[...missing, !fromEmail ? "SMTP_FROM_EMAIL" : null].filter(Boolean).join(", ")}`,
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE).trim().toLowerCase() === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: String(process.env.SMTP_PASSWORD).trim(),
      },
    });

    const from = `"${fromName}" <${fromEmail}>`;

    for (const mail of [
      { label: "employee", ...employeeMail },
      { label: "manager", ...managerMail },
    ]) {
      const info = await transporter.sendMail({
        from,
        to: recipient,
        subject: `[PREVIEW] ${mail.subject}`,
        html: mail.html,
        text: mail.text,
      });
      console.log(
        `Sent ${mail.label} preview to ${recipient} messageId=${info.messageId}`,
      );
    }

    await transporter.close();
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[FATAL]", error.message);
  process.exitCode = 1;
});
