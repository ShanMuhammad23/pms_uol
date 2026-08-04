import "server-only";

import bcrypt from "bcryptjs";
import { db } from "../db";
import type {
  CreateUserInput,
  EntityOptionRecord,
  UpdateUserInput,
  UserRecord,
} from "@/types/users";
import { normalizeUserInput } from "@/lib/validation/users";

interface UserRow {
  id: string;
  employee_id: string;
  email: string;
  first_name: string;
  last_name: string;
  designation: string | null;
  role_category: string | null;
  date_of_joining: string | null;
  system_role: UserRecord["systemRole"];
  emp_category: UserRecord["empCategory"];
  emp_sub_category: UserRecord["empSubCategory"];
  entity_id: number | null;
  entity_name: string | null;
  parent_entity_name: string | null;
  department_id?: number | null;
  department_name?: string | null;
  head_id: string | null;
  head_name: string | null;
  manager_2_id: string | null;
  manager_2_name: string | null;
  is_manager_eligible: boolean;
  qualification: string | null;
  qualification_year: string | null;
  qualification_subject: string | null;
  qualification_institute: string | null;
  qualification_country: string | null;
  is_active: boolean;
  created_at: string;
}

type UserOrgMode = "entity" | "department";

let cachedUserOrgMode: UserOrgMode | null = null;
let cachedExcelColumns: boolean | null = null;
let cachedQualificationsTable: boolean | null = null;
let manager2ColumnEnsured = false;
let managerEligibleColumnEnsured = false;

export async function ensureManager2Column(): Promise<void> {
  if (manager2ColumnEnsured) {
    return;
  }

  await db.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_2_id BIGINT REFERENCES users(id) ON DELETE SET NULL`,
  );

  manager2ColumnEnsured = true;
}

export async function ensureManagerEligibleColumn(): Promise<void> {
  if (managerEligibleColumnEnsured) {
    return;
  }

  await db.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_manager_eligible BOOLEAN NOT NULL DEFAULT FALSE`,
  );

  managerEligibleColumnEnsured = true;
}

async function hasExcelSheetColumns(): Promise<boolean> {
  if (cachedExcelColumns !== null) {
    return cachedExcelColumns;
  }

  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'designation'
     ) AS exists`,
  );

  cachedExcelColumns = Boolean(result.rows[0]?.exists);
  return cachedExcelColumns;
}

async function hasQualificationsTable(): Promise<boolean> {
  if (cachedQualificationsTable !== null) {
    return cachedQualificationsTable;
  }

  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'employee_qualifications'
     ) AS exists`,
  );

  cachedQualificationsTable = Boolean(result.rows[0]?.exists);
  return cachedQualificationsTable;
}

async function getUserOrgMode(): Promise<UserOrgMode> {
  if (cachedUserOrgMode) {
    return cachedUserOrgMode;
  }

  const entityColumnResult = await db.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'entity_id'
      ) AS exists
    `,
  );

  cachedUserOrgMode = entityColumnResult.rows[0]?.exists
    ? "entity"
    : "department";

  return cachedUserOrgMode;
}

function buildUserSelect(
  mode: UserOrgMode,
  excelReady: boolean,
  qualsReady: boolean,
): string {
  const orgIdColumn = mode === "entity" ? "u.entity_id" : "u.department_id";
  const orgJoinTable = mode === "entity" ? "entities" : "departments";
  const parentEntityJoin =
    mode === "entity"
      ? "LEFT JOIN entities parent_ent ON parent_ent.id = org.parent_entity_id"
      : "";
  const excelSelect = excelReady
    ? `u.designation,
       u.role_category,
       u.date_of_joining::text AS date_of_joining,`
    : `NULL::text AS designation,
       NULL::text AS role_category,
       NULL::text AS date_of_joining,`;
  const qualSelect = qualsReady
    ? `qual.qualification,
       qual.year::text AS qualification_year,
       qual.subject AS qualification_subject,
       qual.institute AS qualification_institute,
       qual.country AS qualification_country,`
    : `NULL::text AS qualification,
       NULL::text AS qualification_year,
       NULL::text AS qualification_subject,
       NULL::text AS qualification_institute,
       NULL::text AS qualification_country,`;
  const qualJoin = qualsReady
    ? `
    LEFT JOIN LATERAL (
      SELECT eq.qualification, eq.year, eq.subject, eq.institute, eq.country
      FROM employee_qualifications eq
      WHERE eq.user_id = u.id
      ORDER BY eq.is_primary DESC, eq.year DESC NULLS LAST, eq.id DESC
      LIMIT 1
    ) qual ON TRUE`
    : "";
  const parentEntitySelect =
    mode === "entity" ? "parent_ent.name AS parent_entity_name," : "NULL::text AS parent_entity_name,";

  return `
    SELECT
      u.id,
      u.employee_id,
      u.email,
      u.first_name,
      u.last_name,
      ${excelSelect}
      u.system_role,
      u.emp_category,
      u.emp_sub_category,
      ${orgIdColumn} AS entity_id,
      org.name AS entity_name,
      ${parentEntitySelect}
      u.head_id,
      CONCAT(h.first_name, ' ', h.last_name) AS head_name,
      u.manager_2_id,
      CONCAT(m2.first_name, ' ', m2.last_name) AS manager_2_name,
      u.is_manager_eligible,
      ${qualSelect}
      u.is_active,
      u.created_at::text
    FROM users u
    LEFT JOIN ${orgJoinTable} org ON org.id = ${orgIdColumn}
    ${parentEntityJoin}
    LEFT JOIN users h ON h.id = u.head_id
    LEFT JOIN users m2 ON m2.id = u.manager_2_id
    ${qualJoin}
  `;
}

export class UserError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "UserError";
  }
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: Number(row.id),
    employeeId: row.employee_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    designation: row.designation,
    roleCategory: row.role_category,
    dateOfJoining: row.date_of_joining,
    systemRole: row.system_role,
    empCategory: row.emp_category,
    empSubCategory: row.emp_sub_category,
    entityId: row.entity_id != null ? Number(row.entity_id) : null,
    entityName: row.entity_name,
    parentEntityName: row.parent_entity_name,
    headId: row.head_id ? Number(row.head_id) : null,
    headName: row.head_name,
    manager2Id: row.manager_2_id ? Number(row.manager_2_id) : null,
    manager2Name: row.manager_2_name,
    isManagerEligible: row.is_manager_eligible,
    qualification: row.qualification,
    qualificationYear: row.qualification_year,
    qualificationSubject: row.qualification_subject,
    qualificationInstitute: row.qualification_institute,
    qualificationCountry: row.qualification_country,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}

async function assertEntityExists(entityId: number | null): Promise<void> {
  if (entityId === null) {
    return;
  }

  const mode = await getUserOrgMode();
  const sourceTable = mode === "entity" ? "entities" : "departments";
  const result = await db.query(`SELECT id FROM ${sourceTable} WHERE id = $1`, [
    entityId,
  ]);

  if (result.rows.length === 0) {
    throw new UserError(
      mode === "entity" ? "Entity not found." : "Department not found.",
      404,
    );
  }
}

async function assertValidManager(
  userId: number | null,
  managerId: number | null,
  label: string,
  previousManagerId?: number | null,
): Promise<void> {
  if (managerId === null) {
    return;
  }

  if (userId !== null && managerId === userId) {
    throw new UserError(`A user cannot be their own ${label}.`, 400);
  }

  // If the assignment is unchanged from the existing value, skip the
  // eligibility check so legacy assignments are preserved (requirement 6).
  const isUnchanged =
    previousManagerId !== undefined && managerId === previousManagerId;

  const result = await db.query<{ is_manager_eligible: boolean }>(
    `SELECT is_manager_eligible FROM users WHERE id = $1`,
    [managerId],
  );

  if (result.rows.length === 0) {
    throw new UserError(`${label} user not found.`, 404);
  }

  if (!isUnchanged && !result.rows[0].is_manager_eligible) {
    throw new UserError(
      `${label} is not designated as a manager. Set their Manager Role to "Yes" first.`,
      400,
    );
  }
}

async function assertValidManagers(
  userId: number | null,
  headId: number | null,
  manager2Id: number | null,
  previous?: { previousHeadId?: number | null; previousManager2Id?: number | null },
): Promise<void> {
  await assertValidManager(userId, headId, "Manager 1", previous?.previousHeadId);
  await assertValidManager(userId, manager2Id, "Manager 2", previous?.previousManager2Id);

  if (headId !== null && manager2Id !== null && headId === manager2Id) {
    throw new UserError("Manager 1 and Manager 2 cannot be the same person.", 400);
  }
}

/**
 * Returns users designated as manager-eligible (Manager Role = Yes).
 * Used as the single source of truth for populating Manager 1/2 dropdowns.
 */
export async function listEligibleManagers(): Promise<UserRecord[]> {
  await ensureManager2Column();
  await ensureManagerEligibleColumn();

  const [mode, excelReady] = await Promise.all([
    getUserOrgMode(),
    hasExcelSheetColumns(),
  ]);
  const result = await db.query<UserRow>(
    `${buildUserSelect(mode, excelReady, false)}
     WHERE u.is_manager_eligible = TRUE
     ORDER BY u.last_name ASC, u.first_name ASC`,
  );

  return result.rows.map(mapUserRow);
}

/**
 * Validates that a user is manager-eligible. Used by bulk update paths
 * where per-user "previous value" tracking is not feasible.
 */
export async function assertManagerEligible(
  managerId: number,
  label: string,
): Promise<void> {
  const result = await db.query<{ is_manager_eligible: boolean }>(
    `SELECT is_manager_eligible FROM users WHERE id = $1`,
    [managerId],
  );

  if (result.rows.length === 0) {
    throw new UserError(`${label} user not found.`, 404);
  }

  if (!result.rows[0].is_manager_eligible) {
    throw new UserError(
      `${label} is not designated as a manager. Set their Manager Role to "Yes" first.`,
      400,
    );
  }
}

export async function listEntitiesForUsers(): Promise<EntityOptionRecord[]> {
  const mode = await getUserOrgMode();
  const sourceTable = mode === "entity" ? "entities" : "departments";
  const result = await db.query<{ id: number; name: string }>(
    `SELECT id, name FROM ${sourceTable} ORDER BY name ASC`,
  );

  return result.rows;
}

export async function listUsers(): Promise<UserRecord[]> {
  await ensureManager2Column();
  await ensureManagerEligibleColumn();

  const [mode, excelReady, qualsReady] = await Promise.all([
    getUserOrgMode(),
    hasExcelSheetColumns(),
    hasQualificationsTable(),
  ]);
  const result = await db.query<UserRow>(
    `${buildUserSelect(mode, excelReady, qualsReady)}
     ORDER BY u.last_name ASC, u.first_name ASC`,
  );

  return result.rows.map(mapUserRow);
}

/**
 * Slim user rows for filter facets / head pickers (no qualifications join).
 */
export async function listUsersOverview(): Promise<UserRecord[]> {
  await ensureManager2Column();
  await ensureManagerEligibleColumn();

  const [mode, excelReady] = await Promise.all([
    getUserOrgMode(),
    hasExcelSheetColumns(),
  ]);
  const result = await db.query<UserRow>(
    `${buildUserSelect(mode, excelReady, false)}
     ORDER BY u.last_name ASC, u.first_name ASC`,
  );

  return result.rows.map(mapUserRow);
}

/** Full user rows for a page of employee IDs (preserves request order). */
export async function listUsersByEmployeeIds(
  employeeIds: string[],
): Promise<UserRecord[]> {
  if (employeeIds.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(employeeIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  await ensureManager2Column();
  await ensureManagerEligibleColumn();

  const [mode, excelReady, qualsReady] = await Promise.all([
    getUserOrgMode(),
    hasExcelSheetColumns(),
    hasQualificationsTable(),
  ]);
  const result = await db.query<UserRow>(
    `${buildUserSelect(mode, excelReady, qualsReady)}
     WHERE u.employee_id = ANY($1::text[])`,
    [uniqueIds],
  );

  const byEmployeeId = new Map(
    result.rows.map((row) => [row.employee_id, mapUserRow(row)]),
  );

  return uniqueIds
    .map((employeeId) => byEmployeeId.get(employeeId))
    .filter((user): user is UserRecord => user != null);
}


export async function getUserById(id: number): Promise<UserRecord | null> {
  await ensureManager2Column();
  await ensureManagerEligibleColumn();

  const [mode, excelReady, qualsReady] = await Promise.all([
    getUserOrgMode(),
    hasExcelSheetColumns(),
    hasQualificationsTable(),
  ]);
  const result = await db.query<UserRow>(
    `${buildUserSelect(mode, excelReady, qualsReady)}
     WHERE u.id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapUserRow(result.rows[0]);
}

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  await ensureManager2Column();
  await ensureManagerEligibleColumn();

  const normalized = normalizeUserInput(input);
  const mode = await getUserOrgMode();

  await assertEntityExists(normalized.entityId);
  await assertValidManagers(null, normalized.headId, normalized.manager2Id);

  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const result = await db.query<{ id: string }>(
      `INSERT INTO users (
         employee_id,
         email,
         password_hash,
         first_name,
         last_name,
         system_role,
         emp_category,
         emp_sub_category,
         ${mode === "entity" ? "entity_id" : "department_id"},
         head_id,
         manager_2_id,
         is_manager_eligible,
         is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        normalized.employeeId,
        normalized.email,
        passwordHash,
        normalized.firstName,
        normalized.lastName,
        normalized.systemRole,
        normalized.empCategory,
        normalized.empSubCategory,
        normalized.entityId,
        normalized.headId,
        normalized.manager2Id,
        normalized.isManagerEligible,
        normalized.isActive,
      ],
    );

    const created = await getUserById(Number(result.rows[0].id));

    if (!created) {
      throw new UserError("Failed to load created user.", 500);
    }

    return created;
  } catch (error) {
    if (error instanceof UserError) {
      throw error;
    }

    if (isUniqueViolation(error)) {
      throw new UserError("Employee ID or email already exists.", 409);
    }

    if (isForeignKeyViolation(error)) {
      throw new UserError(
        mode === "entity"
          ? "Invalid entity, head, or Manager 2 reference."
          : "Invalid department, head, or Manager 2 reference.",
        400,
      );
    }

    throw error;
  }
}

export async function updateUser(
  id: number,
  input: UpdateUserInput,
): Promise<UserRecord> {
  await ensureManager2Column();
  await ensureManagerEligibleColumn();

  const normalized = normalizeUserInput(input);
  const mode = await getUserOrgMode();
  const [excelReady, qualsReady] = await Promise.all([
    hasExcelSheetColumns(),
    hasQualificationsTable(),
  ]);

  // Load current user to allow unchanged manager assignments to persist
  // without triggering the new eligibility check (preserves existing data).
  const currentUser = await getUserById(id);
  if (!currentUser) {
    throw new UserError("User not found.", 404);
  }

  await assertEntityExists(normalized.entityId);
  await assertValidManagers(id, normalized.headId, normalized.manager2Id, {
    previousHeadId: currentUser.headId,
    previousManager2Id: currentUser.manager2Id,
  });

  const passwordHash = input.password
    ? await bcrypt.hash(input.password, 10)
    : null;

  const setClauses: string[] = [
    "employee_id = $1",
    "email = $2",
    "first_name = $3",
    "last_name = $4",
    "system_role = $5",
    "emp_category = $6",
    "emp_sub_category = $7",
  ];
  const values: unknown[] = [
    normalized.employeeId,
    normalized.email,
    normalized.firstName,
    normalized.lastName,
    normalized.systemRole,
    normalized.empCategory,
    normalized.empSubCategory,
  ];

  if (passwordHash) {
    values.push(passwordHash);
    setClauses.push(`password_hash = $${values.length}`);
  }

  values.push(normalized.entityId);
  setClauses.push(
    `${mode === "entity" ? "entity_id" : "department_id"} = $${values.length}`,
  );

  values.push(normalized.headId);
  setClauses.push(`head_id = $${values.length}`);

  values.push(normalized.manager2Id);
  setClauses.push(`manager_2_id = $${values.length}`);

  if (normalized.isManagerEligible !== undefined) {
    values.push(normalized.isManagerEligible);
    setClauses.push(`is_manager_eligible = $${values.length}`);
  }

  values.push(normalized.isActive);
  setClauses.push(`is_active = $${values.length}`);

  if (excelReady) {
    if (normalized.designation !== undefined) {
      values.push(normalized.designation);
      setClauses.push(`designation = $${values.length}`);
    }
    if (normalized.roleCategory !== undefined) {
      values.push(normalized.roleCategory);
      setClauses.push(`role_category = $${values.length}`);
    }
    if (normalized.dateOfJoining !== undefined) {
      values.push(normalized.dateOfJoining);
      setClauses.push(`date_of_joining = $${values.length}`);
    }
  }

  values.push(id);

  try {
    const result = await db.query(
      `UPDATE users
       SET ${setClauses.join(",\n           ")}
       WHERE id = $${values.length}`,
      values,
    );

    if (result.rowCount === 0) {
      throw new UserError("User not found.", 404);
    }

    if (qualsReady) {
      const hasQualificationUpdate =
        normalized.qualification !== undefined ||
        normalized.qualificationYear !== undefined ||
        normalized.qualificationSubject !== undefined ||
        normalized.qualificationInstitute !== undefined ||
        normalized.qualificationCountry !== undefined;

      if (hasQualificationUpdate) {
        await upsertPrimaryQualification(id, {
          qualification: normalized.qualification ?? null,
          year: normalized.qualificationYear ?? null,
          subject: normalized.qualificationSubject ?? null,
          institute: normalized.qualificationInstitute ?? null,
          country: normalized.qualificationCountry ?? null,
        });
      }
    }

    const updated = await getUserById(id);

    if (!updated) {
      throw new UserError("Failed to load updated user.", 500);
    }

    return updated;
  } catch (error) {
    if (error instanceof UserError) {
      throw error;
    }

    if (isUniqueViolation(error)) {
      throw new UserError("Employee ID or email already exists.", 409);
    }

    if (isForeignKeyViolation(error)) {
      throw new UserError(
        mode === "entity"
          ? "Invalid entity, head, or Manager 2 reference."
          : "Invalid department, head, or Manager 2 reference.",
        400,
      );
    }

    throw error;
  }
}

async function upsertPrimaryQualification(
  userId: number,
  data: {
    qualification: string | null;
    year: number | null;
    subject: string | null;
    institute: string | null;
    country: string | null;
  },
): Promise<void> {
  const allEmpty =
    !data.qualification &&
    data.year == null &&
    !data.subject &&
    !data.institute &&
    !data.country;

  const existing = await db.query<{ id: string }>(
    `SELECT id
     FROM employee_qualifications
     WHERE user_id = $1
     ORDER BY is_primary DESC, year DESC NULLS LAST, id DESC
     LIMIT 1`,
    [userId],
  );

  if (allEmpty) {
    if (existing.rows[0]) {
      await db.query(`DELETE FROM employee_qualifications WHERE id = $1`, [
        existing.rows[0].id,
      ]);
    }
    return;
  }

  if (!data.qualification) {
    throw new UserError("Qualification is required when saving qualification details.", 400);
  }

  if (existing.rows[0]) {
    await db.query(
      `UPDATE employee_qualifications
       SET qualification = $2,
           year = $3,
           subject = $4,
           institute = $5,
           country = $6,
           is_primary = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        existing.rows[0].id,
        data.qualification,
        data.year,
        data.subject,
        data.institute,
        data.country,
      ],
    );
    return;
  }

  await db.query(
    `INSERT INTO employee_qualifications (
       user_id,
       qualification,
       year,
       subject,
       institute,
       country,
       is_primary
     ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
    [
      userId,
      data.qualification,
      data.year,
      data.subject,
      data.institute,
      data.country,
    ],
  );
}

export async function deleteUser(id: number): Promise<void> {
  try {
    const result = await db.query(`DELETE FROM users WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
      throw new UserError("User not found.", 404);
    }
  } catch (error) {
    if (error instanceof UserError) {
      throw error;
    }

    if (isForeignKeyViolation(error)) {
      throw new UserError(
        "Cannot delete this user because they are referenced by other records. Deactivate the user instead.",
        409,
      );
    }

    throw error;
  }
}
