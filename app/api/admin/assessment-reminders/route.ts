import { NextResponse } from "next/server";
import { ROLE_PERMISSION_SETS } from "@/lib/auth/roles";
import { withAuth } from "@/lib/auth/with-auth";
import { apiHandler } from "@/lib/api-handler";
import {
  getAssessmentReminderTodayStats,
  listSentAssessmentReminders,
  type ReminderAudienceRole,
} from "@/lib/queries/assessment-reminders";

/**
 * SUPER_ADMIN only — list sent employee and manager assessment reminders.
 */
export const GET = withAuth(
  apiHandler(async (request: Request) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
      const pageSize = Math.min(
        Math.max(Number(searchParams.get("pageSize") ?? 50), 1),
        200,
      );
      const search = searchParams.get("search") ?? "";
      const roleParam = searchParams.get("role") ?? "ALL";

      const roles: ReminderAudienceRole[] | undefined =
        roleParam === "EMPLOYEE"
          ? ["EMPLOYEE"]
          : roleParam === "MANAGER"
            ? ["MANAGER"]
            : undefined;

      const [result, today] = await Promise.all([
        listSentAssessmentReminders({
          limit: pageSize,
          offset: (page - 1) * pageSize,
          search,
          roles,
        }),
        getAssessmentReminderTodayStats(),
      ]);

      return NextResponse.json({
        items: result.items,
        total: result.total,
        page,
        pageSize,
        today,
      });
    } catch (error) {
      console.error("Failed to list assessment reminders:", error);
      return NextResponse.json(
        {
          error:
            "Assessment reminders could not be loaded. Make sure reminder columns exist (run db migrations).",
        },
        { status: 500 },
      );
    }
  }),
  { roles: ROLE_PERMISSION_SETS.superAdminOnly },
);
