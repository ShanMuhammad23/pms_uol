import "server-only";

/**
 * Server-side SMTP / mail configuration.
 *
 * All values are read from environment variables and are only accessible from
 * server code (this module is guarded by `import "server-only"`). No SMTP
 * credentials are ever exposed to the client bundle.
 *
 * Required env vars (see `.env`):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD,
 *   MAIL_FROM_EMAIL, MAIL_FROM_NAME
 *
 * SMTP credentials must NEVER be hardcoded. The App Password lives only in the
 * deployment environment / `.env` (which is gitignored).
 */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

/** Keys that must be present for the mail service to function. */
const SMTP_ENV_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "MAIL_FROM_EMAIL",
  "MAIL_FROM_NAME",
] as const;

/**
 * Returns true when every SMTP env var is set to a non-empty value.
 * Used to decide whether the mail service is available without throwing.
 */
export function isSmtpConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return SMTP_ENV_KEYS.every((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

/**
 * Missing SMTP env var names (for diagnostics). Never includes values.
 */
export function missingSmtpEnvKeys(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return SMTP_ENV_KEYS.filter((key) => {
    const value = env[key];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

/**
 * Build the typed SMTP config from environment variables.
 * Throws a safe error (no values) if required vars are missing.
 */
export function getSmtpConfig(
  env: NodeJS.ProcessEnv = process.env,
): SmtpConfig {
  const missing = missingSmtpEnvKeys(env);
  if (missing.length > 0) {
    throw new Error(
      `SMTP not configured. Missing environment variables: ${missing.join(", ")}`,
    );
  }

  const portRaw = env.SMTP_PORT;
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(
      `SMTP_PORT must be a valid port number (got "${String(portRaw)}").`,
    );
  }

  const secureRaw = String(env.SMTP_SECURE).trim().toLowerCase();
  const secure = secureRaw === "true" || secureRaw === "1";

  return {
    host: String(env.SMTP_HOST).trim(),
    port,
    secure,
    user: String(env.SMTP_USER).trim(),
    password: String(env.SMTP_PASSWORD),
    fromEmail: String(env.MAIL_FROM_EMAIL).trim(),
    fromName: String(env.MAIL_FROM_NAME).trim(),
  };
}

/**
 * Build the formatted "From" header value, e.g. `"Name" <addr@example.com>`.
 */
export function formatFromAddress(config: SmtpConfig): string {
  const name = config.fromName.replace(/"/g, "").trim();
  return name ? `"${name}" <${config.fromEmail}>` : `<${config.fromEmail}>`;
}
