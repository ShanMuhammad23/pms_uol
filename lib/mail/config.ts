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
 *   SMTP_FROM_EMAIL (or MAIL_FROM_EMAIL)
 *
 * Optional:
 *   SMTP_FROM_NAME / MAIL_FROM_NAME (defaults to "Performance Management System")
 *
 * SMTP credentials must NEVER be hardcoded. Secrets live only in the
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

const DEFAULT_FROM_NAME = "Performance Management System";

/** Connection/auth keys that must always be present. */
const SMTP_CONNECTION_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
] as const;

function readEnv(
  env: NodeJS.ProcessEnv,
  key: string,
): string | undefined {
  const value = env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Prefer SMTP_FROM_EMAIL, fall back to MAIL_FROM_EMAIL. */
export function resolveFromEmail(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return readEnv(env, "SMTP_FROM_EMAIL") ?? readEnv(env, "MAIL_FROM_EMAIL");
}

/** Prefer SMTP_FROM_NAME / MAIL_FROM_NAME, else PMS default. */
export function resolveFromName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    readEnv(env, "SMTP_FROM_NAME") ??
    readEnv(env, "MAIL_FROM_NAME") ??
    DEFAULT_FROM_NAME
  );
}

/**
 * Returns true when SMTP connection vars and a from-address are configured.
 */
export function isSmtpConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const connectionOk = SMTP_CONNECTION_KEYS.every(
    (key) => readEnv(env, key) != null,
  );
  return connectionOk && resolveFromEmail(env) != null;
}

/**
 * Missing SMTP env var names (for diagnostics). Never includes values.
 */
export function missingSmtpEnvKeys(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const missing: string[] = SMTP_CONNECTION_KEYS.filter(
    (key) => readEnv(env, key) == null,
  );
  if (resolveFromEmail(env) == null) {
    missing.push("SMTP_FROM_EMAIL (or MAIL_FROM_EMAIL)");
  }
  return missing;
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

  const portRaw = readEnv(env, "SMTP_PORT");
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(
      `SMTP_PORT must be a valid port number (got "${String(portRaw)}").`,
    );
  }

  const secureRaw = String(readEnv(env, "SMTP_SECURE")).toLowerCase();
  const secure = secureRaw === "true" || secureRaw === "1";

  return {
    host: readEnv(env, "SMTP_HOST")!,
    port,
    secure,
    user: readEnv(env, "SMTP_USER")!,
    // Trim so accidental trailing whitespace in .env does not break auth.
    password: String(env.SMTP_PASSWORD).trim(),
    fromEmail: resolveFromEmail(env)!,
    fromName: resolveFromName(env),
  };
}

/**
 * Build the formatted "From" header value, e.g. `"Name" <addr@example.com>`.
 */
export function formatFromAddress(config: SmtpConfig): string {
  const name = config.fromName.replace(/"/g, "").trim();
  return name ? `"${name}" <${config.fromEmail}>` : `<${config.fromEmail}>`;
}
