import "server-only";

import bcrypt from "bcryptjs";
import { db } from "../db";
import type {
  CreateUserInput,
  DepartmentRecord,
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
  system_role: UserRecord["systemRole"];
  emp_category: UserRecord["empCategory"];
  emp_sub_category: UserRecord["empSubCategory"];
  department_id: number | null;
  department_name: string | null;
  head_id: string | null;
  head_name: string | null;
  is_active: boolean;
  created_at: string;
}

const USER_SELECT = `
  SELECT
    u.id,
    u.employee_id,
    u.email,
    u.first_name,
    u.last_name,
    u.system_role,
    u.emp_category,
    u.emp_sub_category,
    u.department_id,
    d.name AS department_name,
    u.head_id,
    CONCAT(h.first_name, ' ', h.last_name) AS head_name,
    u.is_active,
    u.created_at::text
  FROM users u
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN users h ON h.id = u.head_id
`;

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
    systemRole: row.system_role,
    empCategory: row.emp_category,
    empSubCategory: row.emp_sub_category,
    departmentId: row.department_id,
    departmentName: row.department_name,
    headId: row.head_id ? Number(row.head_id) : null,
    headName: row.head_name,
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

async function assertDepartmentExists(departmentId: number | null): Promise<void> {
  if (departmentId === null) {
    return;
  }

  const result = await db.query(`SELECT id FROM departments WHERE id = $1`, [
    departmentId,
  ]);

  if (result.rows.length === 0) {
    throw new UserError("Department not found.", 404);
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

export async function listDepartments(): Promise<DepartmentRecord[]> {
  const result = await db.query<{ id: number; name: string }>(
    `SELECT id, name FROM departments ORDER BY name ASC`,
  );

  return result.rows;
}

export async function listUsers(): Promise<UserRecord[]> {
  const result = await db.query<UserRow>(
    `${USER_SELECT}
     ORDER BY u.last_name ASC, u.first_name ASC`,
  );

  return result.rows.map(mapUserRow);
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const result = await db.query<UserRow>(
    `${USER_SELECT}
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

  await assertDepartmentExists(normalized.departmentId);
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
         department_id,
         head_id,
         is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        normalized.departmentId,
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
      throw new UserError("Invalid department or head reference.", 400);
    }

    throw error;
  }
}

export async function updateUser(
  id: number,
  input: UpdateUserInput,
): Promise<UserRecord> {
  const normalized = normalizeUserInput(input);

  await assertDepartmentExists(normalized.departmentId);
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
               department_id = $9,
               head_id = $10,
               is_active = $11
           WHERE id = $12`,
          [
            normalized.employeeId,
            normalized.email,
            passwordHash,
            normalized.firstName,
            normalized.lastName,
            normalized.systemRole,
            normalized.empCategory,
            normalized.empSubCategory,
            normalized.departmentId,
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
               department_id = $8,
               head_id = $9,
               is_active = $10
           WHERE id = $11`,
          [
            normalized.employeeId,
            normalized.email,
            normalized.firstName,
            normalized.lastName,
            normalized.systemRole,
            normalized.empCategory,
            normalized.empSubCategory,
            normalized.departmentId,
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
      throw new UserError("Invalid department or head reference.", 400);
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
