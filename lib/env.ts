/**
 * Validate required runtime secrets at process start.
 * Import from instrumentation.ts or a server entry so misconfig fails fast.
 */
const REQUIRED = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

export function assertRequiredEnv(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const missing = REQUIRED.filter((key) => {
    const value = env[key];
    return !value || !String(value).trim();
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  const secret = env.NEXTAUTH_SECRET ?? "";
  if (secret.length < 32) {
    const message =
      "NEXTAUTH_SECRET must be at least 32 characters (use a CSPRNG value).";
    if (env.NODE_ENV === "production") {
      throw new Error(message);
    }
    console.warn(`[env] ${message}`);
  }
}

export function getAuthCookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}
