import "server-only";

import { getDefaultAppraisalCycle } from "@/lib/queries/appraisal-cycles";
import {
  listPendingManagerReminders,
  listPendingSelfAssessmentReminders,
  markManagerReminderSent,
  markSelfAssessmentReminderSent,
} from "@/lib/queries/assessment-reminders";
import { isSmtpConfigured } from "@/lib/mail";
import { dispatchNotification } from "@/lib/mail/notifications/dispatch";
import {
  managerPendingWorkReminderTemplate,
  selfAssessmentReminderTemplate,
} from "@/lib/mail/notifications/templates";

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
export async function runAssessmentReminders(): Promise<AssessmentReminderRunResult> {
  const empty: AssessmentReminderRunResult = {
    cycleId: null,
    cycleFiscalYear: null,
    smtpConfigured: isSmtpConfigured(),
    employee: { candidates: 0, sent: 0, failed: 0 },
    manager: { candidates: 0, sent: 0, failed: 0 },
  };

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

  for (const item of employees) {
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
      result.employee.sent += 1;
    } else {
      result.employee.failed += 1;
    }
  }

  const managers = await listPendingManagerReminders(cycle.id);
  result.manager.candidates = managers.length;

  for (const item of managers) {
    const content = managerPendingWorkReminderTemplate({
      managerName: item.managerName,
      directAssessmentCount: item.directAssessmentCount,
      pendingReviewCount: item.pendingReviewCount,
      cycleFiscalYear: cycle.fiscalYear,
    });

    const sent = await dispatchNotification(
      0,
      "manager_pending_work_reminder",
      { email: item.managerEmail, name: item.managerName },
      content,
    );

    if (sent) {
      await markManagerReminderSent(item.managerUserId);
      result.manager.sent += 1;
    } else {
      result.manager.failed += 1;
    }
  }

  console.info(
    `[assessment-reminders] cycle=${cycle.id} ` +
      `employee sent=${result.employee.sent}/${result.employee.candidates} ` +
      `manager sent=${result.manager.sent}/${result.manager.candidates}`,
  );

  return result;
}
