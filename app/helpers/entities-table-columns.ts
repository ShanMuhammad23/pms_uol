import type { EntityRecord } from "@/types/entities";

export type EntitiesTableColumnId =
  | "category"
  | "parent"
  | "name"
  | "staff"
  | "updated"
  | "actions";

export type EntitiesTableColumnDef = {
  id: EntitiesTableColumnId;
  label: string;
  align?: "left" | "right" | "center";
  /** Marks the column as numeric, enabling GT/LT range filtering. */
  numeric?: boolean;
  /** Optional fixed width classes for th/td. */
  widthClass?: string;
  getValue: (row: EntityRecord) => string;
};

function formatNullable(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatParent(row: EntityRecord): string {
  if (!row.parentName) return "—";
  if (row.parentCategoryCode) {
    return `${row.parentCategoryCode} · ${row.parentName}`;
  }
  return row.parentName;
}

export const ENTITIES_TABLE_COLUMNS: EntitiesTableColumnDef[] = [
  {
    id: "category",
    label: "Category",
    getValue: (row) => formatNullable(row.categoryCode),
  },
  {
    id: "parent",
    label: "Parent",
    getValue: (row) => formatParent(row),
  },
  {
    id: "name",
    label: "Name",
    widthClass: "w-56 min-w-56 max-w-56",
    getValue: (row) => formatNullable(row.name),
  },
  {
    id: "staff",
    label: "Staff",
    align: "right",
    numeric: true,
    getValue: (row) => String(row.staffCount),
  },
  {
    id: "updated",
    label: "Updated",
    getValue: (row) => formatUpdatedAt(row.updatedAt),
  },
  {
    id: "actions",
    label: "Actions",
    align: "right",
    getValue: () => "",
  },
];
