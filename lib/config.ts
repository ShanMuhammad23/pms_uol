/**
 * Client-accessible application configuration.
 *
 * Values sourced from `NEXT_PUBLIC_` environment variables are inlined at build
 * time and are safe to reference from client components. Add the following to
 * your `.env` file to override the HR contact address:
 *
 *   NEXT_PUBLIC_HR_EMAIL=hr@your-domain.example
 */

/** HR contact address used by the "Ask HR" feature. */
export const HR_EMAIL = process.env.NEXT_PUBLIC_HR_EMAIL ?? "hr@example.com";

const DEFAULT_SUBJECT = "Ask HR - Assessment Assistance";
const DEFAULT_BODY = `Hello HR,

I need assistance regarding my assessment.

My question:
`;

interface AskHrComposeOptions {
  /** Optional non-sensitive context (e.g. the form title). Falls back to the default subject. */
  subject?: string;
  /** Optional override for the email body. */
  body?: string;
}

/**
 * Build a Gmail Web compose URL that opens Gmail's compose window in the
 * browser with the HR address pre-populated in the To field.
 *
 * This deliberately uses Gmail's web compose endpoint instead of `mailto:` so
 * the OS default mail client (e.g. Outlook) is not invoked. The application
 * never sends the email itself — the employee reviews and sends it from their
 * own Gmail account. If they are not signed in, Gmail prompts them to log in.
 *
 * Each component is URL-encoded via `encodeURIComponent` (not raw string
 * concatenation) so spaces become `%20`, which Gmail interprets correctly.
 *
 * @see https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...&body=...
 */
export function buildAskHrGmailUrl({
  subject,
  body,
}: AskHrComposeOptions = {}): string {
  const finalSubject = subject?.trim() || DEFAULT_SUBJECT;
  const finalBody = body ?? DEFAULT_BODY;
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: HR_EMAIL,
    su: finalSubject,
    body: finalBody,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}
