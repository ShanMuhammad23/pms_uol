import {
  EMPTY_MASTER_FILTER_STATE,
  MASTER_FILTER_MULTI_COLUMNS,
  MASTER_FILTER_TEXT_COLUMNS,
  type MasterFilterState,
  type MasterFilterTextColumnId,
} from "@/app/helpers/dashboard-master-filters";
import type { DashboardTableColumnId } from "@/app/helpers/dashboard-table-columns";
import type {
  DashboardFilterParams,
  FormSubmissionsQueryParams,
} from "@/types/dashboard-api";
import type { CardFilterId } from "@/app/helpers/dashboard-types";
import { APPRAISAL_STATUSES, type AppraisalStatus } from "@/types/forms";

const DEFAULT_PAGE_SIZE = 50;

function parseCsv(value: string | null): string[] | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return [];
  return trimmed.split(",").map((part) => part.trim()).filter(Boolean);
}

function parseNumberCsv(value: string | null): number[] | null {
  const parts = parseCsv(value);
  if (parts === null) return null;
  return parts
    .map(Number)
    .filter((id) => Number.isFinite(id));
}

function serializeCsv(values: Array<string | number> | null | undefined): string | null {
  if (values === null || values === undefined) return null;
  return values.map(String).join(",");
}

export function emptyDashboardFilterParams(): DashboardFilterParams {
  return {
    searchQuery: "",
    category0EntityIds: null,
    category1EntityIds: null,
    category2EntityIds: null,
    roleCategories: null,
    designations: null,
    formStates: null,
    cardFilter: null,
  };
}

export function parseDashboardFilterParams(
  searchParams: URLSearchParams,
): DashboardFilterParams {
  const formStateParts = parseCsv(searchParams.get("formState"));
  const formStates =
    formStateParts === null
      ? null
      : (formStateParts.filter((state) =>
          APPRAISAL_STATUSES.includes(state as AppraisalStatus),
        ) as AppraisalStatus[]);

  return {
    searchQuery: searchParams.get("search")?.trim() ?? "",
    category0EntityIds: parseNumberCsv(searchParams.get("c0")),
    category1EntityIds: parseNumberCsv(searchParams.get("c1")),
    category2EntityIds: parseNumberCsv(searchParams.get("c2")),
    roleCategories: parseCsv(searchParams.get("role")),
    designations: parseCsv(searchParams.get("designation")),
    formStates,
    cardFilter: (searchParams.get("card") as CardFilterId | null) ?? null,
  };
}

export function appendDashboardFilterParams(
  params: URLSearchParams,
  filters: DashboardFilterParams,
) {
  if (filters.searchQuery.trim()) {
    params.set("search", filters.searchQuery.trim());
  }

  const c0 = serializeCsv(filters.category0EntityIds);
  if (c0 !== null) params.set("c0", c0);

  const c1 = serializeCsv(filters.category1EntityIds);
  if (c1 !== null) params.set("c1", c1);

  const c2 = serializeCsv(filters.category2EntityIds);
  if (c2 !== null) params.set("c2", c2);

  const role = serializeCsv(filters.roleCategories);
  if (role !== null) params.set("role", role);

  const designation = serializeCsv(filters.designations);
  if (designation !== null) params.set("designation", designation);

  const formState = serializeCsv(filters.formStates);
  if (formState !== null) params.set("formState", formState);

  if (filters.cardFilter) {
    params.set("card", filters.cardFilter);
  }
}

export function parseMasterFilterParams(
  searchParams: URLSearchParams,
): MasterFilterState {
  const text: MasterFilterState["text"] = {};
  const multi: MasterFilterState["multi"] = {};

  for (const column of MASTER_FILTER_TEXT_COLUMNS) {
    const value = searchParams.get(`mft_${column.id}`);
    if (value?.trim()) {
      text[column.id as MasterFilterTextColumnId] = value;
    }
  }

  for (const column of MASTER_FILTER_MULTI_COLUMNS) {
    const raw = searchParams.get(`mfm_${column.id}`);
    if (raw == null) continue;
    multi[column.id] = parseCsv(raw) ?? [];
  }

  return { text, multi, numeric: {} };
}

export function appendMasterFilterParams(
  params: URLSearchParams,
  filters: MasterFilterState,
) {
  for (const [columnId, value] of Object.entries(filters.text)) {
    if (value?.trim()) {
      params.set(`mft_${columnId}`, value);
    }
  }

  for (const [columnId, selected] of Object.entries(filters.multi)) {
    if (selected === undefined || selected === null) continue;
    params.set(`mfm_${columnId}`, selected.join(","));
  }
}

export function parseFormSubmissionsQueryParams(
  searchParams: URLSearchParams,
): FormSubmissionsQueryParams {
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(5000, Math.floor(pageSizeRaw))
      : DEFAULT_PAGE_SIZE;

  return {
    page,
    pageSize,
    filters: parseDashboardFilterParams(searchParams),
    masterFilters: parseMasterFilterParams(searchParams),
  };
}

export function buildFormSubmissionsSearchParams(
  query: FormSubmissionsQueryParams,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  appendDashboardFilterParams(params, query.filters);
  appendMasterFilterParams(params, query.masterFilters);
  return params;
}

export function buildOverviewSearchParams(
  filters: DashboardFilterParams,
): URLSearchParams {
  const params = new URLSearchParams();
  appendDashboardFilterParams(params, filters);
  return params;
}

export function hasMasterFilterState(filters: MasterFilterState): boolean {
  return (
    MASTER_FILTER_TEXT_COLUMNS.some((column) =>
      Boolean(filters.text[column.id as MasterFilterTextColumnId]?.trim()),
    ) ||
    MASTER_FILTER_MULTI_COLUMNS.some((column) => {
      const selected = filters.multi[column.id as DashboardTableColumnId];
      return selected !== undefined && selected !== null;
    })
  );
}

export { EMPTY_MASTER_FILTER_STATE, DEFAULT_PAGE_SIZE };
