import "server-only";

/**
 * Shared HTML/text email layout for PMS notifications.
 *
 * Provides a consistent visual identity:
 * - Performance Management System header
 * - University of Lahore
 * - Clear typography, professional spacing, mobile-friendly
 *
 * Template functions call `renderHtmlEmail` / `renderTextEmail` with the
 * body content, keeping the wrapper DRY.
 */

const BRAND_NAME = "Performance Management System";
const BRAND_ORG = "University of Lahore";
const PRIMARY_COLOR = "#1e3a5f";
const LIGHT_BG = "#f8fafc";
const BORDER_COLOR = "#e2e8f0";
const TEXT_COLOR = "#334155";

/**
 * Escape user-provided text for safe inclusion in HTML emails.
 * Prevents XSS in return reasons, names, etc.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render the full HTML email with PMS branding wrapping the given body.
 */
export function renderHtmlEmail(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Management System</title>
</head>
<body style="margin:0;padding:0;background-color:${LIGHT_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT_COLOR};font-size:15px;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${LIGHT_BG};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${BORDER_COLOR};">
          <tr>
            <td style="background-color:${PRIMARY_COLOR};padding:24px 32px;">
              <div style="font-size:18px;font-weight:700;color:#ffffff;">${BRAND_NAME}</div>
              <div style="font-size:13px;color:#cbd5e1;margin-top:4px;">${BRAND_ORG}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid ${BORDER_COLOR};">
              <div style="font-size:12px;color:#94a3b8;">
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

/**
 * Render the plain-text footer used in text fallbacks.
 */
export function renderTextFooter(): string {
  return `\n--\nRegards,\n${BRAND_NAME}\n${BRAND_ORG}\n\nThis is an automated message. Please do not reply to this email.`;
}

/**
 * Build an HTML info row: **Label:** value
 */
export function infoRowHtml(label: string, value: string): string {
  return `<p style="margin:8px 0;"><strong style="color:${PRIMARY_COLOR};">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

/**
 * Build a text info row: Label: value
 */
export function infoRowText(label: string, value: string): string {
  return `${label}: ${value}`;
}

/**
 * Build the return-reason HTML block (only when a reason exists).
 */
export function returnReasonHtml(reason: string | null | undefined): string {
  if (!reason || !reason.trim()) return "";
  return `<div style="margin:16px 0;padding:12px 16px;background-color:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;">
    <strong style="color:#92400e;">Return Reason:</strong><br>
    ${escapeHtml(reason.trim())}
  </div>`;
}

/**
 * Build the return-reason text block (only when a reason exists).
 */
export function returnReasonText(reason: string | null | undefined): string {
  if (!reason || !reason.trim()) return "";
  return `\nReturn Reason:\n${reason.trim()}`;
}
