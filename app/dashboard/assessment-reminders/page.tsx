import AssessmentRemindersManager from "@/app/components/assessment-reminders/AssessmentRemindersManager";
import { requireTrueSuperAdminSession } from "@/lib/auth/require-super-admin";

export default async function AssessmentRemindersPage() {
  await requireTrueSuperAdminSession();

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">Assessment Reminders</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Sent self-assessment (employee) and pending-work (manager) reminder
          emails, with last send time. Visible only to Super Admins.
        </p>
      </div>

      <AssessmentRemindersManager />
    </div>
  );
}
