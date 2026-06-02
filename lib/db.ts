import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __uolPmsPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

export const db =
  global.__uolPmsPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  global.__uolPmsPool = db;
}
