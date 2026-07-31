import "server-only";

import { db } from "@/lib/db";

export type SecurityEventType =
  | "AUTH_REQUIRED"
  | "AUTH_REJECTED"
  | "AUTHZ_DENIED"
  | "LOGIN_FAILURE"
  | "INACTIVE_SESSION"
  | "PRIVILEGE_PROBE"
  | "SUSPICIOUS_PATTERN";

export interface SecurityEventInput {
  eventType: SecurityEventType;
  actorUserId?: number | null;
  path?: string | null;
  method?: string | null;
  meta?: Record<string, unknown>;
}

export interface SecurityEventRecord {
  id: number;
  eventType: string;
  actorUserId: number | null;
  actorName: string | null;
  actorEmail: string | null;
  path: string | null;
  method: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  /** Short plain-language title for non-technical readers */
  title: string;
  /** One-sentence explanation */
  summary: string;
  /** Extra simple detail lines (who / where / why) */
  details: string[];
}

/**
 * Best-effort security audit sink.
 * Writes to `security_events` when the table exists; otherwise logs to stderr.
 * Never throws — auth paths must not fail open/closed on audit errors.
 */
export async function logSecurityEvent(
  event: SecurityEventInput,
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO security_events (
         event_type,
         actor_user_id,
         path,
         method,
         meta
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        event.eventType,
        event.actorUserId ?? null,
        event.path ?? null,
        event.method ?? null,
        JSON.stringify(event.meta ?? {}),
      ],
    );
  } catch (error) {
    console.warn("[security_events]", event.eventType, event.meta, error);
  }
}

const EVENT_COPY: Record<
  string,
  { title: string; summary: string }
> = {
  AUTH_REQUIRED: {
    title: "Signed-out access attempt",
    summary:
      "Someone tried to open a protected page or feature without signing in.",
  },
  AUTH_REJECTED: {
    title: "Sign-in blocked",
    summary:
      "The system blocked a sign-in or session because the account is not allowed.",
  },
  AUTHZ_DENIED: {
    title: "Permission denied",
    summary:
      "A signed-in user tried to open something their role is not allowed to use.",
  },
  LOGIN_FAILURE: {
    title: "Failed sign-in",
    summary:
      "Someone tried to sign in with the wrong details, or with an inactive account.",
  },
  INACTIVE_SESSION: {
    title: "Account turned off while signed in",
    summary:
      "A user account was disabled while that person still had an open session.",
  },
  PRIVILEGE_PROBE: {
    title: "Repeated restricted access attempts",
    summary:
      "There were several tries to reach areas this user should not open.",
  },
  SUSPICIOUS_PATTERN: {
    title: "Unusual activity flagged",
    summary: "The system noticed activity that looks unusual and should be reviewed.",
  },
};

function metaString(
  meta: Record<string, unknown>,
  key: string,
): string | null {
  const value = meta[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function reasonInPlainLanguage(reason: string | null): string | null {
  if (!reason) return null;

  switch (reason) {
    case "missing_session":
      return "No active sign-in was found.";
    case "missing_or_inactive":
      return "The account was missing or turned off.";
    case "bad_password":
      return "The password did not match.";
    case "google_not_provisioned_or_inactive":
      return "This Google account is not set up in PMS, or it is turned off.";
    case "ROLE_DENIED":
      return "Their job role does not allow this action.";
    case "HORIZONTAL_DENY":
      return "They tried to open another person's record.";
    case "INACTIVE":
      return "Their account is turned off.";
    case "UNAUTHENTICATED":
      return "They were not signed in.";
    case "ENTITY_REQUIRED":
      return "Their account is not linked to an organization unit.";
    default:
      return null;
  }
}

export function describeSecurityEvent(input: {
  eventType: string;
  actorName: string | null;
  actorEmail: string | null;
  path: string | null;
  method: string | null;
  meta: Record<string, unknown>;
}): Pick<SecurityEventRecord, "title" | "summary" | "details"> {
  const copy = EVENT_COPY[input.eventType] ?? {
    title: "Security notice",
    summary: "A security-related event was recorded for review.",
  };

  const details: string[] = [];

  if (input.actorName || input.actorEmail) {
    details.push(
      `Person involved: ${[input.actorName, input.actorEmail].filter(Boolean).join(" · ")}`,
    );
  } else {
    details.push("Person involved: Unknown (not signed in, or not identified).");
  }

  if (input.path) {
    details.push(`Where: ${input.path}`);
  }

  const reason =
    reasonInPlainLanguage(metaString(input.meta, "code")) ??
    reasonInPlainLanguage(metaString(input.meta, "reason"));

  if (reason) {
    details.push(`Why: ${reason}`);
  }

  const email = metaString(input.meta, "email");
  if (email && !input.actorEmail) {
    details.push(`Email used: ${email}`);
  }

  return {
    title: copy.title,
    summary: copy.summary,
    details,
  };
}

export async function listSecurityEvents(options?: {
  limit?: number;
  offset?: number;
  eventType?: string | null;
}): Promise<{ items: SecurityEventRecord[]; total: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const offset = Math.max(options?.offset ?? 0, 0);
  const eventType = options?.eventType?.trim() || null;

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM security_events
     WHERE ($1::text IS NULL OR event_type = $1)`,
    [eventType],
  );

  const result = await db.query<{
    id: string;
    event_type: string;
    actor_user_id: string | null;
    actor_name: string | null;
    actor_email: string | null;
    path: string | null;
    method: string | null;
    meta: Record<string, unknown> | null;
    created_at: string;
  }>(
    `SELECT
       se.id,
       se.event_type,
       se.actor_user_id,
       CASE
         WHEN u.id IS NULL THEN NULL
         ELSE trim(both FROM concat_ws(' ', u.first_name, u.last_name))
       END AS actor_name,
       u.email AS actor_email,
       se.path,
       se.method,
       se.meta,
       se.created_at::text
     FROM security_events se
     LEFT JOIN users u ON u.id = se.actor_user_id
     WHERE ($1::text IS NULL OR se.event_type = $1)
     ORDER BY se.created_at DESC, se.id DESC
     LIMIT $2 OFFSET $3`,
    [eventType, limit, offset],
  );

  const items = result.rows.map((row) => {
    const meta =
      row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
        ? row.meta
        : {};
    const described = describeSecurityEvent({
      eventType: row.event_type,
      actorName: row.actor_name,
      actorEmail: row.actor_email,
      path: row.path,
      method: row.method,
      meta,
    });

    return {
      id: Number(row.id),
      eventType: row.event_type,
      actorUserId: row.actor_user_id ? Number(row.actor_user_id) : null,
      actorName: row.actor_name,
      actorEmail: row.actor_email,
      path: row.path,
      method: row.method,
      meta,
      createdAt: row.created_at,
      ...described,
    };
  });

  return {
    items,
    total: Number(countResult.rows[0]?.count ?? 0),
  };
}
