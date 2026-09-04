/**
 * Server-side mail service barrel.
 *
 * Re-exports the SMTP infrastructure. Importing any symbol from this module
 * pulls in `server-only`, so it cannot accidentally be bundled for the client.
 */
export {
  isSmtpConfigured,
  missingSmtpEnvKeys,
  getSmtpConfig,
  formatFromAddress,
  resolveFromEmail,
  resolveFromName,
  type SmtpConfig,
} from "./config";

export { getTransporter, resetTransporter } from "./transporter";

export { sendMail, type SendMailInput, type SendMailResult } from "./send";

export {
  verifySmtpConnection,
  sanitizeSmtpError,
  type SmtpVerifyResult,
} from "./verify";
