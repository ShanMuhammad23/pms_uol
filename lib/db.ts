import { Pool } from "pg";

declare global {
  var __uolPmsPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

function resolvePoolMax(): number {
  const parsed = Number(process.env.PG_POOL_MAX ?? 20);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 20;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString,
    max: resolvePoolMax(),
    // Drop idle clients before NAT/firewalls/Postgres silently kill them.
    // Dead sockets otherwise hang the first query for ~30–90s (TCP timeout).
    idleTimeoutMillis: 30_000,
    // Fail fast when the pool cannot hand out a client.
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  pool.on("error", (err) => {
    // Idle clients can error after server-side disconnect; without a listener
    // this becomes an uncaughtException and can take the process down.
    console.error("[db] Unexpected idle client error:", err);
  });

  return pool;
}

export const db = global.__uolPmsPool ?? createPool();

// Always pin on globalThis. Next may evaluate this module more than once;
// without this, production can open multiple pools and exhaust Postgres
// even with a handful of users.
global.__uolPmsPool = db;
