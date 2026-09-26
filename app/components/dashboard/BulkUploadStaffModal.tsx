"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  Check,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  Plus,
  ShieldAlert,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BulkExcelExportPanel } from "@/app/components/dashboard/BulkExcelExportPanel";
import {
  ExcelOpsLegend,
  ExcelOpsStepHeader,
} from "@/app/components/dashboard/ExcelOpsStepHeader";
import { SearchableSelect } from "@/app/components/common/SearchableSelect";
import { filterManagerEligibleUsers } from "@/app/helpers/manager-eligibility";
import {
  BULK_CREATE_SELECTABLE_COLUMNS,
  BULK_CREATE_SHEET_EXTRA_COLUMN_IDS,
  BULK_UPLOAD_COLUMN_GROUPS,
  BULK_UPLOAD_SELECTABLE_COLUMNS,
  DEFAULT_BULK_CREATE_COLUMN_IDS,
  DEFAULT_BULK_UPLOAD_COLUMN_IDS,
  applyOrgLevelsFromEntityId,
  buildBulkUploadRowValues,
  buildEntityOrgLevelOptions,
  bulkUploadGroupLabel,
  emptyBulkUploadRowValues,
  formatEntityOrgLevelLabel,
  getBulkUploadColumn,
  isBulkUploadCreateField,
  isOrg2UnderOrg1,
  entityOrgLevelNumber,
  orgLevelDisplayLabel,
  orgLevelsFromEntityId,
  resolveManagerMappedValue,
  resolveOrgLevelMappedValue,
  suggestEntityIdForSheetOrgName,
  type BulkUploadColumnDef,
  type BulkUploadColumnGroup,
  type BulkUploadColumnId,
} from "@/app/helpers/bulk-upload-columns";
import {
  BULK_UPLOAD_CHECK_STEPS,
  checkDuplicates,
  checkValueConstraints,
  chunkSaveGroups,
  collectBulkUploadCreates,
  collectBulkUploadSaveGroups,
  type BulkUploadCheckResult,
  type BulkUploadCheckStepId,
  type BulkUploadCreateDraft,
  type BulkUploadIssue,
  type BulkUploadSaveGroup,
} from "@/app/helpers/bulk-upload-validation";
import {
  normalizeMappedExcelValue,
  normalizeSheetOrgValueKey,
  parseExcelStaffSheet,
  sapLookupKey,
  suggestExcelColumnMapping,
  suggestOrgLevelSheetColumn,
  uniqueSheetColumnValuesForSaps,
  type ExcelColumnMapping,
  type ExcelSheetColumn,
  type ParsedExcelStaffSheet,
} from "@/app/helpers/bulk-upload-excel";
import type { EntityRecord } from "@/types/entities";
import {
  invalidateStaffListingQueries,
} from "@/app/helpers/dashboard-listing-cache";
import {
  emptyDashboardFilterParams,
  EMPTY_MASTER_FILTER_STATE,
} from "@/lib/dashboard/filter-params";
import { queryKeys } from "@/app/queries/keys";
import { useCampusesQuery } from "@/app/queries/users";
import { createEntity, fetchDashboardEntities } from "@/lib/queries/entities-client";
import { fetchEntityCategories } from "@/lib/queries/entity-categories-client";
import { fetchFormTemplatesForDashboard, assignFormTemplateToEmployees } from "@/lib/queries/forms-client";
import {
  bulkUpdateEmployeeListingFields,
  fetchFormSubmissionsPage,
} from "@/lib/queries/form-submissions-client";
import { createUser, fetchUsersOverview } from "@/lib/queries/users-client";
import type { DashboardFilterParams } from "@/types/dashboard-api";
import type { MasterFilterState } from "@/app/helpers/dashboard-master-filters";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { UserRecord } from "@/types/users";
import { USER_ROLES, USER_ROLE_LABELS } from "@/types/users";
import {
  CATEGORY_LABELS,
  CATEGORY_SUB_MAP,
  EMPLOYEE_CATEGORIES,
  SUB_CATEGORY_LABELS,
  type EmployeeCategory,
} from "@/types/forms";
import { cn } from "@/lib/utils";

type ExcelOpsMode = "choose" | "import" | "export";
type CreateImportPhase = "org" | "fields";
export type BulkUploadPurpose = "excel-ops" | "create-users";

const EMPTY_SUBMISSIONS: FormSubmissionListItem[] = [];

type RowValues = Record<BulkUploadColumnId, string>;

type SheetRow = {
  rowKey: string;
  employeeId: string;
  employeeName: string;
  isNew: boolean;
  values: RowValues;
  original: RowValues;
};

interface BulkUploadStaffModalProps {
  open: boolean;
  /** Required for Staff Listing excel-ops; unused for create-users. */
  filterParams?: DashboardFilterParams;
  masterFilters?: MasterFilterState;
  onClose: () => void;
  onSuccess: () => void;
  /**
   * `excel-ops` — Staff Listing import/export updates (default).
   * `create-users` — Users page: create new accounts from Excel SAPs.
   */
  purpose?: BulkUploadPurpose;
}

const cellInputClassName =
  "h-8 w-full min-w-0 border-0 bg-transparent px-2 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40 dark:text-slate-100 dark:focus:bg-slate-900";

const sheetSelectClassName =
  "[&_button]:h-7 [&_button]:rounded-md [&_button]:px-2 [&_button]:py-0 [&_button]:text-xs [&_button]:focus:ring-1";

const COLUMN_GROUP_ROW: Record<BulkUploadColumnGroup, string> = {
  basic:
    "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/35",
  performance:
    "border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/35",
  compensation:
    "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35",
};

const COLUMN_GROUP_LABEL: Record<BulkUploadColumnGroup, string> = {
  basic: "text-sky-800 dark:text-sky-200",
  performance: "text-teal-800 dark:text-teal-200",
  compensation: "text-amber-800 dark:text-amber-200",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function BulkUploadStaffModal({
  open,
  filterParams = emptyDashboardFilterParams(),
  masterFilters = EMPTY_MASTER_FILTER_STATE,
  onClose,
  onSuccess,
  purpose = "excel-ops",
}: BulkUploadStaffModalProps) {
  const queryClient = useQueryClient();
  const isCreateUsers = purpose === "create-users";
  const selectableColumns = isCreateUsers
    ? BULK_CREATE_SELECTABLE_COLUMNS
    : BULK_UPLOAD_SELECTABLE_COLUMNS;
  const defaultColumnIds = isCreateUsers
    ? DEFAULT_BULK_CREATE_COLUMN_IDS
    : DEFAULT_BULK_UPLOAD_COLUMN_IDS;

  const [mode, setMode] = useState<ExcelOpsMode>(
    isCreateUsers ? "import" : "choose",
  );
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [excelSheet, setExcelSheet] = useState<ParsedExcelStaffSheet | null>(null);
  const [columnMapping, setColumnMapping] = useState<ExcelColumnMapping>({});
  const [importedSapIds, setImportedSapIds] = useState<string[]>([]);
  const [importUnmatched, setImportUnmatched] = useState<string[]>([]);
  const [importAlreadyExist, setImportAlreadyExist] = useState<string[]>([]);
  const [importParsing, setImportParsing] = useState(false);
  const [importDragOver, setImportDragOver] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedColumnIds, setSelectedColumnIds] = useState<Set<BulkUploadColumnId>>(
    () => new Set(defaultColumnIds),
  );
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [createImportPhase, setCreateImportPhase] =
    useState<CreateImportPhase>("org");
  const [selectedCampusId, setSelectedCampusId] = useState<string>("");
  const [orgLevelColumnIndex, setOrgLevelColumnIndex] = useState<number | null>(
    null,
  );
  const [orgLevelValueMapping, setOrgLevelValueMapping] = useState<
    Record<string, string>
  >({});
  const [createOrgDialog, setCreateOrgDialog] = useState<{
    sheetValue: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkStep, setCheckStep] = useState<BulkUploadCheckStepId>("collect");
  const [checkFailedStep, setCheckFailedStep] = useState<BulkUploadCheckStepId | null>(
    null,
  );
  const [checkResult, setCheckResult] = useState<BulkUploadCheckResult | null>(null);
  const [sheetIssues, setSheetIssues] = useState<BulkUploadIssue[]>([]);
  const checkRunId = useRef(0);

  const { data: pageData, isLoading: employeesLoading } = useQuery({
    queryKey: ["bulk-upload-staff", filterParams, masterFilters],
    queryFn: () =>
      fetchFormSubmissionsPage({
        page: 1,
        pageSize: 100000,
        filters: filterParams,
        masterFilters,
      }),
    enabled: open && mode === "import" && !isCreateUsers,
  });

  const { data: entities } = useQuery({
    queryKey: queryKeys.entities,
    queryFn: fetchDashboardEntities,
    enabled: open && mode === "import",
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: queryKeys.usersOverview,
    queryFn: fetchUsersOverview,
    enabled: open && mode === "import",
  });

  const { data: formTemplates } = useQuery({
    queryKey: ["form-templates"],
    queryFn: fetchFormTemplatesForDashboard,
    enabled: open && mode === "import",
  });

  const { data: campuses = [] } = useCampusesQuery();

  const { data: entityCategories = [] } = useQuery({
    queryKey: ["entity-categories"],
    queryFn: fetchEntityCategories,
    enabled: open && isCreateUsers && mode === "import",
  });

  const employees = pageData?.items ?? EMPTY_SUBMISSIONS;
  const loadingStaff = isCreateUsers ? usersLoading : employeesLoading;

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMode(isCreateUsers ? "import" : "choose");
      setImportFileName(null);
      setExcelSheet(null);
      setColumnMapping({});
      setImportedSapIds([]);
      setImportUnmatched([]);
      setImportAlreadyExist([]);
      setImportParsing(false);
      setImportDragOver(false);
      setSelectedEmployeeIds(new Set());
      setSelectedColumnIds(new Set(defaultColumnIds));
      setSheetRows([]);
      setCreateImportPhase("org");
      setSelectedCampusId("");
      setOrgLevelColumnIndex(null);
      setOrgLevelValueMapping({});
      setCreateOrgDialog(null);
      setError(null);
      setCheckOpen(false);
      setCheckStep("collect");
      setCheckFailedStep(null);
      setCheckResult(null);
      setSheetIssues([]);
      checkRunId.current += 1;
    }
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const usersByEmployeeId = useMemo(() => {
    const map = new Map<string, UserRecord>();
    for (const user of users ?? []) {
      map.set(user.employeeId, user);
    }
    return map;
  }, [users]);

  const managerSelectOptions = useMemo(() => {
    const eligible = filterManagerEligibleUsers((users ?? []).filter((u) => u.isActive));
    return eligible.map((user) => ({
      value: String(user.id),
      label: `${user.firstName} ${user.lastName} (${user.employeeId})`,
    }));
  }, [users]);

  const org1Options = useMemo(() => {
    const list = entities ?? [];
    const coded = list.filter((entity) => entity.categoryCode === "C1");
    const source = coded.length > 0 ? coded : list.filter((entity) => entity.parentEntityId == null);
    return source.map((entity) => ({
      value: String(entity.id),
      label: entity.name,
    }));
  }, [entities]);

  const formSelectOptions = useMemo(() => {
    return (formTemplates ?? []).map((template) => ({
      value: String(template.id),
      label: template.code
        ? `${template.code} — ${template.title}`
        : template.title,
    }));
  }, [formTemplates]);

  const org2OptionsFor = useCallback(
    (org1Id: string) => {
      const list = entities ?? [];
      if (!org1Id) {
        const coded = list.filter((entity) => entity.categoryCode === "C2");
        const source = coded.length > 0 ? coded : list.filter((entity) => entity.parentEntityId != null);
        return source.map((entity) => ({
          value: String(entity.id),
          label: entity.name,
        }));
      }
      return list
        .filter((entity) => String(entity.id) !== org1Id)
        .filter((entity) => isOrg2UnderOrg1(String(entity.id), org1Id, list))
        .map((entity) => ({
          value: String(entity.id),
          label: entity.name,
        }));
    },
    [entities],
  );

  const campusEntities = useMemo(() => {
    const list = entities ?? [];
    if (!selectedCampusId) return [];
    return list.filter(
      (entity) => String(entity.campusId ?? "") === selectedCampusId,
    );
  }, [entities, selectedCampusId]);

  const entityOrgLevelOptions = useMemo(
    () => buildEntityOrgLevelOptions(campusEntities),
    [campusEntities],
  );

  const campusSelectOptions = useMemo(
    () =>
      campuses.map((campus) => ({
        value: String(campus.id),
        label: campus.name,
      })),
    [campuses],
  );

  const orgSheetColumnOptions = useMemo(() => {
    if (!excelSheet) return [];
    return excelSheet.columns
      .filter((column) => !column.isSap)
      .map((column) => ({
        value: String(column.index),
        label: column.header || `Column ${column.index + 1}`,
      }));
  }, [excelSheet]);

  const uniqueOrgSheetValues = useMemo(() => {
    if (!excelSheet || orgLevelColumnIndex == null || !isCreateUsers) {
      return [];
    }
    const sapKeys = new Set(
      [...selectedEmployeeIds].map((id) => sapLookupKey(id)),
    );
    return uniqueSheetColumnValuesForSaps(
      excelSheet,
      orgLevelColumnIndex,
      sapKeys,
    );
  }, [excelSheet, orgLevelColumnIndex, selectedEmployeeIds, isCreateUsers]);

  const matchedPeople = useMemo(() => {
    if (isCreateUsers) {
      return [...selectedEmployeeIds].map((id) => {
        const excelRow = excelSheet?.rows.find(
          (row) => sapLookupKey(row.sap) === sapLookupKey(id),
        );
        const nameFromSheet =
          excelRow &&
          Object.entries(columnMapping).find(([, target]) => target === "employeeName");
        let name = "";
        if (nameFromSheet && excelRow) {
          const [index] = nameFromSheet;
          name = excelRow.values[Number(index)]?.trim() ?? "";
        }
        return {
          employeeId: id,
          name: name || id,
        };
      });
    }

    const listingById = new Map(
      employees.map((row) => [row.employeeId, row] as const),
    );
    return [...selectedEmployeeIds].map((id) => {
      const listing = listingById.get(id);
      if (listing) {
        return { employeeId: listing.employeeId, name: listing.employeeName };
      }
      const user = usersByEmployeeId.get(id);
      return {
        employeeId: id,
        name: user ? `${user.firstName} ${user.lastName}`.trim() : "—",
      };
    });
  }, [
    isCreateUsers,
    selectedEmployeeIds,
    employees,
    usersByEmployeeId,
    excelSheet,
    columnMapping,
  ]);

  const applySapIds = useCallback(
    (sapIds: string[]) => {
      const byUserSap = new Map<string, UserRecord>();
      for (const user of users ?? []) {
        byUserSap.set(sapLookupKey(user.employeeId), user);
      }

      if (isCreateUsers) {
        const nextIds = new Set<string>();
        const alreadyExist: string[] = [];
        for (const sap of sapIds) {
          const key = sapLookupKey(sap);
          if (!key) continue;
          if (byUserSap.has(key)) {
            alreadyExist.push(sap);
            continue;
          }
          nextIds.add(sap);
        }
        setSelectedEmployeeIds(nextIds);
        setImportUnmatched([]);
        setImportAlreadyExist(alreadyExist);
        return;
      }

      const bySap = new Map<string, FormSubmissionListItem>();
      for (const row of employees) {
        bySap.set(sapLookupKey(row.employeeId), row);
      }

      const nextIds = new Set<string>();
      const unmatched: string[] = [];
      for (const sap of sapIds) {
        const key = sapLookupKey(sap);
        const listing = bySap.get(key);
        const user = byUserSap.get(key);
        if (listing) {
          nextIds.add(listing.employeeId);
          continue;
        }
        if (user) {
          nextIds.add(user.employeeId);
          continue;
        }
        unmatched.push(sap);
      }

      setSelectedEmployeeIds(nextIds);
      setImportUnmatched(unmatched);
      setImportAlreadyExist([]);
    },
    [employees, users, isCreateUsers],
  );

  useEffect(() => {
    if (importedSapIds.length === 0) {
      return;
    }
    applySapIds(importedSapIds);
  }, [importedSapIds, applySapIds]);

  useEffect(() => {
    if (!isCreateUsers || !excelSheet || orgLevelColumnIndex == null) {
      return;
    }
    const sapKeys = new Set(
      [...selectedEmployeeIds].map((id) => sapLookupKey(id)),
    );
    const uniqueValues = uniqueSheetColumnValuesForSaps(
      excelSheet,
      orgLevelColumnIndex,
      sapKeys,
    );
    setOrgLevelValueMapping((current) => {
      const next = { ...current };
      let changed = false;
      for (const value of uniqueValues) {
        const key = normalizeSheetOrgValueKey(value);
        // Skip keys the user already set (including explicit "Don't import").
        if (Object.prototype.hasOwnProperty.call(next, key)) continue;
        const suggested = suggestEntityIdForSheetOrgName(value, campusEntities);
        if (suggested) {
          next[key] = suggested;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [
    isCreateUsers,
    excelSheet,
    orgLevelColumnIndex,
    selectedEmployeeIds,
    campusEntities,
  ]);

  const handleExcelFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setError(null);
    setImportParsing(true);
    setSheetIssues([]);
    try {
      const parsed = await parseExcelStaffSheet(file);
      setImportFileName(file.name);
      setExcelSheet(parsed);
      setColumnMapping(suggestExcelColumnMapping(parsed.columns, selectableColumns));
      setCreateImportPhase("org");
      setSelectedCampusId("");
      setOrgLevelColumnIndex(suggestOrgLevelSheetColumn(parsed.columns));
      setOrgLevelValueMapping({});
      setCreateOrgDialog(null);
      const sapIds = parsed.rows.map((row) => row.sap);
      setImportedSapIds(sapIds);
      applySapIds(sapIds);
    } catch (parseError) {
      setImportFileName(null);
      setExcelSheet(null);
      setColumnMapping({});
      setCreateImportPhase("org");
      setSelectedCampusId("");
      setOrgLevelColumnIndex(null);
      setOrgLevelValueMapping({});
      setCreateOrgDialog(null);
      setImportedSapIds([]);
      setSelectedEmployeeIds(new Set());
      setImportUnmatched([]);
      setImportAlreadyExist([]);
      setSheetIssues([]);
      setError(
        parseError instanceof Error
          ? parseError.message
          : "Could not read the Excel file.",
      );
    } finally {
      setImportParsing(false);
    }
  };

  const hasImportedSheet = excelSheet != null && importFileName != null;
  const selectedColumns = useMemo(
    () =>
      selectableColumns.filter((column) => selectedColumnIds.has(column.id)),
    [selectableColumns, selectedColumnIds],
  );

  const previewColumns = useMemo(() => {
    if (!isCreateUsers) return selectedColumns;

    const seen = new Set<BulkUploadColumnId>();
    const columns: BulkUploadColumnDef[] = [];
    for (const column of selectedColumns) {
      if (seen.has(column.id)) continue;
      seen.add(column.id);
      columns.push(column);
    }
    for (const id of BULK_CREATE_SHEET_EXTRA_COLUMN_IDS) {
      if (seen.has(id)) continue;
      seen.add(id);
      columns.push(getBulkUploadColumn(id));
    }
    return columns;
  }, [isCreateUsers, selectedColumns]);

  const toggleColumn = (id: BulkUploadColumnId) => {
    setSelectedColumnIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllColumns = () => {
    setSelectedColumnIds(
      new Set(selectableColumns.map((column) => column.id)),
    );
  };

  const clearAllColumns = () => {
    setSelectedColumnIds(new Set());
  };

  const toggleColumnGroup = (group: BulkUploadColumnGroup) => {
    const groupIds = selectableColumns
      .filter((column) => column.group === group)
      .map((column) => column.id);
    setSelectedColumnIds((current) => {
      const next = new Set(current);
      const allSelected = groupIds.every((id) => next.has(id));
      for (const id of groupIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const setExcelTargetMapping = (
    excelIndex: number,
    targetId: BulkUploadColumnId | "",
  ) => {
    setColumnMapping((current) => {
      const next: ExcelColumnMapping = { ...current };
      if (targetId) {
        for (const [index, mapped] of Object.entries(next)) {
          if (mapped === targetId) next[Number(index)] = "";
        }
      }
      next[excelIndex] = targetId;
      return next;
    });
  };

  useEffect(() => {
    setColumnMapping((current) => {
      let changed = false;
      const next: ExcelColumnMapping = { ...current };
      for (const [index, targetId] of Object.entries(next)) {
        if (targetId && !selectedColumnIds.has(targetId)) {
          next[Number(index)] = "";
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [selectedColumnIds]);

  useEffect(() => {
    if (!excelSheet || selectedEmployeeIds.size === 0) {
      setSheetRows((current) => (current.length === 0 ? current : []));
      return;
    }

    if (isCreateUsers && createImportPhase === "org") {
      setSheetRows((current) => (current.length === 0 ? current : []));
      return;
    }

    const entityList = entities ?? [];
    const userList = users ?? [];
    const excelBySap = new Map(
      excelSheet.rows.map((row) => [sapLookupKey(row.sap), row] as const),
    );

    const applyMappedValues = (
      employeeId: string,
      employeeName: string,
      sourceValues: RowValues,
      isNew: boolean,
    ): SheetRow => {
      const original = { ...sourceValues };
      const values = { ...sourceValues };
      const excelRow = excelBySap.get(sapLookupKey(employeeId));
      let nextName = employeeName;
      if (excelRow) {
        for (const [index, targetId] of Object.entries(columnMapping)) {
          if (!targetId || !selectedColumnIds.has(targetId)) continue;
          const mapped = normalizeMappedExcelValue(
            targetId,
            excelRow.values[Number(index)] ?? "",
          );
          if (!mapped) continue;
          values[targetId] = mapped;
          if (targetId === "employeeName") nextName = mapped;
        }
      }

      if (isNew && isCreateUsers) {
        if (orgLevelColumnIndex != null && excelRow) {
          const raw = (excelRow.values[orgLevelColumnIndex] ?? "").trim();
          if (raw) {
            const entityId =
              orgLevelValueMapping[normalizeSheetOrgValueKey(raw)];
            if (entityId) {
              applyOrgLevelsFromEntityId(values, entityId, entityList);
            }
          }
        }
      } else {
        if (isNew || selectedColumnIds.has("orgLevel1")) {
          if (values.orgLevel1) {
            values.orgLevel1 =
              resolveOrgLevelMappedValue(values.orgLevel1, 1, entityList) ||
              values.orgLevel1;
          }
        }
        if (isNew || selectedColumnIds.has("orgLevel2")) {
          if (values.orgLevel2) {
            values.orgLevel2 =
              resolveOrgLevelMappedValue(
                values.orgLevel2,
                2,
                entityList,
                values.orgLevel1,
              ) || values.orgLevel2;
          }
        }
        if (
          values.orgLevel1 &&
          values.orgLevel2 &&
          !isOrg2UnderOrg1(values.orgLevel2, values.orgLevel1, entityList)
        ) {
          const resolvedOrg2 = resolveOrgLevelMappedValue(
            values.orgLevel2,
            2,
            entityList,
            values.orgLevel1,
          );
          values.orgLevel2 = resolvedOrg2;
        }
      }

      if (isNew || selectedColumnIds.has("manager1")) {
        if (values.manager1) {
          values.manager1 =
            resolveManagerMappedValue(values.manager1, userList) ||
            values.manager1;
        }
      }
      if (isNew || selectedColumnIds.has("manager2")) {
        if (values.manager2) {
          values.manager2 =
            resolveManagerMappedValue(values.manager2, userList) ||
            values.manager2;
        }
      }

      if (
        !isCreateUsers &&
        values.orgLevel1 &&
        values.orgLevel2 &&
        !isOrg2UnderOrg1(values.orgLevel2, values.orgLevel1, entityList)
      ) {
        values.orgLevel2 = "";
      }

      return {
        rowKey: isNew ? `new-${employeeId}` : employeeId,
        employeeId,
        employeeName: nextName,
        isNew,
        values,
        original: isNew ? emptyBulkUploadRowValues() : original,
      };
    };

    if (isCreateUsers) {
      const createRows = [...selectedEmployeeIds]
        .filter((sap) => {
          if (orgLevelColumnIndex == null) return false;
          const excelRow = excelBySap.get(sapLookupKey(sap));
          if (!excelRow) return false;
          const raw = (excelRow.values[orgLevelColumnIndex] ?? "").trim();
          if (!raw) return false;
          const entityId =
            orgLevelValueMapping[normalizeSheetOrgValueKey(raw)];
          return Boolean(entityId);
        })
        .map((sap) => {
          const values = emptyBulkUploadRowValues();
          return applyMappedValues(sap, sap, values, true);
        });
      setSheetRows(createRows);
      return;
    }

    const selected = employees.filter((row) =>
      selectedEmployeeIds.has(row.employeeId),
    );
    const listedIds = new Set(selected.map((row) => row.employeeId));

    const existingRows = selected.map((row) =>
      applyMappedValues(
        row.employeeId,
        row.employeeName,
        buildBulkUploadRowValues(
          row,
          usersByEmployeeId.get(row.employeeId),
          entityList,
        ),
        false,
      ),
    );
    const extraRows = [...selectedEmployeeIds]
      .filter((id) => !listedIds.has(id))
      .map((id) => {
        const user = usersByEmployeeId.get(id);
        const values = emptyBulkUploadRowValues();
        const name = user
          ? `${user.firstName} ${user.lastName}`.trim()
          : id;
        values.employeeName = name;
        if (user?.email) values.email = user.email;
        if (user?.designation) values.designation = user.designation;
        if (user?.dateOfJoining) {
          values.dateOfJoining = user.dateOfJoining.slice(0, 10);
        }
        return applyMappedValues(id, name, values, false);
      });

    setSheetRows([...existingRows, ...extraRows]);
  }, [
    excelSheet,
    columnMapping,
    selectedColumnIds,
    selectedEmployeeIds,
    employees,
    entities,
    users,
    usersByEmployeeId,
    isCreateUsers,
    createImportPhase,
    orgLevelColumnIndex,
    orgLevelValueMapping,
  ]);

  const confirmOrgMapping = () => {
    if (!excelSheet) {
      setError("Upload an Excel file first.");
      return;
    }
    if (!selectedCampusId) {
      setError("Select a site before mapping organizations.");
      return;
    }
    if (orgLevelColumnIndex == null) {
      setError("Select the sheet column that contains organization / department.");
      return;
    }
    if (selectedEmployeeIds.size === 0) {
      setError("No new SAP codes to create from this sheet.");
      return;
    }
    const mappedValues = uniqueOrgSheetValues.filter((value) =>
      Boolean(orgLevelValueMapping[normalizeSheetOrgValueKey(value)]),
    );
    if (mappedValues.length === 0) {
      setError(
        "Map at least one sheet org value to a database org level, or create one with +.",
      );
      return;
    }
    setError(null);
    setCreateImportPhase("fields");
  };

  const skippedCreateCount = useMemo(() => {
    if (!isCreateUsers || !excelSheet || orgLevelColumnIndex == null) return 0;
    let skipped = 0;
    for (const sap of selectedEmployeeIds) {
      const excelRow = excelSheet.rows.find(
        (row) => sapLookupKey(row.sap) === sapLookupKey(sap),
      );
      if (!excelRow) {
        skipped += 1;
        continue;
      }
      const raw = (excelRow.values[orgLevelColumnIndex] ?? "").trim();
      if (!raw) {
        skipped += 1;
        continue;
      }
      const entityId = orgLevelValueMapping[normalizeSheetOrgValueKey(raw)];
      if (!entityId) skipped += 1;
    }
    return skipped;
  }, [
    isCreateUsers,
    excelSheet,
    orgLevelColumnIndex,
    selectedEmployeeIds,
    orgLevelValueMapping,
  ]);

  const updateCell = (
    rowKey: string,
    columnId: BulkUploadColumnId,
    nextValue: string,
  ) => {
    const editedRow = sheetRows.find((row) => row.rowKey === rowKey);
    if (editedRow) {
      const editedSap = sapLookupKey(editedRow.employeeId);
      setSheetIssues((current) =>
        current.filter(
          (item) =>
            !(
              sapLookupKey(item.employeeId) === editedSap &&
              item.columnId === columnId
            ),
        ),
      );
    }
    setSheetRows((current) =>
      current.map((row) => {
        if (row.rowKey !== rowKey) return row;
        const values = { ...row.values, [columnId]: nextValue };
        if (
          columnId === "orgLevel1" &&
          values.orgLevel2 &&
          !isOrg2UnderOrg1(values.orgLevel2, nextValue, entities ?? [])
        ) {
          values.orgLevel2 = "";
        }
        if (columnId === "empCategory") {
          const allowed =
            CATEGORY_SUB_MAP[nextValue as EmployeeCategory] ?? [];
          if (!allowed.includes(values.empSubCategory as (typeof allowed)[number])) {
            values.empSubCategory = "";
          }
        }
        return {
          ...row,
          values,
          employeeName:
            columnId === "employeeName" ? nextValue : row.employeeName,
        };
      }),
    );
  };

  const saveMutation = useMutation({
    mutationFn: async ({
      groups,
      creates,
    }: {
      groups: BulkUploadSaveGroup[];
      creates: BulkUploadCreateDraft[];
    }) => {
      let createdCount = 0;
      for (const draft of creates) {
        await createUser(draft.input);
        createdCount += 1;
        if (draft.templateId != null) {
          await assignFormTemplateToEmployees(draft.templateId, [
            draft.input.employeeId,
          ]);
        }
        if (!draft.assessmentEligibility) {
          await bulkUpdateEmployeeListingFields([draft.input.employeeId], {
            assessmentEligibility: false,
          });
        }
      }

      const chunked = chunkSaveGroups(groups);
      let updatedCount = 0;
      for (const group of chunked) {
        const result = await bulkUpdateEmployeeListingFields(
          group.employeeIds,
          group.fields,
        );
        updatedCount += result.updatedCount;
      }
      return { createdCount, updatedCount };
    },
    onSuccess: () => {
      invalidateStaffListingQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.usersOverview });
      onSuccess();
      onClose();
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
    },
  });

  const issuesBySap = useMemo(() => {
    const map = new Map<string, BulkUploadIssue[]>();
    for (const item of sheetIssues) {
      const key = sapLookupKey(item.employeeId);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [sheetIssues]);

  const closeChecks = () => {
    if (saveMutation.isPending) return;
    checkRunId.current += 1;
    setCheckOpen(false);
    setCheckFailedStep(null);
    setCheckResult(null);

    const firstFlagged = sheetRows.find((row) =>
      issuesBySap.has(sapLookupKey(row.employeeId)),
    );
    if (firstFlagged) {
      window.requestAnimationFrame(() => {
        document
          .getElementById(`sheet-row-${firstFlagged.rowKey}`)
          ?.scrollIntoView({ block: "center" });
      });
    }
  };

  const startSaveChecks = async () => {
    if (!hasImportedSheet || selectedEmployeeIds.size === 0) {
      setError(
        isCreateUsers
          ? "Upload an Excel file with new SAP codes first."
          : "Upload an Excel file with a SAP column first.",
      );
      return;
    }
    if (!isCreateUsers && selectedColumnIds.size === 0) {
      setError("Select at least one column to update.");
      return;
    }

    const runId = ++checkRunId.current;
    const stillCurrent = () => checkRunId.current === runId;

    setError(null);
    setCheckOpen(true);
    setCheckFailedStep(null);
    setCheckResult(null);
    setSheetIssues([]);
    setCheckStep("collect");

    const formTemplateIds = new Set(
      (formTemplates ?? []).map((template) => String(template.id)),
    );
    const userList = users ?? [];
    const entityList = entities ?? [];

    await delay(280);
    if (!stillCurrent()) return;
    const collected = isCreateUsers
      ? { groups: [], changedRowCount: 0, changedCellCount: 0 }
      : collectBulkUploadSaveGroups(sheetRows, selectedColumnIds);
    const creates = collectBulkUploadCreates(sheetRows);
    if (collected.changedRowCount === 0 && creates.length === 0) {
      setCheckFailedStep("collect");
      const collectIssues: BulkUploadIssue[] = [
        {
          employeeId: "",
          employeeName: "",
          message: isCreateUsers
            ? "No new employees to create from this sheet."
            : "No cell values have changed and no new employees were added.",
        },
      ];
      setSheetIssues(collectIssues);
      setCheckResult({
        ok: false,
        issues: collectIssues,
        createdCount: 0,
        creates: [],
        ...collected,
      });
      return;
    }

    setCheckStep("constraints");
    await delay(280);
    if (!stillCurrent()) return;
    const constraintIssues = checkValueConstraints(sheetRows, selectedColumnIds, {
      users: userList,
      entities: entityList,
      formTemplateIds,
    });
    if (constraintIssues.length > 0) {
      setCheckFailedStep("constraints");
      setSheetIssues(constraintIssues);
      setCheckResult({
        ok: false,
        issues: constraintIssues,
        createdCount: creates.length,
        creates,
        ...collected,
      });
      return;
    }

    setCheckStep("duplicates");
    await delay(280);
    if (!stillCurrent()) return;
    const duplicateIssues = checkDuplicates(sheetRows, selectedColumnIds, userList);
    if (duplicateIssues.length > 0) {
      setCheckFailedStep("duplicates");
      setSheetIssues(duplicateIssues);
      setCheckResult({
        ok: false,
        issues: duplicateIssues,
        createdCount: creates.length,
        creates,
        ...collected,
      });
      return;
    }

    setCheckStep("confirm");
    setCheckResult({
      ok: true,
      issues: [],
      createdCount: creates.length,
      creates,
      ...collected,
    });
  };

  if (!open) return null;

  const headerTitle = isCreateUsers
    ? "Bulk upload staff"
    : mode === "export"
      ? "Bulk Excel Ops · Export to Sheet"
      : mode === "import"
        ? "Bulk Excel Ops · Import From Sheet"
        : "Bulk Excel Ops";

  return (
    <AnimatePresence>
      <motion.div
        key="bulk-upload-staff-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-upload-staff-modal-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-100 flex flex-col bg-white dark:bg-slate-950"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#185C37]/40 bg-[#217346] px-4 py-2 text-white">
          <div className="flex min-w-0 items-center gap-2.5">
            {!isCreateUsers && mode !== "choose" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("choose");
                  setError(null);
                }}
                className="inline-flex size-7 items-center justify-center rounded text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Back to Excel ops options"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <FileSpreadsheet className="size-4 shrink-0" aria-hidden="true" />
            )}
            <h2
              id="bulk-upload-staff-modal-title"
              className="truncate text-sm font-semibold"
            >
              {headerTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={isCreateUsers ? "Close bulk upload" : "Close bulk Excel ops"}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {!isCreateUsers && mode === "choose" ? (
            <div className="mx-auto grid max-w-3xl gap-4 py-8 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("import");
                }}
                className="group flex flex-col items-start gap-3 rounded-xl border border-[#217346]/25 bg-[#217346]/[0.04] p-5 text-left transition-colors hover:border-[#217346] hover:bg-[#217346]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#217346] dark:border-[#3f9c6b]/30 dark:bg-[#217346]/10"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-[#217346] text-white">
                  <Upload className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-base font-semibold text-slate-900 dark:text-white">
                    Import From Sheet
                  </span>
                  <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                    Upload Excel, map sheet columns into PMS fields, review
                    changes, and save staff updates.
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("export");
                }}
                className="group flex flex-col items-start gap-3 rounded-xl border border-[#217346]/25 bg-[#217346]/[0.04] p-5 text-left transition-colors hover:border-[#217346] hover:bg-[#217346]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#217346] dark:border-[#3f9c6b]/30 dark:bg-[#217346]/10"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-[#217346] text-white">
                  <Download className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-base font-semibold text-slate-900 dark:text-white">
                    Export to Sheet
                  </span>
                  <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                    Upload Excel, map Staff Listing columns onto sheet columns,
                    fill matched SAP rows, and download.
                  </span>
                </span>
              </button>
            </div>
          ) : null}

          {mode === "import" ? (
            <div className="space-y-3">
              <ExcelOpsLegend />
              <section className="overflow-hidden rounded-md border border-[#217346]/30 dark:border-[#3f9c6b]/40">
                <ExcelOpsStepHeader
                  step={1}
                  tone="sheet"
                  icon={<FileSpreadsheet className="size-3.5" />}
                  title={
                    isCreateUsers
                      ? "Upload the Excel file of new staff"
                      : "Upload your Excel file"
                  }
                  hint="The sheet must have a SAP column so each row can be matched"
                />
                <div className="px-3 py-2">
                  <EmployeeStep
                    fileName={importFileName}
                    parsing={importParsing}
                    loadingStaff={loadingStaff}
                    dragOver={importDragOver}
                    matchedPeople={matchedPeople}
                    unmatchedSaps={importUnmatched}
                    alreadyExistSaps={importAlreadyExist}
                    createMode={isCreateUsers}
                    onDragOverChange={setImportDragOver}
                    onFile={handleExcelFile}
                  />
                </div>
              </section>
              {hasImportedSheet && isCreateUsers && createImportPhase === "org" ? (
                <OrgLevelMappingStep
                  campusOptions={campusSelectOptions}
                  selectedCampusId={selectedCampusId}
                  onCampusChange={(next) => {
                    setSelectedCampusId(next);
                    setOrgLevelValueMapping({});
                    setError(null);
                  }}
                  columnOptions={orgSheetColumnOptions}
                  selectedColumnIndex={orgLevelColumnIndex}
                  uniqueSheetValues={uniqueOrgSheetValues}
                  entityOptions={entityOrgLevelOptions}
                  mapping={orgLevelValueMapping}
                  entities={campusEntities}
                  onColumnChange={(index) => {
                    setOrgLevelColumnIndex(index);
                    setOrgLevelValueMapping({});
                    setError(null);
                  }}
                  onMapValue={(sheetValue, entityId) => {
                    setOrgLevelValueMapping((current) => ({
                      ...current,
                      [normalizeSheetOrgValueKey(sheetValue)]: entityId,
                    }));
                    setError(null);
                  }}
                  onAddOrgLevel={(sheetValue) => {
                    setCreateOrgDialog({ sheetValue });
                    setError(null);
                  }}
                />
              ) : null}

              {hasImportedSheet &&
              (!isCreateUsers || createImportPhase === "fields") ? (
                <>
                  <div className="grid items-start gap-3 lg:grid-cols-2">
                    <ColumnStep
                      step={isCreateUsers ? 3 : 2}
                      selectedIds={selectedColumnIds}
                      columns={selectableColumns}
                      title={
                        isCreateUsers
                          ? "PMS fields to import"
                          : "PMS fields to update"
                      }
                      onToggle={toggleColumn}
                      onSelectAll={selectAllColumns}
                      onClearAll={clearAllColumns}
                      onToggleGroup={toggleColumnGroup}
                    />
                    <MappingStep
                      step={isCreateUsers ? 4 : 3}
                      columns={excelSheet?.columns ?? []}
                      mapping={columnMapping}
                      targets={selectedColumns}
                      onChange={setExcelTargetMapping}
                    />
                  </div>
                  <SheetStep
                    step={isCreateUsers ? 5 : 4}
                    rows={sheetRows}
                    columns={previewColumns}
                    issuesBySap={issuesBySap}
                    org1Options={org1Options}
                    org2OptionsFor={org2OptionsFor}
                    managerOptions={managerSelectOptions}
                    formOptions={formSelectOptions}
                    entities={entities ?? []}
                    onChange={updateCell}
                    disabled={saveMutation.isPending || checkOpen}
                    createMode={isCreateUsers}
                  />
                </>
              ) : null}
            </div>
          ) : null}

          {!isCreateUsers && mode === "export" ? (
            <BulkExcelExportPanel
              filterParams={filterParams}
              masterFilters={masterFilters}
              onError={setError}
            />
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error ? (
              <span className="font-medium text-red-600 dark:text-red-400">{error}</span>
            ) : isCreateUsers ? (
              hasImportedSheet ? (
                createImportPhase === "org"
                  ? `${matchedPeople.length} new · ${importAlreadyExist.length} already exist · ${
                      selectedCampusId
                        ? `${uniqueOrgSheetValues.filter((v) => Boolean(orgLevelValueMapping[normalizeSheetOrgValueKey(v)])).length}/${uniqueOrgSheetValues.length} org values mapped`
                        : "select a site"
                    }`
                  : `${sheetRows.length} to create · ${skippedCreateCount} skipped (no org map) · ${selectedColumnIds.size} columns · ${
                      Object.values(columnMapping).filter(Boolean).length
                    } mapped`
              ) : (
                "Upload an Excel file with SAP codes to create new staff accounts"
              )
            ) : mode === "choose" ? (
              "Choose whether to import PMS updates from Excel or export PMS values into an existing sheet"
            ) : mode === "export" ? (
              "Map Staff Listing columns to sheet columns, then download the filled workbook"
            ) : hasImportedSheet ? (
              `${matchedPeople.length} matched · ${importUnmatched.length} not found · ${selectedColumnIds.size} columns · ${
                Object.values(columnMapping).filter(Boolean).length
              } mapped`
            ) : (
              "Upload an Excel file to match staff and map columns"
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#217346] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            {mode === "import" && isCreateUsers && createImportPhase === "fields" ? (
              <button
                type="button"
                onClick={() => {
                  setCreateImportPhase("org");
                  setError(null);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#217346] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Back
              </button>
            ) : null}
            {mode === "import" ? (
              isCreateUsers && createImportPhase === "org" ? (
                <button
                  type="button"
                  onClick={confirmOrgMapping}
                  disabled={
                    !hasImportedSheet ||
                    selectedEmployeeIds.size === 0 ||
                    !selectedCampusId ||
                    orgLevelColumnIndex == null
                  }
                  className="rounded-lg bg-[#217346] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#185C37] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#217346] disabled:opacity-60"
                >
                  Continue to field mapping
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void startSaveChecks();
                  }}
                  disabled={
                    !hasImportedSheet ||
                    sheetRows.length === 0 ||
                    saveMutation.isPending ||
                    checkOpen ||
                    (isCreateUsers && createImportPhase !== "fields")
                  }
                  className="rounded-lg bg-[#217346] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#185C37] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#217346] disabled:opacity-60"
                >
                  Next
                </button>
              )
            ) : null}
          </div>
        </footer>

        <SaveChecksOverlay
          open={checkOpen}
          step={checkStep}
          failedStep={checkFailedStep}
          result={checkResult}
          saving={saveMutation.isPending}
          saveError={error}
          onClose={closeChecks}
            onConfirm={() => {
            if (!checkResult?.ok) return;
            saveMutation.mutate({
              groups: checkResult.groups,
              creates: checkResult.creates,
            });
          }}
        />

        {createOrgDialog && selectedCampusId ? (
          <CreateOrgLevelDialog
            open
            initialName={createOrgDialog.sheetValue}
            campusId={Number(selectedCampusId)}
            campusName={
              campuses.find((c) => String(c.id) === selectedCampusId)?.name ??
              "Selected site"
            }
            categories={entityCategories}
            campusEntities={campusEntities}
            onClose={() => setCreateOrgDialog(null)}
            onCreated={(entity) => {
              queryClient.invalidateQueries({ queryKey: queryKeys.entities });
              setOrgLevelValueMapping((current) => ({
                ...current,
                [normalizeSheetOrgValueKey(createOrgDialog.sheetValue)]:
                  String(entity.id),
              }));
              setCreateOrgDialog(null);
            }}
          />
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}

function SaveChecksOverlay({
  open,
  step,
  failedStep,
  result,
  saving,
  saveError,
  onClose,
  onConfirm,
}: {
  open: boolean;
  step: BulkUploadCheckStepId;
  failedStep: BulkUploadCheckStepId | null;
  result: BulkUploadCheckResult | null;
  saving: boolean;
  saveError: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const stepIndex = BULK_UPLOAD_CHECK_STEPS.findIndex((item) => item.id === step);
  const failedIndex = failedStep
    ? BULK_UPLOAD_CHECK_STEPS.findIndex((item) => item.id === failedStep)
    : -1;
  const progressPercent =
    failedIndex >= 0
      ? ((failedIndex + 1) / BULK_UPLOAD_CHECK_STEPS.length) * 100
      : ((stepIndex + 1) / BULK_UPLOAD_CHECK_STEPS.length) * 100;
  const current = BULK_UPLOAD_CHECK_STEPS[stepIndex] ?? BULK_UPLOAD_CHECK_STEPS[0];
  const hasFailed = failedStep != null;
  const readyToSave = result?.ok === true && !saving;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="bulk-upload-save-checks"
          className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm dark:bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-upload-save-checks-title"
        >
          <motion.div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-white/10 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                {hasFailed ? (
                  <span className="flex size-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300">
                    <ShieldAlert className="size-4" aria-hidden="true" />
                  </span>
                ) : readyToSave ? (
                  <span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  </span>
                )}
                <div>
                  <h3
                    id="bulk-upload-save-checks-title"
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Review changes
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {saving
                      ? "Writing updates to staff records"
                      : hasFailed
                        ? "Fix the issues below, then try again"
                        : readyToSave
                          ? "All checks passed"
                          : current.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-600 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close review"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <ol className="grid grid-cols-4 gap-2">
                {BULK_UPLOAD_CHECK_STEPS.map((item, index) => {
                  const isFailed = item.id === failedStep;
                  const isCurrent =
                    (item.id === step && result == null && !saving) ||
                    (item.id === "confirm" && saving);
                  const isComplete =
                    !isFailed &&
                    !isCurrent &&
                    (index < stepIndex || (result?.ok === true && item.id !== "confirm"));
                  return (
                    <li key={item.id} className="min-w-0 text-center">
                      <div
                        className={cn(
                          "mx-auto flex size-8 items-center justify-center rounded-full text-xs font-semibold shadow-sm",
                          isFailed
                            ? "bg-red-100 text-red-700 ring-2 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900"
                            : isComplete
                              ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
                              : isCurrent
                                ? "bg-slate-800 text-white ring-2 ring-slate-300 dark:bg-amber-600 dark:ring-amber-400/40"
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
                        )}
                      >
                        {isFailed ? (
                          <AlertTriangle className="size-4" aria-hidden="true" />
                        ) : isComplete ? (
                          <Check className="size-4" aria-hidden="true" />
                        ) : isCurrent ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <p
                        className={cn(
                          "mt-1.5 truncate text-[10px] font-semibold uppercase tracking-wide",
                          isFailed
                            ? "text-red-600 dark:text-red-400"
                            : isCurrent || isComplete
                              ? "text-slate-700 dark:text-slate-200"
                              : "text-slate-400",
                        )}
                      >
                        {item.title}
                      </p>
                    </li>
                  );
                })}
              </ol>

              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      hasFailed ? "bg-red-500" : saving ? "bg-amber-500" : "bg-emerald-500",
                    )}
                    style={{ width: `${saving ? 100 : progressPercent}%` }}
                  />
                </div>
              </div>

              {saving ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/30">
                  <Loader2
                    className="mt-0.5 size-4 shrink-0 animate-spin text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                    Saving changes…
                  </p>
                </div>
              ) : hasFailed ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/30">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-medium text-red-800 dark:text-red-200">
                    {current.title} failed. Resolve the issues below before saving.
                  </p>
                </div>
              ) : readyToSave ? null : (
                <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 dark:border-sky-900 dark:bg-sky-950/30">
                  <Loader2
                    className="mt-0.5 size-4 shrink-0 animate-spin text-sky-600 dark:text-sky-400"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-medium text-sky-800 dark:text-sky-200">
                    {current.description}
                  </p>
                </div>
              )}

              {result && !result.ok ? (
                <div className="max-h-48 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    {result.issues.length} issue{result.issues.length === 1 ? "" : "s"} found
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {result.issues.map((item, index) => (
                      <li
                        key={`${item.employeeId}-${item.columnId ?? "row"}-${index}`}
                        className="text-xs text-red-700 dark:text-red-300"
                      >
                        {item.employeeId ? (
                          <span className="font-semibold tabular-nums">
                            {item.employeeId}
                            {item.employeeName ? ` · ${item.employeeName}` : ""}
                            {": "}
                          </span>
                        ) : null}
                        {item.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {readyToSave ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div className="flex items-start gap-2.5">
                    {result.createdCount > 0 ? (
                      <UserPlus className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <p className="text-xs text-emerald-800 dark:text-emerald-200">
                      <span className="font-semibold">Checks passed. </span>
                      {result.createdCount > 0 ? (
                        <>
                          Create {result.createdCount} new employee
                          {result.createdCount === 1 ? "" : "s"}
                          {result.changedRowCount > 0
                            ? ` and save ${result.changedCellCount} update${result.changedCellCount === 1 ? "" : "s"} on ${result.changedRowCount} existing employee${result.changedRowCount === 1 ? "" : "s"}`
                            : ""}
                          . New employees sign in with Google SSO.
                        </>
                      ) : (
                        <>
                          Save {result.changedCellCount} change
                          {result.changedCellCount === 1 ? "" : "s"} across{" "}
                          {result.changedRowCount} employee
                          {result.changedRowCount === 1 ? "" : "s"}?
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ) : null}

              {saveError && saving === false && result?.ok ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/30">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-medium text-red-700 dark:text-red-300">{saveError}</p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-white/10 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/10"
              >
                {hasFailed ? "Close" : "Cancel"}
              </button>
              {readyToSave || saving ? (
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={!readyToSave || saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="size-3.5" aria-hidden="true" />
                  )}
                  {saving ? "Saving..." : "Confirm save"}
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function EmployeeStep({
  fileName,
  parsing,
  loadingStaff,
  dragOver,
  matchedPeople,
  unmatchedSaps,
  alreadyExistSaps = [],
  createMode = false,
  onDragOverChange,
  onFile,
}: {
  fileName: string | null;
  parsing: boolean;
  loadingStaff: boolean;
  dragOver: boolean;
  matchedPeople: Array<{ employeeId: string; name: string }>;
  unmatchedSaps: string[];
  alreadyExistSaps?: string[];
  createMode?: boolean;
  onDragOverChange: (next: boolean) => void;
  onFile: (file: File | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = parsing || loadingStaff;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          onDragOverChange(true);
        }}
        onDragLeave={() => onDragOverChange(false)}
        onDrop={(event) => {
          event.preventDefault();
          onDragOverChange(false);
          onFile(event.dataTransfer.files[0]);
        }}
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded px-1 py-0.5",
          dragOver && "bg-emerald-50 dark:bg-emerald-950/40",
        )}
      >
        {parsing ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-[#217346]" aria-hidden="true" />
        ) : (
          <FileSpreadsheet className="size-4 shrink-0 text-[#217346]" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {parsing ? "Reading Excel file…" : fileName ?? "Upload Excel file"}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {fileName
              ? "Click or drop a file to replace"
              : "Requires a SAP column · .xlsx, .xls"}
          </span>
        </span>
        <span className="shrink-0 rounded-md bg-[#217346]/10 px-2.5 py-1 text-xs font-semibold text-[#185C37] hover:bg-[#217346]/20 dark:bg-[#217346]/25 dark:text-[#8fd4ad] dark:hover:bg-[#217346]/35">
          Browse
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>

      {fileName && !parsing ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {createMode ? (
            <>
              <span className="font-semibold tabular-nums">{matchedPeople.length}</span> new
              <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
              <span className="font-semibold tabular-nums">{alreadyExistSaps.length}</span> already exist
              {alreadyExistSaps.length > 0
                ? ` (${alreadyExistSaps.slice(0, 8).join(", ")}${
                    alreadyExistSaps.length > 8 ? "…" : ""
                  })`
                : ""}
            </>
          ) : (
            <>
              <span className="font-semibold tabular-nums">{matchedPeople.length}</span> matched
              <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
              <span className="font-semibold tabular-nums">{unmatchedSaps.length}</span> not found
              {unmatchedSaps.length > 0
                ? ` (${unmatchedSaps.slice(0, 8).join(", ")}${
                    unmatchedSaps.length > 8 ? "…" : ""
                  })`
                : ""}
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

function ColumnStep({
  step,
  selectedIds,
  columns,
  title = "PMS fields to update",
  onToggle,
  onSelectAll,
  onClearAll,
  onToggleGroup,
}: {
  step: number;
  selectedIds: Set<BulkUploadColumnId>;
  columns: readonly BulkUploadColumnDef[];
  title?: string;
  onToggle: (id: BulkUploadColumnId) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onToggleGroup: (group: BulkUploadColumnGroup) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-sky-300/70 dark:border-sky-800">
      <ExcelOpsStepHeader
        step={step}
        tone="pms"
        icon={<Database className="size-3.5" />}
        title={title}
        hint="Staff details stored in the database — tick what this file should change"
      >
        <button
          type="button"
          onClick={onSelectAll}
          className="rounded px-2 py-0.5 text-[11px] font-semibold text-white/90 hover:bg-white/15"
        >
          All
        </button>
        <button
          type="button"
          onClick={onClearAll}
          className="rounded px-2 py-0.5 text-[11px] font-semibold text-white/90 hover:bg-white/15"
        >
          None
        </button>
      </ExcelOpsStepHeader>

      <div className="flex flex-1 flex-col">
        {BULK_UPLOAD_COLUMN_GROUPS.map((group) => {
          const groupColumns = columns.filter(
            (column) => column.group === group,
          );
          if (groupColumns.length === 0) return null;
          const allSelected = groupColumns.every((column) =>
            selectedIds.has(column.id),
          );
          return (
            <div
              key={group}
              className={cn(
                "border-b px-3 py-2 last:border-b-0",
                COLUMN_GROUP_ROW[group],
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                <h4
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide",
                    COLUMN_GROUP_LABEL[group],
                  )}
                >
                  {bulkUploadGroupLabel(group)}
                </h4>
                <button
                  type="button"
                  onClick={() => onToggleGroup(group)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {allSelected ? "Clear" : "Select"}
                </button>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {groupColumns.map((column) => {
                  const checked = selectedIds.has(column.id);
                  return (
                    <label
                      key={column.id}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(column.id)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-primary focus:ring-1 focus:ring-primary/40"
                      />
                      {column.label}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MappingStep({
  step,
  columns,
  mapping,
  targets,
  onChange,
}: {
  step: number;
  columns: ExcelSheetColumn[];
  mapping: ExcelColumnMapping;
  targets: readonly BulkUploadColumnDef[];
  onChange: (excelIndex: number, targetId: BulkUploadColumnId | "") => void;
}) {
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const targetOptions = targets.map((column) => ({
    value: column.id,
    label: column.label,
  }));

  return (
    <section className="flex h-56 flex-col overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
      <ExcelOpsStepHeader
        step={step}
        tone="mixed"
        icon={<ArrowRightLeft className="size-3.5" />}
        title="Match each Excel column to a PMS field"
        hint="Green = your sheet · Blue = PMS database"
      >
        <span>{mappedCount} mapped</span>
      </ExcelOpsStepHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 text-xs">
            <tr>
              <th className="border-b border-slate-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800 dark:border-slate-700 dark:bg-emerald-950 dark:text-emerald-200">
                Excel column
              </th>
              <th className="border-b border-slate-200 bg-sky-50 px-3 py-1.5 font-semibold text-sky-800 dark:border-slate-700 dark:bg-sky-950 dark:text-sky-200">
                PMS field (database)
              </th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr
                key={column.index}
                className="border-b border-slate-200 last:border-b-0 dark:border-slate-700"
              >
                <td className="border-l-2 border-l-emerald-300 px-3 py-1.5 text-xs text-slate-800 dark:border-l-emerald-700 dark:text-slate-100">
                  <span className="font-medium">{column.header}</span>
                  {column.isSap ? (
                    <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                      Match key
                    </span>
                  ) : null}
                </td>
                <td className="border-l-2 border-l-sky-300 px-3 py-1.5 dark:border-l-sky-700">
                  {column.isSap ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Used to match staff
                    </p>
                  ) : (
                    <SearchableSelect
                      id={`excel-map-${column.index}`}
                      value={mapping[column.index] ?? ""}
                      options={targetOptions}
                      onChange={(next) =>
                        onChange(column.index, next as BulkUploadColumnId | "")
                      }
                      placeholder="Don't import"
                      emptyOptionLabel="Don't import"
                      className={sheetSelectClassName}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrgLevelMappingStep({
  campusOptions,
  selectedCampusId,
  onCampusChange,
  columnOptions,
  selectedColumnIndex,
  uniqueSheetValues,
  entityOptions,
  mapping,
  entities,
  onColumnChange,
  onMapValue,
  onAddOrgLevel,
}: {
  campusOptions: { value: string; label: string }[];
  selectedCampusId: string;
  onCampusChange: (campusId: string) => void;
  columnOptions: { value: string; label: string }[];
  selectedColumnIndex: number | null;
  uniqueSheetValues: string[];
  entityOptions: { value: string; label: string }[];
  mapping: Record<string, string>;
  entities: EntityRecord[];
  onColumnChange: (index: number | null) => void;
  onMapValue: (sheetValue: string, entityId: string) => void;
  onAddOrgLevel: (sheetValue: string) => void;
}) {
  const mappedCount = uniqueSheetValues.filter((value) =>
    Boolean(mapping[normalizeSheetOrgValueKey(value)]),
  ).length;
  const skippedCount = uniqueSheetValues.length - mappedCount;

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
      <ExcelOpsStepHeader
        step={2}
        tone="mixed"
        icon={<Building2 className="size-3.5" />}
        title="Match sheet departments to PMS org levels"
        hint="Map each unique sheet value to an org level in the database — or choose Don't import to skip those employees. Parents fill automatically."
      />
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-sky-700 dark:text-sky-300">
              Site (PMS database)
            </label>
            <SearchableSelect
              value={selectedCampusId}
              options={campusOptions}
              onChange={onCampusChange}
              placeholder="Select site…"
              emptyOptionLabel="Select site…"
              className={sheetSelectClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Department column (your sheet)
            </label>
            <SearchableSelect
              value={selectedColumnIndex != null ? String(selectedColumnIndex) : ""}
              options={columnOptions}
              onChange={(next) => onColumnChange(next ? Number(next) : null)}
              placeholder="Select column…"
              emptyOptionLabel="Select column…"
              disabled={!selectedCampusId}
              className={sheetSelectClassName}
            />
          </div>
        </div>
      </div>

      {selectedCampusId && selectedColumnIndex != null ? (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="border-b border-slate-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 dark:border-slate-700 dark:bg-emerald-950 dark:text-emerald-200">
                  Sheet value
                </th>
                <th className="border-b border-slate-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-800 dark:border-slate-700 dark:bg-sky-950 dark:text-sky-200">
                  Map to org level (database)
                </th>
                <th className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  Auto-filled parents
                </th>
              </tr>
            </thead>
            <tbody>
              {uniqueSheetValues.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No org values found in the selected column for new SAP codes.
                  </td>
                </tr>
              ) : (
                uniqueSheetValues.map((sheetValue, index) => {
                  const entityId =
                    mapping[normalizeSheetOrgValueKey(sheetValue)] ?? "";
                  const org = entityId
                    ? orgLevelsFromEntityId(Number(entityId), entities)
                    : { org1: "", org2: "" };
                  return (
                    <tr
                      key={sheetValue}
                      className={
                        index % 2 === 0
                          ? "bg-white dark:bg-slate-950"
                          : "bg-slate-50 dark:bg-slate-900/60"
                      }
                    >
                      <td className="border-b border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 dark:border-slate-700 dark:text-slate-200">
                        {sheetValue}
                      </td>
                      <td className="border-b border-slate-200 px-4 py-2 dark:border-slate-700">
                        <div className="flex items-center gap-1.5">
                          <div className="min-w-0 flex-1">
                            <SearchableSelect
                              value={entityId}
                              options={entityOptions}
                              onChange={(next) => onMapValue(sheetValue, next)}
                              placeholder="Don't import"
                              emptyOptionLabel="Don't import"
                              className={sheetSelectClassName}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => onAddOrgLevel(sheetValue)}
                            title={`Add org level for "${sheetValue}"`}
                            aria-label={`Add org level for ${sheetValue}`}
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-[#217346] text-white hover:bg-[#185C37] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#217346]"
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                      <td className="border-b border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        {entityId ? (
                          <span>
                            {orgLevelDisplayLabel(org.org1, entities)}
                            {org.org2
                              ? ` → ${orgLevelDisplayLabel(org.org2, entities)}`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-slate-400">Skip create</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : selectedCampusId ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          Select the sheet column that contains department / org unit names.
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          Select a site to load org levels for that campus.
        </div>
      )}

      {selectedCampusId && selectedColumnIndex != null ? (
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {mappedCount} of {uniqueSheetValues.length} sheet values mapped
          {skippedCount > 0
            ? ` · ${skippedCount} will skip employee create`
            : ""}
        </div>
      ) : null}
    </section>
  );
}

function CreateOrgLevelDialog({
  open,
  initialName,
  campusId,
  campusName,
  categories,
  campusEntities,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialName: string;
  campusId: number;
  campusName: string;
  categories: Array<{ id: number; code: string }>;
  campusEntities: EntityRecord[];
  onClose: () => void;
  onCreated: (entity: EntityRecord) => void;
}) {
  const [name, setName] = useState(initialName);
  const [entityCategoryId, setEntityCategoryId] = useState(
    () => (categories[0] ? String(categories[0].id) : ""),
  );
  const [parentEntityId, setParentEntityId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setEntityCategoryId(categories[0] ? String(categories[0].id) : "");
    setParentEntityId("");
    setFormError(null);
  }, [open, initialName, categories]);

  const selectedCategoryCode = useMemo(
    () =>
      categories.find((category) => String(category.id) === entityCategoryId)
        ?.code ?? "",
    [categories, entityCategoryId],
  );

  const selectedCategoryLevel = entityOrgLevelNumber(selectedCategoryCode);
  const requiredParentLevel =
    selectedCategoryLevel > 0 ? selectedCategoryLevel - 1 : null;

  const parentOptions = useMemo(() => {
    if (requiredParentLevel == null) {
      return [];
    }
    return campusEntities
      .filter(
        (entity) =>
          entityOrgLevelNumber(entity.categoryCode) === requiredParentLevel,
      )
      .map((entity) => ({
        value: String(entity.id),
        label: formatEntityOrgLevelLabel(entity),
      }));
  }, [campusEntities, requiredParentLevel]);

  useEffect(() => {
    if (!parentEntityId) return;
    if (!parentOptions.some((option) => option.value === parentEntityId)) {
      setParentEntityId("");
    }
  }, [parentEntityId, parentOptions]);

  const createMutation = useMutation({
    mutationFn: createEntity,
    onSuccess: (entity) => {
      onCreated(entity);
    },
    onError: (mutationError: Error) => {
      setFormError(mutationError.message);
    },
  });

  if (!open) return null;

  const parentLevelLabel =
    requiredParentLevel == null
      ? null
      : `ORG Level ${requiredParentLevel} (C${requiredParentLevel})`;

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-org-level-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h3
            id="create-org-level-title"
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            Add org level
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          className="space-y-3 px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(null);
            if (!name.trim()) {
              setFormError("Name is required.");
              return;
            }
            if (!entityCategoryId) {
              setFormError("Category is required.");
              return;
            }
            if (requiredParentLevel != null && !parentEntityId) {
              setFormError(
                `Select a parent at ${parentLevelLabel ?? "the previous level"}.`,
              );
              return;
            }
            createMutation.mutate({
              name: name.trim(),
              entityCategoryId: Number(entityCategoryId),
              campusId,
              parentEntityId: parentEntityId ? Number(parentEntityId) : null,
            });
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={150}
              required
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#217346]/40 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Category
            </label>
            <select
              value={entityCategoryId}
              onChange={(event) => {
                setEntityCategoryId(event.target.value);
                setParentEntityId("");
              }}
              required
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#217346]/40 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="" disabled>
                Select category
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code} (ORG Level{" "}
                  {category.code === "C0"
                    ? 0
                    : category.code === "C1"
                      ? 1
                      : category.code === "C2"
                        ? 2
                        : category.code === "C3"
                          ? 3
                          : category.code}
                  )
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Site
            </label>
            <input
              type="text"
              value={campusName}
              disabled
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Parent org level
              {parentLevelLabel ? (
                <span className="ml-1 font-normal text-slate-400">
                  — {parentLevelLabel} only
                </span>
              ) : null}
            </label>
            {requiredParentLevel == null ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                Top-level (C0) has no parent.
              </p>
            ) : (
              <SearchableSelect
                value={parentEntityId}
                options={parentOptions}
                onChange={setParentEntityId}
                placeholder={
                  parentOptions.length === 0
                    ? `No ${parentLevelLabel} entities on this site`
                    : `Select ${parentLevelLabel}…`
                }
                emptyOptionLabel={
                  parentOptions.length === 0
                    ? `No ${parentLevelLabel} available`
                    : `Select ${parentLevelLabel}…`
                }
                disabled={parentOptions.length === 0}
                className={sheetSelectClassName}
              />
            )}
          </div>

          {formError ? (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              {formError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                createMutation.isPending ||
                (requiredParentLevel != null &&
                  (parentOptions.length === 0 || !parentEntityId))
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#217346] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#185C37] disabled:opacity-60"
            >
              {createMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-3.5" aria-hidden="true" />
              )}
              {createMutation.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SheetStep({
  step,
  rows,
  columns,
  issuesBySap,
  org1Options,
  org2OptionsFor,
  managerOptions,
  formOptions,
  entities,
  onChange,
  disabled,
  createMode = false,
}: {
  step: number;
  rows: SheetRow[];
  columns: readonly BulkUploadColumnDef[];
  issuesBySap: Map<string, BulkUploadIssue[]>;
  org1Options: { value: string; label: string }[];
  org2OptionsFor: (org1Id: string) => { value: string; label: string }[];
  managerOptions: { value: string; label: string }[];
  formOptions: { value: string; label: string }[];
  entities: EntityRecord[];
  onChange: (rowKey: string, columnId: BulkUploadColumnId, next: string) => void;
  disabled: boolean;
  createMode?: boolean;
}) {
  const changedCount = rows.filter((row) =>
    columns.some((column) =>
      row.isNew
        ? Boolean(row.values[column.id])
        : row.values[column.id] !== row.original[column.id],
    ),
  ).length;
  const issueRowCount = rows.filter((row) =>
    issuesBySap.has(sapLookupKey(row.employeeId)),
  ).length;

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
      <ExcelOpsStepHeader
        step={step}
        tone="mixed"
        icon={<Eye className="size-3.5" />}
        title={
          createMode
            ? "Review new staff before creating"
            : "Review the values before saving to PMS"
        }
        hint="Fix any red-highlighted cells, then save"
      >
        <span>
          {createMode
            ? `${rows.length} new staff`
            : `${rows.length} staff · ${changedCount} changed`}
        </span>
        {issueRowCount > 0 ? (
          <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-red-700">
            {issueRowCount} row{issueRowCount === 1 ? "" : "s"} with issues
          </span>
        ) : null}
      </ExcelOpsStepHeader>
      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-800 text-white dark:bg-slate-900">
              <th className="sticky left-0 z-20 whitespace-nowrap border-r border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold dark:bg-slate-900">
                SAP
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="whitespace-nowrap border-r border-slate-700 px-3 py-2 text-xs font-semibold"
                  style={{ minWidth: column.minWidth }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  {createMode
                    ? "No new SAP codes to create."
                    : "No matched staff to preview."}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const rowIssues =
                  issuesBySap.get(sapLookupKey(row.employeeId)) ?? [];
                const issueColumns = new Set(
                  rowIssues
                    .map((item) => item.columnId)
                    .filter((id): id is BulkUploadColumnId => id != null),
                );
                const hasIssue = rowIssues.length > 0;
                return (
                  <tr
                    key={row.rowKey}
                    id={`sheet-row-${row.rowKey}`}
                    className={
                      hasIssue
                        ? "bg-red-50 dark:bg-red-950/30"
                        : index % 2 === 0
                          ? "bg-white dark:bg-slate-950"
                          : "bg-slate-50 dark:bg-slate-900/60"
                    }
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 border-r border-b border-slate-200 bg-inherit px-3 py-1 text-xs font-semibold tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200",
                        hasIssue &&
                          "border-l-2 border-l-red-500 text-red-800 dark:text-red-200",
                      )}
                      title={
                        hasIssue
                          ? rowIssues.map((item) => item.message).join("\n")
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {hasIssue ? (
                          <AlertTriangle
                            className="size-3.5 shrink-0 text-red-500 dark:text-red-400"
                            aria-hidden="true"
                          />
                        ) : null}
                        {row.employeeId}
                      </span>
                      {row.isNew ? (
                        <span className="ml-1.5 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          new
                        </span>
                      ) : null}
                    </td>
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          "border-r border-b border-slate-200 p-0 dark:border-slate-700",
                          issueColumns.has(column.id) &&
                            "bg-red-100/80 ring-1 ring-inset ring-red-300 dark:bg-red-900/40 dark:ring-red-800",
                        )}
                        style={{ minWidth: column.minWidth }}
                        title={
                          issueColumns.has(column.id)
                            ? rowIssues
                                .filter((item) => item.columnId === column.id)
                                .map((item) => item.message)
                                .join("\n")
                            : undefined
                        }
                      >
                        <SheetCell
                          column={column}
                          row={row}
                          org1Options={org1Options}
                          org2Options={org2OptionsFor(row.values.orgLevel1)}
                          managerOptions={managerOptions}
                          formOptions={formOptions}
                          entities={entities}
                          createOrgLevelsReadOnly={createMode}
                          onChange={onChange}
                          disabled={disabled}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SheetCell({
  column,
  row,
  org1Options,
  org2Options,
  managerOptions,
  formOptions,
  entities,
  createOrgLevelsReadOnly = false,
  onChange,
  disabled,
}: {
  column: BulkUploadColumnDef;
  row: SheetRow;
  org1Options: { value: string; label: string }[];
  org2Options: { value: string; label: string }[];
  managerOptions: { value: string; label: string }[];
  formOptions: { value: string; label: string }[];
  entities: EntityRecord[];
  createOrgLevelsReadOnly?: boolean;
  onChange: (rowKey: string, columnId: BulkUploadColumnId, next: string) => void;
  disabled: boolean;
}) {
  const value = row.values[column.id];
  const dirty = row.isNew ? Boolean(value) : value !== row.original[column.id];
  const setValue = (next: string) => onChange(row.rowKey, column.id, next);
  const createEditable = row.isNew && isBulkUploadCreateField(column.id);
  const readOnly =
    !createEditable && (column.input === "readonly" || !column.persistable);

  if (
    createOrgLevelsReadOnly &&
    (column.id === "orgLevel1" || column.id === "orgLevel2")
  ) {
    return (
      <div
        className="max-h-16 overflow-hidden px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300"
        title={orgLevelDisplayLabel(value, entities)}
      >
        {orgLevelDisplayLabel(value, entities)}
      </div>
    );
  }

  if (readOnly) {
    return (
      <div
        className="max-h-16 overflow-hidden px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300"
        title={value}
      >
        {value || "—"}
      </div>
    );
  }

  if (column.id === "empCategory") {
    return (
      <SheetSelect
        id={`${row.rowKey}-${column.id}`}
        value={value}
        options={EMPLOYEE_CATEGORIES.map((category) => ({
          value: category,
          label: CATEGORY_LABELS[category],
        }))}
        onChange={setValue}
        disabled={disabled}
        dirty={dirty}
        emptyOptionLabel="—"
      />
    );
  }

  if (column.id === "empSubCategory") {
    const category = row.values.empCategory as EmployeeCategory;
    const options = CATEGORY_SUB_MAP[category] ?? [];
    return (
      <SheetSelect
        id={`${row.rowKey}-${column.id}`}
        value={value}
        options={options.map((sub) => ({
          value: sub,
          label: SUB_CATEGORY_LABELS[sub],
        }))}
        onChange={setValue}
        disabled={disabled}
        dirty={dirty}
        emptyOptionLabel="—"
      />
    );
  }

  if (column.id === "accountStatus") {
    return (
      <SheetSelect
        id={`${row.rowKey}-${column.id}`}
        value={value || "Active"}
        options={[
          { value: "Active", label: "Active" },
          { value: "Inactive", label: "Inactive" },
        ]}
        onChange={setValue}
        disabled={disabled}
        dirty={dirty}
      />
    );
  }

  if (column.input === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        rows={2}
        className={cn(
          "w-full min-w-0 resize-none border-0 bg-transparent px-2 py-1 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40 dark:text-slate-100 dark:focus:bg-slate-900",
          dirty && "bg-amber-50 dark:bg-amber-950/30",
        )}
      />
    );
  }

  if (column.input === "date") {
    return (
      <input
        type="date"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        className={cn(cellInputClassName, dirty && "bg-amber-50 dark:bg-amber-950/30")}
      />
    );
  }

  if (column.input === "text" || column.input === "number") {
    return (
      <input
        type={column.input === "number" ? "number" : "text"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        className={cn(cellInputClassName, dirty && "bg-amber-50 dark:bg-amber-950/30")}
      />
    );
  }

  if (column.id === "systemRole") {
    return (
      <SheetSelect
        id={`${row.rowKey}-${column.id}`}
        value={value}
        options={USER_ROLES.map((role) => ({
          value: role,
          label: USER_ROLE_LABELS[role],
        }))}
        onChange={setValue}
        disabled={disabled}
        dirty={dirty}
        emptyOptionLabel="—"
      />
    );
  }

  if (column.id === "assessmentEligibility") {
    return (
      <SheetSelect
        id={`${row.rowKey}-${column.id}`}
        value={value}
        options={[
          { value: "true", label: "Eligible" },
          { value: "false", label: "Not Eligible" },
        ]}
        onChange={setValue}
        disabled={disabled}
        dirty={dirty}
      />
    );
  }

  if (column.input === "org1" || column.input === "org2" || column.input === "manager" || column.input === "form") {
    const options =
      column.input === "org1"
        ? org1Options
        : column.input === "org2"
          ? org2Options
          : column.input === "form"
            ? formOptions
            : managerOptions;
    return (
      <SheetSelect
        id={`${row.rowKey}-${column.id}`}
        value={value}
        options={options}
        onChange={setValue}
        disabled={disabled}
        dirty={dirty}
        emptyOptionLabel="—"
      />
    );
  }

  return null;
}

function SheetSelect({
  id,
  value,
  options,
  onChange,
  disabled,
  dirty,
  emptyOptionLabel,
}: {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
  disabled: boolean;
  dirty: boolean;
  emptyOptionLabel?: string;
}) {
  return (
    <div className={cn("min-w-0 px-0.5 py-0.5", dirty && "bg-amber-50 dark:bg-amber-950/30")}>
      <SearchableSelect
        id={id}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        placeholder="—"
        emptyOptionLabel={emptyOptionLabel}
        className={sheetSelectClassName}
      />
    </div>
  );
}
