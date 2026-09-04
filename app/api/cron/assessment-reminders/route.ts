import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runAssessmentReminders } from "@/lib/services/assessment-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET/POST /api/cron/assessment-reminders
 *
 * Sends due assessment reminder emails:
 * - Employees: pending self-assessment (cooldown 48 hours)
 * - Managers: digest of pending direct assessments + unreviewed submissions
 *   (cooldown 3 days)
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`
 * Schedule this daily (or hourly). Cooldown columns prevent same-day resends.
 */

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secret.trim()) {
    console.error("[cron/assessment-reminders] CRON_SECRET is not configured.");
    return false;
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const token = header.slice("Bearer ".length).trim();
  const expected = secret.trim();

  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAssessmentReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/assessment-reminders] failed:", error);
    return NextResponse.json(
      { ok: false, error: "Assessment reminder run failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
