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
    widthClass: "w-[12%]",
    getValue: (row) => formatNullable(row.categoryCode),
  },
  {
    id: "parent",
    label: "Parent",
    widthClass: "w-[24%]",
    getValue: (row) => formatParent(row),
  },
  {
    id: "name",
    label: "Name",
    widthClass: "w-[26%]",
    getValue: (row) => formatNullable(row.name),
  },
  {
    id: "staff",
    label: "Staff",
    align: "right",
    numeric: true,
    widthClass: "w-[8%]",
    getValue: (row) => String(row.staffCount),
  },
  {
    id: "updated",
    label: "Updated",
    widthClass: "w-[18%]",
    getValue: (row) => formatUpdatedAt(row.updatedAt),
  },
  {
    id: "actions",
    label: "Actions",
    align: "right",
    widthClass: "w-[12%]",
    getValue: () => "",
  },
];
