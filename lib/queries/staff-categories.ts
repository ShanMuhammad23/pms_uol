import "server-only";

import { db } from "@/lib/db";
import type {
  CreateStaffCategoryInput,
  CreateStaffSubCategoryInput,
  StaffCategoryRecord,
  StaffCategoryWithSubCategories,
  StaffSubCategoryRecord,
  UpdateStaffCategoryInput,
  UpdateStaffSubCategoryInput,
} from "@/types/staff-categories";

export class StaffCategoryError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "StaffCategoryError";
  }
}

function isCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

function handleMissingTable(error: unknown): never {
  if (isCode(error, "42P01")) {
    throw new StaffCategoryError(
      "Staff category tables are missing. Please run the database migration for staff categories.",
      500,
    );
  }
  throw error;
}

export async function listStaffCategories(): Promise<StaffCategoryRecord[]> {
  try {
    const result = await db.query<{
      id: number;
      name: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, created_at::text, updated_at::text
       FROM staff_categories
       ORDER BY name ASC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    handleMissingTable(error);
  }
}

export async function listStaffSubCategories(): Promise<StaffSubCategoryRecord[]> {
  try {
    const result = await db.query<{
      id: number;
      name: string;
      staff_category_id: number;
      staff_category_name: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
         sc.id,
         sc.name,
         sc.staff_category_id,
         c.name AS staff_category_name,
         sc.created_at::text,
         sc.updated_at::text
       FROM staff_sub_categories sc
       JOIN staff_categories c ON c.id = sc.staff_category_id
       ORDER BY c.name ASC, sc.name ASC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      staffCategoryId: row.staff_category_id,
      staffCategoryName: row.staff_category_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    handleMissingTable(error);
  }
}

export async function listStaffCategoriesWithSubCategories(): Promise<StaffCategoryWithSubCategories[]> {
  const [categories, subCategories] = await Promise.all([
    listStaffCategories(),
    listStaffSubCategories(),
  ]);

  return categories.map((category) => ({
    ...category,
    subCategories: subCategories
      .filter((sub) => sub.staffCategoryId === category.id)
      .map((sub) => ({ id: sub.id, name: sub.name })),
  }));
}

export async function createStaffCategory(
  input: CreateStaffCategoryInput,
): Promise<StaffCategoryRecord> {
  try {
    const result = await db.query<{ id: number }>(
      `INSERT INTO staff_categories (name)
       VALUES ($1)
       RETURNING id`,
      [input.name.trim()],
    );

    const created = (await listStaffCategories()).find((c) => c.id === result.rows[0].id);
    if (!created) {
      throw new StaffCategoryError("Failed to load created category.", 500);
    }
    return created;
  } catch (error) {
    if (error instanceof StaffCategoryError) throw error;
    if (isCode(error, "23505")) {
      throw new StaffCategoryError("Category name already exists.", 409);
    }
    handleMissingTable(error);
  }
}

export async function updateStaffCategory(
  id: number,
  input: UpdateStaffCategoryInput,
): Promise<StaffCategoryRecord> {
  try {
    const result = await db.query(
      `UPDATE staff_categories
       SET name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [input.name.trim(), id],
    );
    if (result.rowCount === 0) {
      throw new StaffCategoryError("Category not found.", 404);
    }
    const updated = (await listStaffCategories()).find((c) => c.id === id);
    if (!updated) {
      throw new StaffCategoryError("Failed to load updated category.", 500);
    }
    return updated;
  } catch (error) {
    if (error instanceof StaffCategoryError) throw error;
    if (isCode(error, "23505")) {
      throw new StaffCategoryError("Category name already exists.", 409);
    }
    handleMissingTable(error);
  }
}

export async function deleteStaffCategory(id: number): Promise<void> {
  try {
    const result = await db.query(`DELETE FROM staff_categories WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      throw new StaffCategoryError("Category not found.", 404);
    }
  } catch (error) {
    if (error instanceof StaffCategoryError) throw error;
    if (isCode(error, "23503")) {
      throw new StaffCategoryError(
        "Cannot delete category because sub-categories or users are linked.",
        409,
      );
    }
    handleMissingTable(error);
  }
}

export async function createStaffSubCategory(
  input: CreateStaffSubCategoryInput,
): Promise<StaffSubCategoryRecord> {
  try {
    const result = await db.query<{ id: number }>(
      `INSERT INTO staff_sub_categories (name, staff_category_id)
       VALUES ($1, $2)
       RETURNING id`,
      [input.name.trim(), input.staffCategoryId],
    );
    const created = (await listStaffSubCategories()).find((s) => s.id === result.rows[0].id);
    if (!created) {
      throw new StaffCategoryError("Failed to load created sub-category.", 500);
    }
    return created;
  } catch (error) {
    if (error instanceof StaffCategoryError) throw error;
    if (isCode(error, "23505")) {
      throw new StaffCategoryError("Sub-category already exists for this category.", 409);
    }
    if (isCode(error, "23503")) {
      throw new StaffCategoryError("Invalid staff category reference.", 400);
    }
    handleMissingTable(error);
  }
}

export async function updateStaffSubCategory(
  id: number,
  input: UpdateStaffSubCategoryInput,
): Promise<StaffSubCategoryRecord> {
  try {
    const result = await db.query(
      `UPDATE staff_sub_categories
       SET name = $1, staff_category_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [input.name.trim(), input.staffCategoryId, id],
    );
    if (result.rowCount === 0) {
      throw new StaffCategoryError("Sub-category not found.", 404);
    }
    const updated = (await listStaffSubCategories()).find((s) => s.id === id);
    if (!updated) {
      throw new StaffCategoryError("Failed to load updated sub-category.", 500);
    }
    return updated;
  } catch (error) {
    if (error instanceof StaffCategoryError) throw error;
    if (isCode(error, "23505")) {
      throw new StaffCategoryError("Sub-category already exists for this category.", 409);
    }
    if (isCode(error, "23503")) {
      throw new StaffCategoryError("Invalid staff category reference.", 400);
    }
    handleMissingTable(error);
  }
}

export async function deleteStaffSubCategory(id: number): Promise<void> {
  try {
    const result = await db.query(`DELETE FROM staff_sub_categories WHERE id = $1`, [
      id,
    ]);
    if (result.rowCount === 0) {
      throw new StaffCategoryError("Sub-category not found.", 404);
    }
  } catch (error) {
    if (error instanceof StaffCategoryError) throw error;
    if (isCode(error, "23503")) {
      throw new StaffCategoryError("Cannot delete sub-category because users are linked.", 409);
    }
    handleMissingTable(error);
  }
}
