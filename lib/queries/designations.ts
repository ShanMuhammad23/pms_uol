import "server-only";

import { db } from "@/lib/db";
import { getDbClient } from "@/lib/db-context";

async function hasDesignationColumn(): Promise<boolean> {
  const result = await getDbClient().query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'designation'
     ) AS exists`,
  );

  return Boolean(result.rows[0]?.exists);
}

export async function listUniqueDesignations(): Promise<string[]> {
  if (!(await hasDesignationColumn())) {
    return [];
  }

  const result = await getDbClient().query<{ designation: string }>(
    `
      SELECT DISTINCT TRIM(designation) AS designation
      FROM users
      WHERE designation IS NOT NULL
        AND TRIM(designation) <> ''
      ORDER BY designation ASC
    `,
  );

  return result.rows.map((row) => row.designation);
}
