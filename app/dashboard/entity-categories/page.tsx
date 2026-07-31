import EntityStructureTabs from "@/app/components/entity-categories/EntityStructureTabs";
import { requireSuperAdminSession } from "@/lib/auth/require-super-admin";

export default async function EntityCategoriesPage() {
  await requireSuperAdminSession();

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">Organization Levels Management</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Manage organization levels and view the full entity hierarchy tree.
        </p>
      </div>

      <EntityStructureTabs />
    </div>
  );
}
