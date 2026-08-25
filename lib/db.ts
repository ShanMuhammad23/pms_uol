import { Pool } from "pg";

declare global {
  var __uolPmsPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

// Pool configuration tuned for a serverless / Next.js environment.
// - max: limits concurrent connections to Postgres (default is 10).
// - idleTimeoutMillis: reclaim idle connections after 30s.
// - connectionTimeoutMillis: fail fast if the pool is exhausted.
// - statement_timeout: abort any single query that runs longer than 30s
//   so a slow query can't hold a connection indefinitely.
const poolConfig = {
  connectionString,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
};

export const db =
  global.__uolPmsPool ??
  new Pool(poolConfig);

if (process.env.NODE_ENV !== "production") {
  global.__uolPmsPool = db;
}
