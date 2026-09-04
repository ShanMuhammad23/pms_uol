import { after, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runAssessmentReminders } from "@/lib/services/assessment-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Allow long SMTP batches when the caller awaits completion (?await=1). */
export const maxDuration = 600;

/**
 * GET/POST /api/cron/assessment-reminders
 *
 * Default: returns HTTP 202 immediately and sends emails in `after()` so the
 * cron shell script does not time out on large batches (~300 recipients).
 *
 * Optional: `?await=1` waits for the full run and returns the result JSON
 * (useful for debugging; needs a long curl --max-time).
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`
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

function wantsAwait(request: Request): boolean {
  const url = new URL(request.url);
  const value = url.searchParams.get("await");
  return value === "1" || value === "true";
}

async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (wantsAwait(request)) {
    console.info("[cron/assessment-reminders] running synchronously (?await=1)");
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

  console.info(
    "[cron/assessment-reminders] accepted — sending in background via after()",
  );

  after(async () => {
    try {
      await runAssessmentReminders();
    } catch (error) {
      console.error("[cron/assessment-reminders] background run failed:", error);
    }
  });

  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      message:
        "Assessment reminders accepted. Watch pm2 logs for send progress/completion.",
    },
    { status: 202 },
  );
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
