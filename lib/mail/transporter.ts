import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { getSmtpConfig, type SmtpConfig } from "./config";

/**
 * Singleton SMTP transporter for PMS.
 *
 * The transporter is created lazily on first use and reused for the lifetime of
 * the Node.js process. This avoids opening a new SMTP connection pool per
 * request. Nodemailer's transporter manages its own connection pool internally.
 *
 * If the SMTP env vars are not configured, `getTransporter()` throws a safe
 * error (no values) — callers should guard with `isSmtpConfigured()` first when
 * graceful degradation is desired.
 */

let cachedTransporter: Transporter | null = null;
let cachedConfig: SmtpConfig | null = null;

/**
 * Returns the shared nodemailer transporter, creating it on first call.
 * Subsequent calls reuse the same transporter (and its connection pool).
 */
export function getTransporter(): Transporter {
  if (cachedTransporter && cachedConfig) {
    return cachedTransporter;
  }

  const config = getSmtpConfig();

  // STARTTLS on port 587 => secure: false (upgrade happens after connect).
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    // Timeout to prevent hanging background tasks when SMTP server is slow
    // or unreachable. These are fire-and-forget notifications, so a timeout
    // just means the email is skipped — the workflow still succeeds.
    connectionTimeout: 10_000, // 10s to establish connection
    greetingTimeout: 10_000, // 10s for SMTP greeting
    socketTimeout: 30_000, // 30s for any socket operation
  });

  cachedTransporter = transporter;
  cachedConfig = config;
  return transporter;
}

/**
 * Returns the SMTP config used to build the cached transporter.
 * Throws if the transporter has not been built yet.
 */
export function getCachedSmtpConfig(): SmtpConfig {
  if (!cachedConfig) {
    return getSmtpConfig();
  }
  return cachedConfig;
}

/**
 * Close and discard the cached transporter. Intended for tests or explicit
 * reconfiguration. Not used by normal request handling.
 */
export function resetTransporter(): void {
  if (cachedTransporter) {
    try {
      const closeResult: unknown = cachedTransporter.close();
      if (closeResult && typeof closeResult === "object" && typeof (closeResult as Promise<void>).catch === "function") {
        (closeResult as Promise<void>).catch(() => {
          /* ignore close errors during reset */
        });
      }
    } catch {
      /* ignore close errors during reset */
    }
  }
  cachedTransporter = null;
  cachedConfig = null;
}
