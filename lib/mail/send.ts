import "server-only";

import { getTransporter, getCachedSmtpConfig } from "./transporter";
import { formatFromAddress } from "./config";

/**
 * Reusable email-sending primitive.
 *
 * This module intentionally contains NO business logic, recipients, triggers,
 * or templates. It only provides a thin, typed wrapper around nodemailer's
 * `sendMail` that:
 *  - reuses the shared transporter (no per-request connection),
 *  - injects the configured "From" address,
 *  - never logs credentials.
 *
 * Callers (future notification workflows) are responsible for choosing
 * recipients, subject, body, and when to send.
 */

export interface SendMailInput {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  /** Optional override for the From header. Defaults to the configured address. */
  from?: string;
  /** Optional Reply-To header. */
  replyTo?: string;
  /** Optional CC recipients. */
  cc?: string | string[];
  /** Optional BCC recipients. */
  bcc?: string | string[];
}

export interface SendMailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  pending: string[];
  response: string;
}

/**
 * Send a single email using the shared SMTP transporter.
 *
 * @throws if SMTP is not configured or the send fails. Errors are sanitized
 *         before being surfaced to API responses (see `sanitizeSmtpError`).
 */
export async function sendMail(
  input: SendMailInput,
): Promise<SendMailResult> {
  const transporter = getTransporter();
  const config = getCachedSmtpConfig();
  const from = input.from ?? formatFromAddress(config);

  const info = await transporter.sendMail({
    from,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    replyTo: input.replyTo,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted ?? [],
    rejected: info.rejected ?? [],
    pending: info.pending ?? [],
    response: info.response,
  };
}
