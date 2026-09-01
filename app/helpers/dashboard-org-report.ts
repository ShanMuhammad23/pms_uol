import { EMPTY_MASTER_FILTER_STATE } from "@/app/helpers/dashboard-master-filters";
import {
  isHrAlignmentAligned,
  isSubmissionEligible,
} from "@/app/helpers/dashboard-workflow-stats";
import { emptyDashboardFilterParams } from "@/lib/dashboard/filter-params";
import { fetchFormSubmissionsPage } from "@/lib/queries/form-submissions-client";
import type { DashboardFilterParams } from "@/types/dashboard-api";
import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";

export const ORG_LEVEL_LABELS: Record<string, string> = {
  C0: "ORG Level 0",
  C1: "ORG Level 1",
  C2: "ORG Level 2",
  C3: "ORG Level 3",
};

export type OrgReportStatus = "Completed" | "In-progress";

export type OrgReportCompletion = {
  status: OrgReportStatus;
  totalStaff: number;
  eligibleCount: number;
  alignedCount: number;
  pendingCount: number;
};

export function orgLevelLabel(categoryCode: string): string {
  return ORG_LEVEL_LABELS[categoryCode] ?? categoryCode;
}

export function formatOrgEntityOptionLabel(entity: EntityRecord): string {
  const level = orgLevelLabel(entity.categoryCode);
  const parent = entity.parentName?.trim();
  const count =
    entity.staffCount > 0
      ? ` (${entity.staffCount.toLocaleString("en-US")})`
      : "";
  if (parent) {
    return `${level} — ${entity.name} · ${parent}${count}`;
  }
  return `${level} — ${entity.name}${count}`;
}

export function sortOrgEntitiesForPicker(
  entities: EntityRecord[],
): EntityRecord[] {
  const rank = (code: string) => {
    const parsed = Number(String(code).replace(/^C/i, ""));
    return Number.isFinite(parsed) ? parsed : 99;
  };

  return [...entities].sort((left, right) => {
    const byLevel = rank(left.categoryCode) - rank(right.categoryCode);
    if (byLevel !== 0) return byLevel;
    return left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

/**
 * Maps a selected org node onto the same entity filters used by the staff listing.
 * Any category slot works for subtree matching; we pick the slot that matches
 * the node's level so C0/C1/C2 filters stay consistent with the dashboard.
 */
export function dashboardFiltersForOrgEntity(
  entity: EntityRecord,
): DashboardFilterParams {
  const filters = emptyDashboardFilterParams();
  if (entity.categoryCode === "C0") {
    filters.category0EntityIds = [entity.id];
  } else if (entity.categoryCode === "C1") {
    filters.category1EntityIds = [entity.id];
  } else {
    filters.category2EntityIds = [entity.id];
  }
  return filters;
}

/**
 * Eligible staff in the listing must all reach HR Alignment
 * (`PENDING_BOARD_APPROVAL` / `APPROVED` / `COMPLETED`) for Completed.
 * Ineligible / N/A rows are excluded because they are not expected to align.
 */
export function resolveOrgReportCompletion(
  submissions: FormSubmissionListItem[],
): OrgReportCompletion {
  const eligible = submissions.filter(isSubmissionEligible);
  const alignedCount = eligible.filter(isHrAlignmentAligned).length;
  const pendingCount = eligible.length - alignedCount;
  const status: OrgReportStatus =
    eligible.length > 0 && pendingCount === 0 ? "Completed" : "In-progress";

  return {
    status,
    totalStaff: submissions.length,
    eligibleCount: eligible.length,
    alignedCount,
    pendingCount,
  };
}

const ORG_REPORT_PAGE_SIZE = 100000;

export async function fetchOrgReportSubmissions(
  entity: EntityRecord,
): Promise<FormSubmissionListItem[]> {
  const filters = dashboardFiltersForOrgEntity(entity);
  const first = await fetchFormSubmissionsPage({
    page: 1,
    pageSize: ORG_REPORT_PAGE_SIZE,
    filters,
    masterFilters: EMPTY_MASTER_FILTER_STATE,
  });

  if (first.total <= first.items.length) {
    return first.items;
  }

  const pageCount = Math.ceil(first.total / ORG_REPORT_PAGE_SIZE);
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      fetchFormSubmissionsPage({
        page: index + 2,
        pageSize: ORG_REPORT_PAGE_SIZE,
        filters,
        masterFilters: EMPTY_MASTER_FILTER_STATE,
      }),
    ),
  );

  return first.items.concat(...rest.map((page) => page.items));
}

export function orgReportFileName(orgName: string, generatedAt: Date): string {
  const slug =
    orgName
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "org";
  const date = generatedAt.toISOString().slice(0, 10);
  return `calibration-report-${slug}-${date}.pdf`;
}
