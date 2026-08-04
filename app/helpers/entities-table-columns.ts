import type { EntityRecord } from "@/types/entities";

export type EntitiesTableColumnId =
  | "name"
  | "category"
  | "parent"
  | "staff"
  | "updated"
  | "actions";

export type EntitiesTableColumnDef = {
  id: EntitiesTableColumnId;
  label: string;
  align?: "left" | "right" | "center";
  /** Marks the column as numeric, enabling GT/LT range filtering. */
  numeric?: boolean;
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

export const ENTITIES_TABLE_COLUMNS: EntitiesTableColumnDef[] = [
  {
    id: "name",
    label: "Name",
    getValue: (row) => formatNullable(row.name),
  },
  {
    id: "category",
    label: "Category",
    getValue: (row) => formatNullable(row.categoryCode),
  },
  {
    id: "parent",
    label: "Parent",
    getValue: (row) => formatNullable(row.parentName),
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
