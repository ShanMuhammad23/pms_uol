import "server-only";

import { isSmtpConfigured, sanitizeSmtpError, sendMail } from "@/lib/mail";
import type { EmailContent } from "./templates";

/**
 * Fire-and-forget notification dispatcher.
 *
 * Design principles:
 * - **Non-blocking**: callers use `void dispatchNotification(...)` so the
 *   user request is not delayed by SMTP latency.
 * - **Never throws**: all errors are caught and logged. A failed email never
 *   rolls back a successful workflow operation.
 * - **No credentials in logs**: errors are sanitized via `sanitizeSmtpError`.
 * - **Single trigger**: each workflow action calls this exactly once.
 * - **Guards**: silently skips when SMTP is not configured or the recipient
 *   has no email address — the workflow still succeeds.
 */

export interface NotificationTarget {
  email: string;
  name: string;
}

/**
 * Attempt to send a single notification email.
 *
 * This function is self-contained — it never throws. Call it with `void` for
 * fire-and-forget, or `await` it if you need to know the result.
 *
 * @param appraisalId  For logging only (never in the email body).
 * @param event        Short event name for log lines (e.g. "manager1_approved").
 * @param target       Recipient with email + name.
 * @param content      Subject/HTML/text from a template function.
 */
export async function dispatchNotification(
  appraisalId: number,
  event: string,
  target: NotificationTarget,
  content: EmailContent,
): Promise<void> {
  const logPrefix = `[mail/notify] appraisal=${appraisalId} event=${event}`;

  if (!isSmtpConfigured()) {
    console.warn(`${logPrefix} skipped — SMTP not configured.`);
    return;
  }

  if (!target.email || !target.email.trim()) {
    console.warn(`${logPrefix} skipped — recipient has no email address.`);
    return;
  }

  try {
    const result = await sendMail({
      to: target.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    console.info(
      `${logPrefix} sent to="${target.email}" messageId="${result.messageId}" accepted=${result.accepted.length}`,
    );
  } catch (error) {
    const sanitized = sanitizeSmtpError(error);
    console.error(
      `${logPrefix} FAILED to="${target.email}" message="${sanitized.message}"` +
        (sanitized.code ? ` code=${sanitized.code}` : ""),
    );
  }
}

/**
 * Dispatch multiple notifications in parallel (e.g. return-to-manager sends
 * to both the manager and the employee). Each is independent — one failure
 * does not affect the others.
 */
export function dispatchNotifications(
  appraisalId: number,
  event: string,
  items: Array<{ target: NotificationTarget; content: EmailContent }>,
): void {
  for (const item of items) {
    void dispatchNotification(appraisalId, event, item.target, item.content);
  }
}
