import StaffCategoriesManager from "@/app/components/staff-categories/StaffCategoriesManager";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";

export default async function StaffCategoriesPage() {
  await requireSuperAdminSession();

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">Staff Categories Management</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Create and manage staff categories and their sub-categories for user assignments.
        </p>
      </div>

      <StaffCategoriesManager />
    </div>
  );
}
