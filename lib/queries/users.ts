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
  grade_group: string | null;
  date_of_joining: string | null;
  system_role: UserRecord["systemRole"];
  emp_category: UserRecord["empCategory"];
  emp_sub_category: UserRecord["empSubCategory"];
  staff_category_id: number | null;
  staff_category_name: string | null;
  staff_sub_category_id: number | null;
  staff_sub_category_name: string | null;
  entity_id: number | null;
  entity_name: string | null;
  parent_entity_name: string | null;
  department_id?: number | null;
  department_name?: string | null;
  head_id: string | null;
  head_name: string | null;
  qualification: string | null;
  qualification_year: string | null;
  qualification_subject: string | null;
  qualification_institute: string | null;
  qualification_country: string | null;
  is_active: boolean;
  created_at: string;
}

type UserOrgMode = "entity" | "department";
type UserStaffMode = "dynamic" | "legacy";

let cachedUserOrgMode: UserOrgMode | null = null;
let cachedUserStaffMode: UserStaffMode | null = null;
let cachedExcelColumns: boolean | null = null;
let cachedQualificationsTable: boolean | null = null;

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

async function getUserStaffMode(): Promise<UserStaffMode> {
  if (cachedUserStaffMode) {
    return cachedUserStaffMode;
  }

  const result = await db.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'staff_sub_category_id'
      ) AS exists
    `,
  );

  cachedUserStaffMode = result.rows[0]?.exists ? "dynamic" : "legacy";
  return cachedUserStaffMode;
}

function buildUserSelect(
  mode: UserOrgMode,
  staffMode: UserStaffMode,
  excelReady: boolean,
  qualsReady: boolean,
): string {
  const orgIdColumn = mode === "entity" ? "u.entity_id" : "u.department_id";
  const orgJoinTable = mode === "entity" ? "entities" : "departments";
  const parentEntityJoin =
    mode === "entity"
      ? "LEFT JOIN entities parent_ent ON parent_ent.id = org.parent_entity_id"
      : "";
  const staffSelect =
    staffMode === "dynamic"
      ? `u.staff_category_id,
         sc.name AS staff_category_name,
         u.staff_sub_category_id,
         ssc.name AS staff_sub_category_name`
      : `NULL::int AS staff_category_id,
         NULL::text AS staff_category_name,
         NULL::int AS staff_sub_category_id,
         NULL::text AS staff_sub_category_name`;
  const staffJoin =
    staffMode === "dynamic"
      ? `
    LEFT JOIN staff_categories sc ON sc.id = u.staff_category_id
    LEFT JOIN staff_sub_categories ssc ON ssc.id = u.staff_sub_category_id`
      : "";
  const excelSelect = excelReady
    ? `u.designation,
       u.role_category,
       u.grade_group,
       u.date_of_joining::text AS date_of_joining,`
    : `NULL::text AS designation,
       NULL::text AS role_category,
       NULL::text AS grade_group,
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
      ${staffSelect},
      ${orgIdColumn} AS entity_id,
      org.name AS entity_name,
      ${parentEntitySelect}
      u.head_id,
      CONCAT(h.first_name, ' ', h.last_name) AS head_name,
      ${qualSelect}
      u.is_active,
      u.created_at::text
    FROM users u
    ${staffJoin}
    LEFT JOIN ${orgJoinTable} org ON org.id = ${orgIdColumn}
    ${parentEntityJoin}
    LEFT JOIN users h ON h.id = u.head_id
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
    gradeGroup: row.grade_group,
    dateOfJoining: row.date_of_joining,
    systemRole: row.system_role,
    empCategory: row.emp_category,
    empSubCategory: row.emp_sub_category,
    staffCategoryId:
      row.staff_category_id != null ? Number(row.staff_category_id) : null,
    staffCategoryName: row.staff_category_name,
    staffSubCategoryId:
      row.staff_sub_category_id != null
        ? Number(row.staff_sub_category_id)
        : null,
    staffSubCategoryName: row.staff_sub_category_name,
    entityId: row.entity_id != null ? Number(row.entity_id) : null,
    entityName: row.entity_name,
    parentEntityName: row.parent_entity_name,
    headId: row.head_id ? Number(row.head_id) : null,
    headName: row.head_name,
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

async function assertValidHead(
  userId: number | null,
  headId: number | null,
): Promise<void> {
  if (headId === null) {
    return;
  }

  if (userId !== null && headId === userId) {
    throw new UserError("A user cannot be their own head.", 400);
  }

  const result = await db.query(`SELECT id FROM users WHERE id = $1`, [headId]);

  if (result.rows.length === 0) {
    throw new UserError("Head user not found.", 404);
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
  const [mode, staffMode, excelReady, qualsReady] = await Promise.all([
    getUserOrgMode(),
    getUserStaffMode(),
    hasExcelSheetColumns(),
    hasQualificationsTable(),
  ]);
  const result = await db.query<UserRow>(
    `${buildUserSelect(mode, staffMode, excelReady, qualsReady)}
     ORDER BY u.last_name ASC, u.first_name ASC`,
  );

  return result.rows.map(mapUserRow);
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const [mode, staffMode, excelReady, qualsReady] = await Promise.all([
    getUserOrgMode(),
    getUserStaffMode(),
    hasExcelSheetColumns(),
    hasQualificationsTable(),
  ]);
  const result = await db.query<UserRow>(
    `${buildUserSelect(mode, staffMode, excelReady, qualsReady)}
     WHERE u.id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapUserRow(result.rows[0]);
}

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const normalized = normalizeUserInput(input);
  const mode = await getUserOrgMode();
  const staffMode = await getUserStaffMode();

  await assertEntityExists(normalized.entityId);
  await assertValidHead(null, normalized.headId);

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
         ${staffMode === "dynamic" ? "staff_category_id," : ""}
         ${staffMode === "dynamic" ? "staff_sub_category_id," : ""}
         ${mode === "entity" ? "entity_id" : "department_id"},
         head_id,
         is_active
       )
       VALUES (${staffMode === "dynamic" ? "$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13" : "$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11"})
       RETURNING id`,
      staffMode === "dynamic"
        ? [
            normalized.employeeId,
            normalized.email,
            passwordHash,
            normalized.firstName,
            normalized.lastName,
            normalized.systemRole,
            normalized.empCategory,
            normalized.empSubCategory,
            normalized.staffCategoryId,
            normalized.staffSubCategoryId,
            normalized.entityId,
            normalized.headId,
            normalized.isActive,
          ]
        : [
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
          ? "Invalid entity or head reference."
          : "Invalid department or head reference.",
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
  const normalized = normalizeUserInput(input);
  const mode = await getUserOrgMode();
  const staffMode = await getUserStaffMode();

  await assertEntityExists(normalized.entityId);
  await assertValidHead(id, normalized.headId);

  const passwordHash = input.password
    ? await bcrypt.hash(input.password, 10)
    : null;

  try {
    const result = passwordHash
      ? await db.query(
          `UPDATE users
           SET employee_id = $1,
               email = $2,
               password_hash = $3,
               first_name = $4,
               last_name = $5,
               system_role = $6,
               emp_category = $7,
               emp_sub_category = $8,
               ${staffMode === "dynamic" ? "staff_category_id = $9," : ""}
               ${staffMode === "dynamic" ? "staff_sub_category_id = $10," : ""}
               ${mode === "entity" ? "entity_id" : "department_id"} = ${staffMode === "dynamic" ? "$11" : "$9"},
               head_id = ${staffMode === "dynamic" ? "$12" : "$10"},
               is_active = ${staffMode === "dynamic" ? "$13" : "$11"}
           WHERE id = ${staffMode === "dynamic" ? "$14" : "$12"}`,
          staffMode === "dynamic"
            ? [
                normalized.employeeId,
                normalized.email,
                passwordHash,
                normalized.firstName,
                normalized.lastName,
                normalized.systemRole,
                normalized.empCategory,
                normalized.empSubCategory,
                normalized.staffCategoryId,
                normalized.staffSubCategoryId,
                normalized.entityId,
                normalized.headId,
                normalized.isActive,
                id,
              ]
            : [
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
                normalized.isActive,
                id,
              ],
        )
      : await db.query(
          `UPDATE users
           SET employee_id = $1,
               email = $2,
               first_name = $3,
               last_name = $4,
               system_role = $5,
               emp_category = $6,
               emp_sub_category = $7,
               ${staffMode === "dynamic" ? "staff_category_id = $8," : ""}
               ${staffMode === "dynamic" ? "staff_sub_category_id = $9," : ""}
               ${mode === "entity" ? "entity_id" : "department_id"} = ${staffMode === "dynamic" ? "$10" : "$8"},
               head_id = ${staffMode === "dynamic" ? "$11" : "$9"},
               is_active = ${staffMode === "dynamic" ? "$12" : "$10"}
           WHERE id = ${staffMode === "dynamic" ? "$13" : "$11"}`,
          staffMode === "dynamic"
            ? [
                normalized.employeeId,
                normalized.email,
                normalized.firstName,
                normalized.lastName,
                normalized.systemRole,
                normalized.empCategory,
                normalized.empSubCategory,
                normalized.staffCategoryId,
                normalized.staffSubCategoryId,
                normalized.entityId,
                normalized.headId,
                normalized.isActive,
                id,
              ]
            : [
                normalized.employeeId,
                normalized.email,
                normalized.firstName,
                normalized.lastName,
                normalized.systemRole,
                normalized.empCategory,
                normalized.empSubCategory,
                normalized.entityId,
                normalized.headId,
                normalized.isActive,
                id,
              ],
        );

    if (result.rowCount === 0) {
      throw new UserError("User not found.", 404);
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
          ? "Invalid entity or head reference."
          : "Invalid department or head reference.",
        400,
      );
    }

    throw error;
  }
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
