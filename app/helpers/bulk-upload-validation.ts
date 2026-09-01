import {
  isBulkUploadCreateField,
  isOrg2UnderOrg1,
  resolveEntityIdFromOrgLevels,
} from "@/app/helpers/bulk-upload-columns";
import { isManagerEligibleRole } from "@/app/helpers/manager-eligibility";
import { parseFlexibleDate } from "@/app/helpers/bulk-upload-excel";
import type { BulkUploadColumnId } from "@/app/helpers/bulk-upload-columns";
import type { EntityRecord } from "@/types/entities";
import type { CreateUserInput, UserRecord } from "@/types/users";
import { USER_ROLES } from "@/types/users";
import {
  CATEGORY_SUB_MAP,
  EMPLOYEE_CATEGORIES,
  type EmployeeCategory,
  type SubCategory,
} from "@/types/forms";

export const BULK_EDIT_MAX_EMPLOYEES = 500;
export const NEW_EMPLOYEE_PASSWORD_PREFIX = "Welcome@";

export type BulkUploadSheetRow = {
  rowKey: string;
  employeeId: string;
  employeeName: string;
  isNew: boolean;
  values: Record<BulkUploadColumnId, string>;
  original: Record<BulkUploadColumnId, string>;
};

export type BulkUploadIssue = {
  employeeId: string;
  employeeName: string;
  columnId?: BulkUploadColumnId;
  message: string;
};

export type BulkUploadSaveGroup = {
  employeeIds: string[];
  fields: Record<string, unknown>;
};

export type BulkUploadCreateDraft = {
  rowKey: string;
  input: CreateUserInput;
  templateId: number | null;
  assessmentEligibility: boolean;
};

export type BulkUploadCheckStepId =
  | "collect"
  | "constraints"
  | "duplicates"
  | "confirm";

export const BULK_UPLOAD_CHECK_STEPS: readonly {
  id: BulkUploadCheckStepId;
  title: string;
  description: string;
}[] = [
  {
    id: "collect",
    title: "Collecting changes",
    description: "Find dirty persistable cells, new employee rows, and group updates.",
  },
  {
    id: "constraints",
    title: "Value constraints",
    description: "Validate numbers, roles, org hierarchy, forms, and managers.",
  },
  {
    id: "duplicates",
    title: "Duplicate checks",
    description: "Catch duplicate SAP/email, self-managers, and reporting cycles.",
  },
  {
    id: "confirm",
    title: "Confirm save",
    description: "Review the summary, then write the changes.",
  },
];

export type BulkUploadCheckResult = {
  ok: boolean;
  issues: BulkUploadIssue[];
  changedRowCount: number;
  changedCellCount: number;
  createdCount: number;
  groups: BulkUploadSaveGroup[];
  creates: BulkUploadCreateDraft[];
};

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isIntegerString(raw: string): boolean {
  return /^-?\d+$/.test(raw.trim().replace(/,/g, "").replace(/\.0+$/, ""));
}

function effectiveValue(
  row: BulkUploadSheetRow,
  selectedColumnIds: Set<BulkUploadColumnId>,
  columnId: BulkUploadColumnId,
): string {
  if (row.isNew || selectedColumnIds.has(columnId)) return row.values[columnId];
  return row.original[columnId];
}

function isEmptyNewRow(row: BulkUploadSheetRow): boolean {
  if (!row.isNew) return false;
  return (
    !row.employeeId.trim() &&
    !row.employeeName.trim() &&
    !row.values.email.trim() &&
    !row.values.empCategory.trim() &&
    !row.values.empSubCategory.trim() &&
    !row.values.designation.trim() &&
    !row.values.orgLevel1.trim()
  );
}

function splitEmployeeName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function defaultNewEmployeePassword(employeeId: string): string {
  return `${NEW_EMPLOYEE_PASSWORD_PREFIX}${employeeId.trim()}`;
}

function changed(
  row: BulkUploadSheetRow,
  selectedColumnIds: Set<BulkUploadColumnId>,
  columnId: BulkUploadColumnId,
): boolean {
  if (row.isNew) return false;
  return selectedColumnIds.has(columnId) && row.values[columnId] !== row.original[columnId];
}

export function collectBulkUploadSaveGroups(
  rows: BulkUploadSheetRow[],
  selectedColumnIds: Set<BulkUploadColumnId>,
): { groups: BulkUploadSaveGroup[]; changedRowCount: number; changedCellCount: number } {
  const groups = new Map<string, BulkUploadSaveGroup>();
  let changedRowCount = 0;
  let changedCellCount = 0;

  for (const row of rows) {
    if (row.isNew) continue;
    const fields: Record<string, unknown> = {};
    const isChanged = (id: BulkUploadColumnId) => changed(row, selectedColumnIds, id);

    if (isChanged("employeeName")) {
      const { firstName, lastName } = splitEmployeeName(row.values.employeeName);
      fields.firstName = firstName;
      fields.lastName = lastName;
      changedCellCount += 1;
    }
    if (isChanged("email")) {
      fields.email = row.values.email.trim() || null;
      changedCellCount += 1;
    }
    if (isChanged("designation")) {
      fields.designation = row.values.designation.trim() || null;
      changedCellCount += 1;
    }
    if (isChanged("dateOfJoining")) {
      fields.dateOfJoining =
        parseFlexibleDate(row.values.dateOfJoining) ??
        (row.values.dateOfJoining.trim() || null);
      changedCellCount += 1;
    }
    if (isChanged("roleCategory")) {
      fields.roleCategory = row.values.roleCategory.trim() || null;
      changedCellCount += 1;
    }
    if (isChanged("qualification")) {
      fields.qualification = row.values.qualification.trim() || null;
      changedCellCount += 1;
    }
    if (isChanged("qualificationSubject")) {
      fields.qualificationSubject = row.values.qualificationSubject.trim() || null;
      changedCellCount += 1;
    }
    if (isChanged("qualificationInstitute")) {
      fields.qualificationInstitute = row.values.qualificationInstitute.trim() || null;
      changedCellCount += 1;
    }
    if (isChanged("qualificationCountry")) {
      fields.qualificationCountry = row.values.qualificationCountry.trim() || null;
      changedCellCount += 1;
    }
    if (isChanged("qualificationYear")) {
      fields.qualificationYear = parseOptionalNumber(row.values.qualificationYear);
      changedCellCount += 1;
    }
    if (isChanged("systemRole") && row.values.systemRole) {
      fields.systemRole = row.values.systemRole;
      changedCellCount += 1;
    }
    if (isChanged("assessmentEligibility")) {
      fields.assessmentEligibility = row.values.assessmentEligibility === "true";
      changedCellCount += 1;
    }
    if (isChanged("manager1")) {
      fields.manager1UserId = parseOptionalNumber(row.values.manager1);
      changedCellCount += 1;
    }
    if (isChanged("manager2")) {
      fields.manager2UserId = parseOptionalNumber(row.values.manager2);
      changedCellCount += 1;
    }
    if (isChanged("orgLevel1") || isChanged("orgLevel2")) {
      fields.entityId = resolveEntityIdFromOrgLevels(
        row.values.orgLevel1,
        row.values.orgLevel2,
      );
      changedCellCount += isChanged("orgLevel1") && isChanged("orgLevel2") ? 2 : 1;
    }
    if (isChanged("formAssignment")) {
      fields.templateId = parseOptionalNumber(row.values.formAssignment);
      changedCellCount += 1;
    }
    if (isChanged("creditHrsErpAdj")) {
      fields.creditHrsErpScoreAdj = parseOptionalNumber(row.values.creditHrsErpAdj);
      changedCellCount += 1;
    }
    if (isChanged("pubOricScoreAdj")) {
      fields.pubOricScoreAdj = parseOptionalNumber(row.values.pubOricScoreAdj);
      changedCellCount += 1;
    }
    if (isChanged("qecScoreAdj")) {
      fields.qecScoreAdj = parseOptionalNumber(row.values.qecScoreAdj);
      changedCellCount += 1;
    }
    if (isChanged("currentSalary")) {
      fields.currentSalary = parseOptionalNumber(row.values.currentSalary);
      changedCellCount += 1;
    }
    if (isChanged("previousSalary")) {
      fields.previousSalary = parseOptionalNumber(row.values.previousSalary);
      changedCellCount += 1;
    }
    if (isChanged("remarksCompensation")) {
      fields.remarksCompensation = row.values.remarksCompensation.trim() || null;
      changedCellCount += 1;
    }
    if (isChanged("calibrationFactor")) {
      fields.calibrationFactor = parseOptionalNumber(row.values.calibrationFactor);
      changedCellCount += 1;
    }

    if (Object.keys(fields).length === 0) continue;
    changedRowCount += 1;
    const key = JSON.stringify(fields);
    const group = groups.get(key);
    if (group) group.employeeIds.push(row.employeeId);
    else groups.set(key, { employeeIds: [row.employeeId], fields });
  }

  return {
    groups: [...groups.values()],
    changedRowCount,
    changedCellCount,
  };
}

export function collectBulkUploadCreates(
  rows: BulkUploadSheetRow[],
): BulkUploadCreateDraft[] {
  const creates: BulkUploadCreateDraft[] = [];

  for (const row of rows) {
    if (!row.isNew || isEmptyNewRow(row)) continue;
    const sap = row.employeeId.trim();
    const { firstName, lastName } = splitEmployeeName(row.employeeName);
    const doj = row.values.dateOfJoining.trim();
    const templateId = parseOptionalNumber(row.values.formAssignment);

    creates.push({
      rowKey: row.rowKey,
      input: {
        employeeId: sap,
        email: row.values.email.trim(),
        password: defaultNewEmployeePassword(sap),
        firstName,
        lastName,
        designation: row.values.designation.trim() || null,
        roleCategory: row.values.roleCategory.trim() || null,
        dateOfJoining: doj || null,
        systemRole: (row.values.systemRole.trim() || "EMPLOYEE") as CreateUserInput["systemRole"],
        empCategory: row.values.empCategory.trim(),
        empSubCategory: row.values.empSubCategory.trim(),
        entityId: resolveEntityIdFromOrgLevels(row.values.orgLevel1, row.values.orgLevel2),
        headId: parseOptionalNumber(row.values.manager1),
        manager2Id: parseOptionalNumber(row.values.manager2),
        qualification: row.values.qualification.trim() || null,
        qualificationYear: parseOptionalNumber(row.values.qualificationYear),
        qualificationSubject: row.values.qualificationSubject.trim() || null,
        qualificationInstitute: row.values.qualificationInstitute.trim() || null,
        qualificationCountry: row.values.qualificationCountry.trim() || null,
        isActive: row.values.accountStatus.trim() !== "Inactive",
      },
      templateId,
      assessmentEligibility: row.values.assessmentEligibility !== "false",
    });
  }

  return creates;
}

function issue(
  row: BulkUploadSheetRow,
  message: string,
  columnId?: BulkUploadColumnId,
): BulkUploadIssue {
  return {
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    columnId,
    message,
  };
}

function appliesToRow(
  row: BulkUploadSheetRow,
  selectedColumnIds: Set<BulkUploadColumnId>,
  columnId: BulkUploadColumnId,
): boolean {
  if (isEmptyNewRow(row)) return false;
  if (row.isNew) return isBulkUploadCreateField(columnId);
  return changed(row, selectedColumnIds, columnId);
}

function checkNumberField(
  row: BulkUploadSheetRow,
  selectedColumnIds: Set<BulkUploadColumnId>,
  columnId: BulkUploadColumnId,
  label: string,
  options?: { integer?: boolean; min?: number; max?: number },
): BulkUploadIssue | null {
  if (!appliesToRow(row, selectedColumnIds, columnId)) return null;
  const raw = row.values[columnId].trim().replace(/,/g, "").replace(/\.0+$/, "");
  if (!raw) return null;
  if (options?.integer && !isIntegerString(raw)) {
    return issue(row, `${label} must be a whole number.`, columnId);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return issue(row, `${label} must be a valid number.`, columnId);
  }
  if (options?.min != null && parsed < options.min) {
    return issue(row, `${label} must be at least ${options.min}.`, columnId);
  }
  if (options?.max != null && parsed > options.max) {
    return issue(row, `${label} must be at most ${options.max}.`, columnId);
  }
  return null;
}

export function checkValueConstraints(
  rows: BulkUploadSheetRow[],
  selectedColumnIds: Set<BulkUploadColumnId>,
  context: {
    users: UserRecord[];
    entities: EntityRecord[];
    formTemplateIds: Set<string>;
  },
): BulkUploadIssue[] {
  const issues: BulkUploadIssue[] = [];
  const usersById = new Map(context.users.map((user) => [String(user.id), user]));
  const currentYear = new Date().getFullYear();

  for (const row of rows) {
    if (isEmptyNewRow(row)) continue;

    if (row.isNew) {
      if (!row.employeeId.trim()) {
        issues.push(issue(row, "SAP Code is required for new employees."));
      } else if (row.employeeId.trim().length > 30) {
        issues.push(issue(row, "SAP Code must be 30 characters or fewer."));
      }
      const { firstName, lastName } = splitEmployeeName(row.employeeName);
      if (!firstName || !lastName) {
        issues.push(
          issue(row, "Employee name must include first and last name.", "employeeName"),
        );
      }
      const email = row.values.email.trim();
      if (!email) {
        issues.push(issue(row, "Email is required for new employees.", "email"));
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        issues.push(issue(row, "Enter a valid email address.", "email"));
      }
      const category = row.values.empCategory.trim();
      const subCategory = row.values.empSubCategory.trim();
      if (!EMPLOYEE_CATEGORIES.includes(category as EmployeeCategory)) {
        issues.push(issue(row, "A valid employee category is required.", "empCategory"));
      } else if (
        !CATEGORY_SUB_MAP[category as EmployeeCategory].includes(subCategory as SubCategory)
      ) {
        issues.push(
          issue(row, "Sub-category must match the selected employee category.", "empSubCategory"),
        );
      }
      const role = row.values.systemRole.trim() || "EMPLOYEE";
      if (!USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
        issues.push(issue(row, "A valid system role is required.", "systemRole"));
      }
      const doj = row.values.dateOfJoining.trim();
      if (doj && !parseFlexibleDate(doj) && Number.isNaN(Date.parse(doj))) {
        issues.push(issue(row, "Date of joining must be a valid date.", "dateOfJoining"));
      }
    }

    if (appliesToRow(row, selectedColumnIds, "employeeName") && !row.isNew) {
      const { firstName, lastName } = splitEmployeeName(row.values.employeeName);
      if (!firstName) {
        issues.push(issue(row, "Name is required.", "employeeName"));
      } else if (firstName.length > 50 || lastName.length > 50) {
        issues.push(
          issue(row, "First and last name must be 50 characters or fewer.", "employeeName"),
        );
      }
    }

    if (appliesToRow(row, selectedColumnIds, "email") && !row.isNew) {
      const email = row.values.email.trim();
      if (!email) {
        issues.push(issue(row, "Email is required.", "email"));
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        issues.push(issue(row, "Enter a valid email address.", "email"));
      } else if (email.length > 150) {
        issues.push(issue(row, "Email must be 150 characters or fewer.", "email"));
      }
    }

    if (appliesToRow(row, selectedColumnIds, "dateOfJoining") && !row.isNew) {
      const doj = row.values.dateOfJoining.trim();
      if (doj && !parseFlexibleDate(doj)) {
        issues.push(issue(row, "Date of joining must be a valid date.", "dateOfJoining"));
      }
    }

    const yearIssue = checkNumberField(
      row,
      selectedColumnIds,
      "qualificationYear",
      "Year",
      { integer: true, min: 1900, max: currentYear + 1 },
    );
    if (yearIssue) issues.push(yearIssue);

    for (const [columnId, label] of [
      ["creditHrsErpAdj", "CH adjustment"],
      ["pubOricScoreAdj", "ORIC adj"],
      ["qecScoreAdj", "QEC adjust"],
      ["currentSalary", "Current Salary"],
      ["previousSalary", "Prev Salary"],
    ] as const) {
      const adjIssue = checkNumberField(row, selectedColumnIds, columnId, label);
      if (adjIssue) issues.push(adjIssue);
    }

    const calIssue = checkNumberField(
      row,
      selectedColumnIds,
      "calibrationFactor",
      "Cal. Fr",
      { min: 0 },
    );
    if (calIssue) issues.push(calIssue);

    if (appliesToRow(row, selectedColumnIds, "systemRole") && !row.isNew) {
      const role = row.values.systemRole.trim();
      if (role && !USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
        issues.push(issue(row, "System Role is not a valid role.", "systemRole"));
      }
    }

    if (
      appliesToRow(row, selectedColumnIds, "orgLevel1") ||
      appliesToRow(row, selectedColumnIds, "orgLevel2")
    ) {
      const org1 = row.values.orgLevel1.trim();
      const org2 = row.values.orgLevel2.trim();
      if (org2 && !org1) {
        issues.push(issue(row, "ORG Level 1 is required when ORG Level 2 is set.", "orgLevel1"));
      } else if (org1 && org2 && !isOrg2UnderOrg1(org2, org1, context.entities)) {
        issues.push(
          issue(row, "ORG Level 2 must belong under the selected ORG Level 1.", "orgLevel2"),
        );
      }
    }

    if (appliesToRow(row, selectedColumnIds, "formAssignment")) {
      const templateId = row.values.formAssignment.trim();
      if (templateId && !context.formTemplateIds.has(templateId)) {
        issues.push(issue(row, "Form template was not found.", "formAssignment"));
      }
    }

    for (const columnId of ["manager1", "manager2"] as const) {
      if (!appliesToRow(row, selectedColumnIds, columnId)) continue;
      const raw = row.values[columnId].trim();
      if (!raw) continue;
      const manager = usersById.get(raw);
      const label = columnId === "manager1" ? "Manager 1" : "Manager 2";
      if (!manager) {
        issues.push(issue(row, `${label} is not a valid user.`, columnId));
        continue;
      }
      const unchangedAssignment = raw === row.original[columnId];
      if (!unchangedAssignment && !isManagerEligibleRole(manager.systemRole)) {
        issues.push(
          issue(
            row,
            `${label} must have a System Role of Manager, HR, Board, or Super Admin.`,
            columnId,
          ),
        );
      }
    }
  }

  return issues;
}

export function checkDuplicates(
  rows: BulkUploadSheetRow[],
  selectedColumnIds: Set<BulkUploadColumnId>,
  users: UserRecord[],
): BulkUploadIssue[] {
  const issues: BulkUploadIssue[] = [];
  const usersByEmployeeId = new Map(users.map((user) => [user.employeeId, user]));
  const usersById = new Map(users.map((user) => [String(user.id), user]));
  const usersByEmail = new Map(
    users.map((user) => [user.email.trim().toLowerCase(), user] as const),
  );

  const seenEmployeeIds = new Set<string>();
  const seenEmails = new Set<string>();
  for (const row of rows) {
    if (isEmptyNewRow(row)) continue;
    const sap = row.employeeId.trim();
    if (sap) {
      if (seenEmployeeIds.has(sap)) {
        issues.push(issue(row, "This SAP Code appears more than once in the sheet."));
      }
      seenEmployeeIds.add(sap);
      if (row.isNew && usersByEmployeeId.has(sap)) {
        issues.push(issue(row, "This SAP Code already exists."));
      }
    }
    const email = row.values.email.trim().toLowerCase();
    if (email && (row.isNew || appliesToRow(row, selectedColumnIds, "email"))) {
      if (seenEmails.has(email)) {
        issues.push(issue(row, "This email already exists.", "email"));
      } else {
        seenEmails.add(email);
        const owner = usersByEmail.get(email);
        if (owner && owner.employeeId !== sap) {
          issues.push(issue(row, "This email already exists.", "email"));
        }
      }
    }
  }

  const resultingManager1 = new Map<number, number | null>();
  const resultingManager2 = new Map<number, number | null>();
  const resultingRole = new Map<number, string>();

  for (const user of users) {
    resultingManager1.set(user.id, user.headId);
    resultingManager2.set(user.id, user.manager2Id);
    resultingRole.set(user.id, user.systemRole);
  }

  for (const row of rows) {
    if (isEmptyNewRow(row)) continue;
    const employee = usersByEmployeeId.get(row.employeeId);

    const m1Raw = effectiveValue(row, selectedColumnIds, "manager1").trim();
    const m2Raw = effectiveValue(row, selectedColumnIds, "manager2").trim();
    const m1 = m1Raw ? Number(m1Raw) : null;
    const m2 = m2Raw ? Number(m2Raw) : null;

    if (employee && m1 != null && Number.isFinite(m1) && m1 === employee.id) {
      issues.push(issue(row, "A user cannot be their own Manager 1.", "manager1"));
    }
    if (employee && m2 != null && Number.isFinite(m2) && m2 === employee.id) {
      issues.push(issue(row, "A user cannot be their own Manager 2.", "manager2"));
    }
    if (m1 != null && m2 != null && Number.isFinite(m1) && Number.isFinite(m2) && m1 === m2) {
      issues.push(
        issue(row, "Manager 1 and Manager 2 cannot be the same person.", "manager2"),
      );
    }

    if (!employee) continue;

    resultingManager1.set(employee.id, Number.isFinite(m1) ? m1 : null);
    resultingManager2.set(employee.id, Number.isFinite(m2) ? m2 : null);

    if (selectedColumnIds.has("systemRole") && row.values.systemRole.trim()) {
      resultingRole.set(employee.id, row.values.systemRole.trim());
    }
  }

  for (const row of rows) {
    const employee = usersByEmployeeId.get(row.employeeId);
    if (!employee) continue;
    if (!changed(row, selectedColumnIds, "systemRole")) continue;
    const nextRole = row.values.systemRole.trim();
    if (!nextRole || isManagerEligibleRole(nextRole)) continue;

    const managesSomeone = [...resultingManager1.entries(), ...resultingManager2.entries()].some(
      ([, managerId]) => managerId === employee.id,
    );
    if (managesSomeone) {
      issues.push(
        issue(
          row,
          "Cannot set System Role to Employee while this person is assigned as Manager 1 or Manager 2.",
          "systemRole",
        ),
      );
    }
  }

  for (const row of rows) {
    const employee = usersByEmployeeId.get(row.employeeId);
    if (!employee) continue;
    if (!changed(row, selectedColumnIds, "manager1") && !changed(row, selectedColumnIds, "manager2")) {
      continue;
    }

    const m1 = resultingManager1.get(employee.id) ?? null;
    if (m1 == null) continue;
    const reportsBack =
      resultingManager1.get(m1) === employee.id || resultingManager2.get(m1) === employee.id;
    if (reportsBack) {
      const other = usersById.get(String(m1));
      const otherLabel = other
        ? `${other.firstName} ${other.lastName} (${other.employeeId})`
        : `user ${m1}`;
      issues.push(
        issue(
          row,
          `Circular reporting: ${otherLabel} already reports to this employee.`,
          "manager1",
        ),
      );
    }
  }

  return issues;
}

export function validateBulkUploadChanges(
  rows: BulkUploadSheetRow[],
  selectedColumnIds: Set<BulkUploadColumnId>,
  context: {
    users: UserRecord[];
    entities: EntityRecord[];
    formTemplateIds: Set<string>;
  },
): BulkUploadCheckResult {
  const collected = collectBulkUploadSaveGroups(rows, selectedColumnIds);
  const creates = collectBulkUploadCreates(rows);
  if (collected.changedRowCount === 0 && creates.length === 0) {
    return {
      ok: false,
      issues: [
        {
          employeeId: "",
          employeeName: "",
          message: "No cell values have changed and no new employees were added.",
        },
      ],
      createdCount: 0,
      creates: [],
      ...collected,
    };
  }

  const constraintIssues = checkValueConstraints(rows, selectedColumnIds, context);
  const duplicateIssues = checkDuplicates(rows, selectedColumnIds, context.users);
  const issues = [...constraintIssues, ...duplicateIssues];

  return {
    ok: issues.length === 0,
    issues,
    createdCount: creates.length,
    creates,
    ...collected,
  };
}

export function chunkSaveGroups(
  groups: BulkUploadSaveGroup[],
  maxSize = BULK_EDIT_MAX_EMPLOYEES,
): BulkUploadSaveGroup[] {
  const chunked: BulkUploadSaveGroup[] = [];
  for (const group of groups) {
    if (group.employeeIds.length <= maxSize) {
      chunked.push(group);
      continue;
    }
    for (let index = 0; index < group.employeeIds.length; index += maxSize) {
      chunked.push({
        employeeIds: group.employeeIds.slice(index, index + maxSize),
        fields: group.fields,
      });
    }
  }
  return chunked;
}
