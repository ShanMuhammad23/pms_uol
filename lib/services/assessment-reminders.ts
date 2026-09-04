import "server-only";

import { getDefaultAppraisalCycle } from "@/lib/queries/appraisal-cycles";
import {
  listPendingManagerReminders,
  listPendingSelfAssessmentReminders,
  markManagerReminderSent,
  markSelfAssessmentReminderSent,
  type PendingManagerReminder,
  type PendingSelfAssessmentReminder,
} from "@/lib/queries/assessment-reminders";
import { isSmtpConfigured } from "@/lib/mail";
import { dispatchNotification } from "@/lib/mail/notifications/dispatch";
import {
  managerPendingWorkReminderTemplate,
  selfAssessmentReminderTemplate,
} from "@/lib/mail/notifications/templates";

/** Concurrent SMTP sends — keep modest so Mailgun / local SMTP stay healthy. */
const SEND_CONCURRENCY = 8;

export interface AssessmentReminderRunResult {
  cycleId: number | null;
  cycleFiscalYear: number | null;
  smtpConfigured: boolean;
  employee: {
    candidates: number;
    sent: number;
    failed: number;
  };
  manager: {
    candidates: number;
    sent: number;
    failed: number;
  };
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;

  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        await worker(items[index], index);
      }
    },
  );

  await Promise.all(workers);
}

async function sendEmployeeReminder(
  item: PendingSelfAssessmentReminder,
): Promise<boolean> {
  const content = selfAssessmentReminderTemplate({
    employeeName: item.employeeName,
    formTitle: item.formTitle,
    cycleFiscalYear: item.cycleFiscalYear,
  });

  const sent = await dispatchNotification(
    item.appraisalId ?? 0,
    "self_assessment_reminder",
    { email: item.employeeEmail, name: item.employeeName },
    content,
  );

  if (sent) {
    await markSelfAssessmentReminderSent({
      assignmentId: item.assignmentId,
      appraisalId: item.appraisalId,
    });
  }

  return sent;
}

async function sendManagerReminder(
  item: PendingManagerReminder,
  cycleFiscalYear: number,
): Promise<boolean> {
  const content = managerPendingWorkReminderTemplate({
    managerName: item.managerName,
    directAssessmentCount: item.directAssessmentCount,
    pendingReviewCount: item.pendingReviewCount,
    cycleFiscalYear,
  });

  const sent = await dispatchNotification(
    0,
    "manager_pending_work_reminder",
    { email: item.managerEmail, name: item.managerName },
    content,
  );

  if (sent) {
    await markManagerReminderSent(item.managerUserId);
  }

  return sent;
}

/**
 * Send due employee (48h) and manager (3d) assessment reminder emails.
 *
 * Idempotent per cooldown window: last-reminder timestamps are updated only
 * after a successful SMTP send so failed deliveries can retry on the next run.
 */
export async function runAssessmentReminders(): Promise<AssessmentReminderRunResult> {
  const startedAt = Date.now();
  const empty: AssessmentReminderRunResult = {
    cycleId: null,
    cycleFiscalYear: null,
    smtpConfigured: isSmtpConfigured(),
    employee: { candidates: 0, sent: 0, failed: 0 },
    manager: { candidates: 0, sent: 0, failed: 0 },
  };

  console.info(
    `[assessment-reminders] start smtpConfigured=${empty.smtpConfigured}`,
  );

  const cycle = await getDefaultAppraisalCycle();
  if (!cycle) {
    console.warn("[assessment-reminders] skipped — no appraisal cycle found.");
    return empty;
  }

  const result: AssessmentReminderRunResult = {
    ...empty,
    cycleId: cycle.id,
    cycleFiscalYear: cycle.fiscalYear,
  };

  if (!result.smtpConfigured) {
    console.warn("[assessment-reminders] skipped — SMTP not configured.");
    return result;
  }

  const employees = await listPendingSelfAssessmentReminders(cycle.id);
  result.employee.candidates = employees.length;
  console.info(
    `[assessment-reminders] employee candidates=${employees.length}`,
  );

  await mapPool(employees, SEND_CONCURRENCY, async (item, index) => {
    const sent = await sendEmployeeReminder(item);
    if (sent) {
      result.employee.sent += 1;
    } else {
      result.employee.failed += 1;
    }
    // Progress logs are best-effort under concurrency (counts may lag slightly).
    if ((index + 1) % 25 === 0 || index + 1 === employees.length) {
      console.info(
        `[assessment-reminders] employee progress ~${index + 1}/${employees.length} ` +
          `sent=${result.employee.sent} failed=${result.employee.failed}`,
      );
    }
  });

  const managers = await listPendingManagerReminders(cycle.id);
  result.manager.candidates = managers.length;
  console.info(`[assessment-reminders] manager candidates=${managers.length}`);

  await mapPool(managers, SEND_CONCURRENCY, async (item, index) => {
    const sent = await sendManagerReminder(item, cycle.fiscalYear);
    if (sent) {
      result.manager.sent += 1;
    } else {
      result.manager.failed += 1;
    }
    if ((index + 1) % 25 === 0 || index + 1 === managers.length) {
      console.info(
        `[assessment-reminders] manager progress ${index + 1}/${managers.length} ` +
          `sent=${result.manager.sent} failed=${result.manager.failed}`,
      );
    }
  });

  console.info(
    `[assessment-reminders] done cycle=${cycle.id} ` +
      `employee sent=${result.employee.sent}/${result.employee.candidates} ` +
      `manager sent=${result.manager.sent}/${result.manager.candidates} ` +
      `elapsedMs=${Date.now() - startedAt}`,
  );

  return result;
}
