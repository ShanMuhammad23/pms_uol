import "server-only";

import { isSmtpConfigured, missingSmtpEnvKeys } from "./config";
import { getTransporter } from "./transporter";

/**
 * SMTP connection verification.
 *
 * Connects to the configured SMTP server and authenticates using the App
 * Password, without sending any email. Used to confirm that PMS can
 * successfully reach and authenticate with Gmail.
 *
 * Verification is intentionally NOT run on every request — it is only invoked
 * by the dedicated health endpoint (or explicit server-side checks).
 */

export interface SmtpVerifyResult {
  ok: boolean;
  /** Human-readable status, safe to expose in API responses (no secrets). */
  message: string;
  /** Optional diagnostic code from the SMTP server (no credentials). */
  code?: number;
  /** Whether SMTP env vars were present at all. */
  configured: boolean;
  /** Missing env var names (never values). */
  missingEnv?: string[];
}

/**
 * Verify the SMTP transporter can connect and authenticate.
 *
 * Never logs the password or full config. Errors are sanitized so credentials
 * are not leaked into logs or responses.
 */
export async function verifySmtpConnection(): Promise<SmtpVerifyResult> {
  if (!isSmtpConfigured()) {
    const missing = missingSmtpEnvKeys();
    return {
      ok: false,
      configured: false,
      missingEnv: missing,
      message: `SMTP not configured. Missing env vars: ${missing.join(", ")}`,
    };
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    return {
      ok: true,
      configured: true,
      message: "SMTP connection verified successfully.",
    };
  } catch (error) {
    const sanitized = sanitizeSmtpError(error);
    console.error("[mail/verify] SMTP verification failed:", sanitized);
    return {
      ok: false,
      configured: true,
      message: sanitized.message,
      code: sanitized.code,
    };
  }
}

/**
 * Strip credentials and sensitive config from an SMTP error before it is
 * logged or returned in an API response.
 */
export function sanitizeSmtpError(error: unknown): {
  message: string;
  code?: number;
} {
  if (error && typeof error === "object") {
    const raw = error as { message?: unknown; code?: unknown; response?: unknown };

    let message = "SMTP operation failed.";
    if (typeof raw.message === "string") {
      // Remove anything that looks like a password or auth token.
      message = raw.message
        .replace(/(password|pass|pwd|auth|token)\s*[:=]\s*\S+/gi, "$1=***")
        .replace(/535\s+5\.7\.8[\s\S]*$/i, "535 5.7.8 Authentication failed (check SMTP_USER / App Password).")
        .trim();
    }

    const code =
      typeof raw.code === "number"
        ? raw.code
        : typeof raw.code === "string" && /^\d+$/.test(raw.code)
          ? Number(raw.code)
          : undefined;

    return { message, code };
  }

  return { message: "SMTP operation failed." };
}
