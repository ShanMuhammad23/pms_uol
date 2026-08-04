import UsersManager from "@/app/components/users/UsersManager";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";

export default async function UsersPage() {
  await requireSuperAdminSession();

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Create, update, and manage system users, roles, and reporting lines.
        </p>
      </div>

      <UsersManager />
    </div>
  );
}
