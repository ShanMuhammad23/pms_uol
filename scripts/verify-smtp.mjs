/**
 * Standalone SMTP verification script.
 *
 * Usage (from project root, after setting SMTP_* in .env):
 *   node --env-file=.env scripts/verify-smtp.mjs
 *
 * This bypasses the Next.js `server-only` guard so it can run in plain Node.
 * It uses the SAME configuration logic as lib/mail (host/port/secure/auth from
 * env) and calls nodemailer's transporter.verify() — it does NOT send any email.
 *
 * No credentials are printed. Only a success/failure summary is shown.
 */

import nodemailer from "nodemailer";

const REQUIRED = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
];

const missing = REQUIRED.filter((k) => !process.env[k] || !String(process.env[k]).trim());
const fromEmail =
  (process.env.SMTP_FROM_EMAIL && String(process.env.SMTP_FROM_EMAIL).trim()) ||
  (process.env.MAIL_FROM_EMAIL && String(process.env.MAIL_FROM_EMAIL).trim()) ||
  "";
if (missing.length > 0 || !fromEmail) {
  const report = [...missing];
  if (!fromEmail) report.push("SMTP_FROM_EMAIL (or MAIL_FROM_EMAIL)");
  console.error(`[verify-smtp] Missing env vars: ${report.join(", ")}`);
  console.error("Set them in .env and run: node --env-file=.env scripts/verify-smtp.mjs");
  process.exit(2);
}

const port = Number(process.env.SMTP_PORT);
if (!Number.isFinite(port) || port <= 0 || port > 65535) {
  console.error(`[verify-smtp] SMTP_PORT is not a valid port: ${process.env.SMTP_PORT}`);
  process.exit(2);
}

const secure = String(process.env.SMTP_SECURE).trim().toLowerCase() === "true";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

console.log(`[verify-smtp] Connecting to ${process.env.SMTP_HOST}:${port} (secure=${secure}) as ${process.env.SMTP_USER} ...`);

try {
  await transporter.verify();
  console.log("[verify-smtp] SUCCESS — SMTP connection verified and authenticated.");
  await transporter.close();
  process.exit(0);
} catch (error) {
  const msg = error && typeof error === "object" && "message" in error
    ? String(error.message)
        .replace(/(password|pass|pwd|auth|token)\s*[:=]\s*\S+/gi, "$1=***")
        .replace(/535\s+5\.7\.8[\s\S]*$/i, "535 5.7.8 Authentication failed (check SMTP_USER / App Password).")
    : "Unknown SMTP error";
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  console.error("[verify-smtp] FAILED — SMTP verification failed.");
  console.error(`[verify-smtp] Message: ${msg}`);
  if (code !== undefined) console.error(`[verify-smtp] Code: ${code}`);
  try { await transporter.close(); } catch {}
  process.exit(1);
}
