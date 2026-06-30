import EntityStructureTabs from "@/app/components/entity-categories/EntityStructureTabs";
import { requireSession } from "@/lib/auth/require-session";

export default async function EntityCategoriesPage() {
  await requireSession();

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h1 className="text-2xl font-bold">Entity & Entity Categories Management</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Manage entity categories and organizational entities used across the
          performance management system.
        </p>
      </div>

      <EntityStructureTabs />
    </div>
  );
}
