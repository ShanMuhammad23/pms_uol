import MyFormsList from "@/app/components/employee-forms/MyFormsList";
import { requireSession } from "@/lib/auth/require-session";

export default async function MyFormsPage() {
  const session = await requireSession();

  return (
    <div className="space-y-6 text-text-primary">
      <MyFormsList
        userName={session.user?.name ?? null}
        userRole={session.user?.role ?? null}
        userEmail={session.user?.email ?? null}
      />
    </div>
  );
}
