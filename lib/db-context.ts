import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import type { PoolClient } from "pg";

import { db } from "@/lib/db";

/**
 * Request-scoped database connection context.
 *
 * Problem: Each `db.query()` call checks out a separate connection from the
 * pool. A single API request that makes 8 queries sequentially checks out 8
 * different connections. Under concurrent load this exhausts the pool.
 *
 * Solution: `withDb()` checks out ONE connection at the start of a request and
 * stores it in an AsyncLocalStorage context. All query functions within that
 * request call `getDbClient()` which returns the shared connection. The
 * connection is released back to the pool when the request completes.
 *
 * For functions that need an explicit transaction, `withTransaction()` wraps
 * BEGIN/COMMIT/ROLLBACK around a callback using the same shared connection.
 */

interface DbContext {
  client: PoolClient;
}

const dbAsyncStorage = new AsyncLocalStorage<DbContext>();

/**
 * Returns the request-scoped PoolClient if inside a `withDb()` call.
 * Falls back to the pool itself (`db`) when no context is active, so
 * standalone calls (e.g. from server components or scripts) still work.
 *
 * The returned object supports `.query()` in both cases.
 */
export function getDbClient(): PoolClient | typeof db {
  const ctx = dbAsyncStorage.getStore();
  if (ctx) {
    return ctx.client;
  }
  return db;
}

/**
 * Wraps an async handler with a single, shared database connection.
 *
 * One `PoolClient` is checked out and made available to all `getDbClient()`
 * calls within `fn`. The client is released when `fn` completes (or throws).
 *
 * Usage in a route handler:
 * ```ts
 * export async function GET() {
 *   return withDb(async () => {
 *     const result = await getDbClient().query("SELECT 1");
 *     return NextResponse.json(result.rows);
 *   });
 * }
 * ```
 */
export async function withDb<T>(fn: () => Promise<T>): Promise<T> {
  // If already inside a withDb() context, reuse it — never check out twice.
  const existing = dbAsyncStorage.getStore();
  if (existing) {
    return fn();
  }

  const client = await db.connect();
  try {
    return await dbAsyncStorage.run({ client }, fn);
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` inside a database transaction using the request-scoped connection
 * (or a fresh one if no context is active).
 *
 * Issues BEGIN, runs `fn`, and commits on success / rolls back on error.
 * The connection is NOT released here — `withDb()` owns the lifecycle.
 */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const client = getDbClient();
  // If we're using the pool directly (no context), we need our own client.
  if (client === db) {
    const ownClient = await db.connect();
    try {
      await ownClient.query("BEGIN");
      const result = await dbAsyncStorage.run({ client: ownClient }, fn);
      await ownClient.query("COMMIT");
      return result;
    } catch (error) {
      await ownClient.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      ownClient.release();
    }
  }

  // We have a request-scoped client — use it for the transaction.
  await client.query("BEGIN");
  try {
    const result = await fn();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
