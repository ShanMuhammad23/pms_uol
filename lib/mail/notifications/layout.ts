import "server-only";

/**
 * Shared HTML/text email layout for PMS notifications.
 *
 * Mobile-first email patterns:
 * - Fluid 100% width card with max-width 600px
 * - Media queries for clients that support them (Apple Mail, iOS, many Android)
 * - Full-width CTA button for easy tapping
 * - Word-wrap for long form titles / URLs
 */

const BRAND_NAME = "Performance Management System";
const BRAND_ORG = "University of Lahore";
const PRIMARY_COLOR = "#1e3a5f";
const LIGHT_BG = "#f8fafc";
const BORDER_COLOR = "#e2e8f0";
const TEXT_COLOR = "#334155";

/** Production PMS portal login URL (override with PMS_PORTAL_URL). */
export const PMS_PORTAL_URL =
  (typeof process !== "undefined" &&
    process.env.PMS_PORTAL_URL?.trim()) ||
  "https://pms-hr.uol.edu.pk";

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

const MOBILE_STYLES = `
  html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  body { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  a { word-break: break-word; }
  .email-wrapper { width: 100% !important; }
  .email-card { width: 100% !important; max-width: 600px !important; }
  .email-body-copy, .email-body-copy p { word-wrap: break-word; overflow-wrap: break-word; }
  @media only screen and (max-width: 620px) {
    .email-outer-pad { padding: 12px 0 !important; }
    .email-header-pad { padding: 18px 16px !important; }
    .email-body-pad { padding: 20px 16px !important; }
    .email-footer-pad { padding: 14px 16px 18px !important; }
    .email-brand-title { font-size: 16px !important; line-height: 1.35 !important; }
    .email-brand-org { font-size: 12px !important; }
    .email-body-copy { font-size: 15px !important; line-height: 1.55 !important; }
    .email-info-row { margin: 10px 0 !important; font-size: 14px !important; }
    .email-cta-btn {
      display: block !important;
      width: 100% !important;
      box-sizing: border-box !important;
      padding: 14px 16px !important;
      text-align: center !important;
    }
    .email-cta-cell { width: 100% !important; }
    .email-url-fallback { font-size: 12px !important; word-break: break-all !important; }
  }
`;

/**
 * Render the full HTML email with PMS branding wrapping the given body.
 */
export function renderHtmlEmail(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Performance Management System</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">${MOBILE_STYLES}</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${LIGHT_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT_COLOR};font-size:15px;line-height:1.6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">&nbsp;</div>
  <table role="presentation" class="email-wrapper email-outer-pad" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:${LIGHT_BG};padding:24px 0;">
    <tr>
      <td align="center" style="padding:0 12px;">
        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
        <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${BORDER_COLOR};">
          <tr>
            <td class="email-header-pad" style="background-color:${PRIMARY_COLOR};padding:24px 28px;">
              <div class="email-brand-title" style="font-size:18px;font-weight:700;color:#ffffff;line-height:1.3;">${BRAND_NAME}</div>
              <div class="email-brand-org" style="font-size:13px;color:#cbd5e1;margin-top:4px;">${BRAND_ORG}</div>
            </td>
          </tr>
          <tr>
            <td class="email-body-pad email-body-copy" style="padding:28px 28px;font-size:15px;line-height:1.6;color:${TEXT_COLOR};word-wrap:break-word;overflow-wrap:break-word;">
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
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
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
  return `<p class="email-info-row" style="margin:8px 0;word-wrap:break-word;overflow-wrap:break-word;"><strong style="color:${PRIMARY_COLOR};">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
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
  return `<div style="margin:16px 0;padding:12px 16px;background-color:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;word-wrap:break-word;overflow-wrap:break-word;">
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

/**
 * Full-width-friendly login CTA for reminder emails (mobile tap target).
 */
export function portalLoginButtonHtml(
  portalUrl: string = PMS_PORTAL_URL,
): string {
  const href = escapeHtml(portalUrl);
  return `<table role="presentation" class="email-cta-wrap" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:24px 0 8px;">
  <tr>
    <td align="center" class="email-cta-cell" style="border-radius:6px;background-color:${PRIMARY_COLOR};">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="13%" stroke="f" fillcolor="${PRIMARY_COLOR}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Log in to PMS Portal</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a class="email-cta-btn" href="${href}" style="display:block;width:100%;box-sizing:border-box;background-color:${PRIMARY_COLOR};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;line-height:1.3;padding:14px 20px;border-radius:6px;text-align:center;">
        Log in to PMS Portal
      </a>
      <!--<![endif]-->
    </td>
  </tr>
</table>
<p class="email-url-fallback" style="margin:0;font-size:12px;line-height:1.5;color:#64748b;word-break:break-all;">
  Or open: <a href="${href}" style="color:${PRIMARY_COLOR};text-decoration:underline;">${href}</a>
</p>`;
}

export function portalLoginText(portalUrl: string = PMS_PORTAL_URL): string {
  return `\nLog in to the PMS Portal:\n${portalUrl}\n`;
}
