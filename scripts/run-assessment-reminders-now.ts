/**
 * Run assessment reminders immediately (outside the cron HTTP endpoint).
 *
 * Usage:
 *   node --require ./scripts/stub-server-only.cjs --import tsx --env-file=.env scripts/run-assessment-reminders-now.ts
 */
import { runAssessmentReminders } from "../lib/services/assessment-reminders";
import { db } from "../lib/db";

async function main() {
  console.log("[run-assessment-reminders-now] starting…");
  const result = await runAssessmentReminders();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("[run-assessment-reminders-now] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end().catch(() => undefined);
  });
