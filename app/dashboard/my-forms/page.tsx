import MyFormsList from "@/app/components/employee-forms/MyFormsList";
import { requireSession } from "@/lib/auth/require-session";

export default async function MyFormsPage() {
  await requireSession();

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">My Forms</h1>
        <p className="mt-1 text-sm text-foreground/70">
          View and complete appraisal forms assigned to you.
        </p>
      </div>

      <MyFormsList />
    </div>
  );
}
