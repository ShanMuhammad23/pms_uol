import { USER_ROLE_LABELS } from "@/types/users";
import type { UserRecord } from "@/types/users";

export type UsersTableColumnId =
  | "sapCode"
  | "employeeName"
  | "formAssignment"
  | "email"
  | "designation"
  | "roleCategory"
  | "orgLevel1"
  | "orgLevel2"
  | "dateOfJoining"
  | "systemRole"
  | "reportingHead"
  | "manager2"
  | "qualification"
  | "qualificationYear"
  | "qualificationSubject"
  | "qualificationInstitute"
  | "qualificationCountry"
  | "status"
  | "actions";

export type UsersTableColumnDef = {
  id: UsersTableColumnId;
  label: string;
  align?: "left" | "right" | "center";
  width?: number;
  /** Marks the column as numeric, enabling GT/LT range filtering. */
  numeric?: boolean;
  getValue: (row: UserRecord) => string;
};

function formatNullable(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

export function getUserOrgLevel1(user: UserRecord): string {
  return user.parentEntityName ?? user.entityName ?? "—";
}

export function getUserOrgLevel2(user: UserRecord): string {
  return user.parentEntityName ? (user.entityName ?? "—") : "—";
}

export const USERS_TABLE_COLUMNS: UsersTableColumnDef[] = [
  {
    id: "sapCode",
    label: "SAP Code",
    getValue: (row) => formatNullable(row.employeeId),
  },
  {
    id: "employeeName",
    label: "Employee Name",
    getValue: (row) => `${row.firstName} ${row.lastName}`.trim(),
  },
  {
    id: "formAssignment",
    label: "Form",
    align: "center",
    width: 80,
    getValue: (row) =>
      row.directScoreEntry
        ? "DS"
        : row.formAssigned
          ? row.selfAssessmentEnabled
            ? row.formCode || "✔"
            : "MA"
          : "✖",
  },
  {
    id: "email",
    label: "Email",
    getValue: (row) => formatNullable(row.email),
  },
  {
    id: "designation",
    label: "Designation",
    getValue: (row) => formatNullable(row.designation),
  },
  {
    id: "roleCategory",
    label: "Role Category",
    getValue: (row) => formatNullable(row.roleCategory),
  },
  {
    id: "orgLevel1",
    label: "ORG Level 1",
    getValue: (row) => getUserOrgLevel1(row),
  },
  {
    id: "orgLevel2",
    label: "ORG Level 2",
    getValue: (row) => getUserOrgLevel2(row),
  },
  {
    id: "dateOfJoining",
    label: "DOJ",
    getValue: (row) => formatDate(row.dateOfJoining),
  },
  {
    id: "systemRole",
    label: "System Role",
    getValue: (row) => USER_ROLE_LABELS[row.systemRole],
  },
  {
    id: "reportingHead",
    label: "Manager 1",
    getValue: (row) => formatNullable(row.headName),
  },
  {
    id: "manager2",
    label: "Manager 2",
    getValue: (row) => formatNullable(row.manager2Name),
  },
  {
    id: "qualification",
    label: "Qualification",
    getValue: (row) => formatNullable(row.qualification),
  },
  {
    id: "qualificationYear",
    label: "Year",
    align: "right",
    numeric: true,
    getValue: (row) => formatNullable(row.qualificationYear),
  },
  {
    id: "qualificationSubject",
    label: "Subject",
    getValue: (row) => formatNullable(row.qualificationSubject),
  },
  {
    id: "qualificationInstitute",
    label: "Institute",
    getValue: (row) => formatNullable(row.qualificationInstitute),
  },
  {
    id: "qualificationCountry",
    label: "Country",
    getValue: (row) => formatNullable(row.qualificationCountry),
  },
  {
    id: "status",
    label: "Status",
    getValue: (row) => (row.isActive ? "Active" : "Inactive"),
  },
  {
    id: "actions",
    label: "Actions",
    getValue: () => "",
  },
];

export const USERS_FILTERABLE_COLUMN_IDS = USERS_TABLE_COLUMNS.filter(
  (column) => column.id !== "actions" && column.id !== "email",
).map((column) => column.id);

export function getUsersColumnById(
  id: UsersTableColumnId,
): UsersTableColumnDef | undefined {
  return USERS_TABLE_COLUMNS.find((column) => column.id === id);
}
