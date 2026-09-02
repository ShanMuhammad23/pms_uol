import { getRevisedSalary } from "@/app/helpers/compensation-worksheet";
import { ENTITY_FILTER_LEVELS } from "@/app/helpers/dashboard-entity-filters";
import { FORM_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
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

export type OrgReportStatus = "Completed" | "In progress";

export type OrgReportCompletion = {
  status: OrgReportStatus;
  totalStaff: number;
  eligibleCount: number;
  alignedCount: number;
  pendingCount: number;
};

export type OrgReportStaffRow = {
  sapCode: string;
  name: string;
  designation: string;
  rating: string;
  quartile: string;
  revisedSalary: number | null;
  status: OrgReportStatus;
};

export function orgLevelLabel(categoryCode: string): string {
  return ORG_LEVEL_LABELS[categoryCode] ?? categoryCode;
}

export function cloneDashboardFilterParams(
  filters?: DashboardFilterParams | null,
): DashboardFilterParams {
  const source = filters ?? emptyDashboardFilterParams();
  return {
    searchQuery: source.searchQuery,
    category0EntityIds: source.category0EntityIds
      ? [...source.category0EntityIds]
      : null,
    category1EntityIds: source.category1EntityIds
      ? [...source.category1EntityIds]
      : null,
    category2EntityIds: source.category2EntityIds
      ? [...source.category2EntityIds]
      : null,
    roleCategories: source.roleCategories ? [...source.roleCategories] : null,
    designations: source.designations ? [...source.designations] : null,
    formStates: source.formStates ? [...source.formStates] : null,
    cardFilter: source.cardFilter,
  };
}

function namesForEntityIds(
  ids: number[] | null,
  entities: EntityRecord[],
): string[] {
  if (!ids || ids.length === 0) return [];
  const byId = new Map(entities.map((entity) => [entity.id, entity.name]));
  return ids
    .map((id) => byId.get(id)?.trim())
    .filter((name): name is string => Boolean(name));
}

function joinNames(names: string[], limit = 3): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length <= limit) return names.join(", ");
  return `${names.slice(0, limit).join(", ")} + ${names.length - limit} more`;
}

/**
 * Big heading for the report: the most specific org selection, or UOL when
 * the report is unscoped.
 */
export function resolveReportOrgTitle(
  filters: DashboardFilterParams,
  entities: EntityRecord[],
): string {
  const level2 = namesForEntityIds(filters.category2EntityIds, entities);
  if (level2.length > 0) return joinNames(level2);

  const level1 = namesForEntityIds(filters.category1EntityIds, entities);
  if (level1.length > 0) return joinNames(level1);

  const level0 = namesForEntityIds(filters.category0EntityIds, entities);
  if (level0.length > 0) return joinNames(level0);

  return "University of Lahore";
}

export function formatReportFilterSummary(
  filters: DashboardFilterParams,
  entities: EntityRecord[],
): string {
  const parts: string[] = [];
  const levelNames = [
    namesForEntityIds(filters.category0EntityIds, entities),
    namesForEntityIds(filters.category1EntityIds, entities),
    namesForEntityIds(filters.category2EntityIds, entities),
  ];

  ENTITY_FILTER_LEVELS.forEach((level, index) => {
    const names = levelNames[index];
    if (names.length > 0) {
      parts.push(`${level.label}: ${joinNames(names)}`);
    }
  });

  if (filters.roleCategories && filters.roleCategories.length > 0) {
    parts.push(`Role Category: ${joinNames(filters.roleCategories)}`);
  }
  if (filters.designations && filters.designations.length > 0) {
    parts.push(`Designation: ${joinNames(filters.designations)}`);
  }
  if (filters.formStates && filters.formStates.length > 0) {
    parts.push(
      `Form Status: ${joinNames(
        filters.formStates.map(
          (state) => FORM_STATE_CONFIG[state]?.label ?? state,
        ),
      )}`,
    );
  }

  return parts.join("  ·  ");
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
    eligible.length > 0 && pendingCount === 0 ? "Completed" : "In progress";

  return {
    status,
    totalStaff: submissions.length,
    eligibleCount: eligible.length,
    alignedCount,
    pendingCount,
  };
}

export function buildOrgReportStaffRows(
  submissions: FormSubmissionListItem[],
): OrgReportStaffRow[] {
  return [...submissions]
    .sort((left, right) =>
      left.employeeName.localeCompare(right.employeeName, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    )
    .map((row) => ({
      sapCode: row.employeeId?.trim() || "—",
      name: row.employeeName?.trim() || "—",
      designation: row.designation?.trim() || "—",
      rating: row.performanceLevelName?.trim() || "—",
      quartile: row.quartileName?.trim() || "—",
      revisedSalary: getRevisedSalary(row),
      status: isHrAlignmentAligned(row) ? "Completed" : "In progress",
    }));
}

const ORG_REPORT_PAGE_SIZE = 100000;

export async function fetchOrgReportSubmissions(
  filters: DashboardFilterParams,
): Promise<FormSubmissionListItem[]> {
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
  return `performance-report-${slug}-${date}.pdf`;
}
