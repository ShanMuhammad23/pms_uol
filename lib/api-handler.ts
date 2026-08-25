import "server-only";

import { withDb } from "@/lib/db-context";

/**
 * Wraps an API route handler with a shared database connection.
 *
 * Each API request checks out ONE connection from the pool and makes it
 * available to all `getDbClient()` calls within the handler. The connection
 * is released when the handler completes (or throws).
 *
 * Usage:
 * ```ts
 * export const GET = apiHandler(async (request: Request) => {
 *   const result = await getDbClient().query("SELECT 1");
 *   return NextResponse.json(result.rows);
 * });
 * ```
 *
 * For handlers with route context params:
 * ```ts
 * export const GET = apiHandler(async (request: Request, context: RouteContext) => {
 *   const { id } = await context.params;
 *   ...
 * });
 * ```
 */
export function apiHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    return withDb(() => handler(...args));
  };
}
