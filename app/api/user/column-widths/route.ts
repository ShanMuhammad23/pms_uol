import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { getDbClient } from "@/lib/db-context";
import { isHeadRole } from "@/lib/auth/home-path";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const VALID_TABLE_KEYS = new Set([
  "dashboard-staff-listing",
  "user-management",
  "reports-process-status",
]);

const MIN_WIDTH = 80;
const MAX_WIDTH = 600;

/**
 * Table keys where column management is restricted to admin roles
 * (HR / Board / Super Admin). Manager 1 / Manager 2 must not be able to
 * update column preferences for these tables — they always see a fixed
 * predefined layout. Even if the API is called manually, the request is
 * rejected.
 */
const COLUMN_MANAGEMENT_RESTRICTED_TABLE_KEYS = new Set([
  "dashboard-staff-listing",
]);

interface ColumnConfig {
  order: string[];
  visible: string[];
  frozen: string[];
  widths: Record<string, number>;
}

function sanitizeConfig(raw: unknown): ColumnConfig {
  const config: ColumnConfig = {
    order: [],
    visible: [],
    frozen: [],
    widths: {},
  };

  if (!raw || typeof raw !== "object") return config;
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.order)) {
    config.order = obj.order.filter(
      (v): v is string => typeof v === "string",
    );
  }
  if (Array.isArray(obj.visible)) {
    config.visible = obj.visible.filter(
      (v): v is string => typeof v === "string",
    );
  }
  if (Array.isArray(obj.frozen)) {
    config.frozen = obj.frozen.filter(
      (v): v is string => typeof v === "string",
    );
  }
  if (obj.widths && typeof obj.widths === "object") {
    for (const [key, value] of Object.entries(obj.widths as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        config.widths[key] = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(value)));
      }
    }
  }

  return config;
}

export const GET = apiHandler(async (request: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const { searchParams } = new URL(request.url);
  const tableKey = searchParams.get("tableKey");

  if (!tableKey || !VALID_TABLE_KEYS.has(tableKey)) {
    return NextResponse.json(
      { error: "Invalid or missing tableKey" },
      { status: 400 },
    );
  }

  const result = await getDbClient().query<{
    column_config: ColumnConfig;
  }>(
    `SELECT column_config FROM user_column_preferences
     WHERE user_id = $1 AND table_key = $2`,
    [userId, tableKey],
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ columnConfig: { order: [], visible: [], frozen: [], widths: {} } });
  }

  return NextResponse.json({ columnConfig: sanitizeConfig(result.rows[0].column_config) });
});

export const PUT = apiHandler(async (request: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const body = await request.json();
  const { tableKey, columnConfig } = body as {
    tableKey: string;
    columnConfig: unknown;
  };

  if (!tableKey || !VALID_TABLE_KEYS.has(tableKey)) {
    return NextResponse.json(
      { error: "Invalid or missing tableKey" },
      { status: 400 },
    );
  }

  // Reject column preference updates from Manager 1 / Manager 2 for tables
  // where column management is restricted to admin roles. Managers always
  // see a fixed predefined layout and must not be able to save preferences,
  // even if the API is called manually.
  if (
    COLUMN_MANAGEMENT_RESTRICTED_TABLE_KEYS.has(tableKey) &&
    isHeadRole(session.user.role)
  ) {
    return NextResponse.json(
      { error: "Forbidden: column management is not available for your role" },
      { status: 403 },
    );
  }

  const sanitized = sanitizeConfig(columnConfig);

  await getDbClient().query(
    `INSERT INTO user_column_preferences (user_id, table_key, column_config, updated_at)
     VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, table_key)
     DO UPDATE SET column_config = $3::jsonb, updated_at = CURRENT_TIMESTAMP`,
    [userId, tableKey, JSON.stringify(sanitized)],
  );

  return NextResponse.json({ success: true });
});
