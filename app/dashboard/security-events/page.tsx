import SecurityEventsManager from "@/app/components/security-events/SecurityEventsManager";
import { requireTrueSuperAdminSession } from "@/lib/auth/require-super-admin";

export default async function SecurityEventsPage() {
  await requireTrueSuperAdminSession();

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">Security Events</h1>
        <p className="mt-1 text-sm text-foreground/70">
          A plain-language log of failed sign-ins and blocked access attempts.
          Visible only to Super Admins.
        </p>
      </div>

      <SecurityEventsManager />
    </div>
  );
}
