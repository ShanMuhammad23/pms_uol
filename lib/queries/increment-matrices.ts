import "server-only";

import type { PoolClient } from "pg";
import { db } from "../db";
import { getDbClient } from "@/lib/db-context";
import type { IncrementMatrixInput, PerformanceRating } from "@/types/forms";

interface IncrementMatrixRow {
  rating: PerformanceRating;
  quartile: number;
  recommended_increment_percentage: string;
}

function mapMatrixRow(row: IncrementMatrixRow): IncrementMatrixInput {
  return {
    rating: row.rating,
    quartile: row.quartile,
    recommendedIncrementPercentage: Number(row.recommended_increment_percentage),
  };
}

export async function getIncrementMatricesByCycleId(
  cycleId: number,
): Promise<IncrementMatrixInput[]> {
  const result = await getDbClient().query<IncrementMatrixRow>(
    `SELECT rating, quartile, recommended_increment_percentage
     FROM increment_matrices
     WHERE cycle_id = $1
     ORDER BY rating, quartile`,
    [cycleId],
  );

  return result.rows.map(mapMatrixRow);
}

export async function upsertIncrementMatrices(
  cycleId: number,
  matrices: IncrementMatrixInput[],
  client?: PoolClient,
): Promise<void> {
  const executor = client ?? getDbClient();

  await executor.query(`DELETE FROM increment_matrices WHERE cycle_id = $1`, [
    cycleId,
  ]);

  for (const entry of matrices) {
    await executor.query(
      `INSERT INTO increment_matrices (cycle_id, rating, quartile, recommended_increment_percentage)
       VALUES ($1, $2, $3, $4)`,
      [
        cycleId,
        entry.rating,
        entry.quartile,
        entry.recommendedIncrementPercentage,
      ],
    );
  }
}
