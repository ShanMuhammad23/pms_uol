"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  ShieldAlert,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SearchableSelect } from "@/app/components/common/SearchableSelect";
import { filterManagerEligibleUsers } from "@/app/helpers/manager-eligibility";
import {
  BULK_UPLOAD_COLUMN_GROUPS,
  BULK_UPLOAD_SELECTABLE_COLUMNS,
  DEFAULT_BULK_UPLOAD_COLUMN_IDS,
  buildBulkUploadRowValues,
  bulkUploadGroupLabel,
  emptyBulkUploadRowValues,
  isBulkUploadCreateField,
  isOrg2UnderOrg1,
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
  type BulkUploadSaveGroup,
} from "@/app/helpers/bulk-upload-validation";
import {
  normalizeMappedExcelValue,
  parseExcelStaffSheet,
  sapLookupKey,
  suggestExcelColumnMapping,
  type ExcelColumnMapping,
  type ExcelSheetColumn,
  type ParsedExcelStaffSheet,
} from "@/app/helpers/bulk-upload-excel";
import {
  invalidateStaffListingQueries,
} from "@/app/helpers/dashboard-listing-cache";
import { queryKeys } from "@/app/queries/keys";
import { fetchDashboardEntities } from "@/lib/queries/entities-client";
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
  filterParams: DashboardFilterParams;
  masterFilters: MasterFilterState;
  onClose: () => void;
  onSuccess: () => void;
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
  filterParams,
  masterFilters,
  onClose,
  onSuccess,
}: BulkUploadStaffModalProps) {
  const queryClient = useQueryClient();
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [excelSheet, setExcelSheet] = useState<ParsedExcelStaffSheet | null>(null);
  const [columnMapping, setColumnMapping] = useState<ExcelColumnMapping>({});
  const [importedSapIds, setImportedSapIds] = useState<string[]>([]);
  const [importUnmatched, setImportUnmatched] = useState<string[]>([]);
  const [importParsing, setImportParsing] = useState(false);
  const [importDragOver, setImportDragOver] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedColumnIds, setSelectedColumnIds] = useState<Set<BulkUploadColumnId>>(
    () => new Set(DEFAULT_BULK_UPLOAD_COLUMN_IDS),
  );
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkStep, setCheckStep] = useState<BulkUploadCheckStepId>("collect");
  const [checkFailedStep, setCheckFailedStep] = useState<BulkUploadCheckStepId | null>(
    null,
  );
  const [checkResult, setCheckResult] = useState<BulkUploadCheckResult | null>(null);
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
    enabled: open,
  });

  const { data: entities } = useQuery({
    queryKey: queryKeys.entities,
    queryFn: fetchDashboardEntities,
    enabled: open,
  });

  const { data: users } = useQuery({
    queryKey: queryKeys.usersOverview,
    queryFn: fetchUsersOverview,
    enabled: open,
  });

  const { data: formTemplates } = useQuery({
    queryKey: ["form-templates"],
    queryFn: fetchFormTemplatesForDashboard,
    enabled: open,
  });

  const employees = pageData?.items ?? EMPTY_SUBMISSIONS;

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setImportFileName(null);
      setExcelSheet(null);
      setColumnMapping({});
      setImportedSapIds([]);
      setImportUnmatched([]);
      setImportParsing(false);
      setImportDragOver(false);
      setSelectedEmployeeIds(new Set());
      setSelectedColumnIds(new Set(DEFAULT_BULK_UPLOAD_COLUMN_IDS));
      setSheetRows([]);
      setError(null);
      setCheckOpen(false);
      setCheckFailedStep(null);
      setCheckResult(null);
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

  const matchedPeople = useMemo(() => {
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
  }, [selectedEmployeeIds, employees, usersByEmployeeId]);

  const applySapIds = useCallback(
    (sapIds: string[]) => {
      const bySap = new Map<string, FormSubmissionListItem>();
      for (const row of employees) {
        bySap.set(sapLookupKey(row.employeeId), row);
      }
      const byUserSap = new Map<string, UserRecord>();
      for (const user of users ?? []) {
        byUserSap.set(sapLookupKey(user.employeeId), user);
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
    },
    [employees, users],
  );

  useEffect(() => {
    if (importedSapIds.length === 0) {
      return;
    }
    applySapIds(importedSapIds);
  }, [importedSapIds, applySapIds]);

  const handleExcelFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setError(null);
    setImportParsing(true);
    try {
      const parsed = await parseExcelStaffSheet(file);
      setImportFileName(file.name);
      setExcelSheet(parsed);
      setColumnMapping(suggestExcelColumnMapping(parsed.columns));
      const sapIds = parsed.rows.map((row) => row.sap);
      setImportedSapIds(sapIds);
      applySapIds(sapIds);
    } catch (parseError) {
      setImportFileName(null);
      setExcelSheet(null);
      setColumnMapping({});
      setImportedSapIds([]);
      setSelectedEmployeeIds(new Set());
      setImportUnmatched([]);
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
      BULK_UPLOAD_SELECTABLE_COLUMNS.filter((column) =>
        selectedColumnIds.has(column.id),
      ),
    [selectedColumnIds],
  );

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
      new Set(BULK_UPLOAD_SELECTABLE_COLUMNS.map((column) => column.id)),
    );
  };

  const clearAllColumns = () => {
    setSelectedColumnIds(new Set());
  };

  const toggleColumnGroup = (group: BulkUploadColumnGroup) => {
    const groupIds = BULK_UPLOAD_SELECTABLE_COLUMNS.filter(
      (column) => column.group === group,
    ).map((column) => column.id);
    setSelectedColumnIds((current) => {
      const allSelected = groupIds.every((id) => current.has(id));
      const next = new Set(current);
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

    const entityList = entities ?? [];
    const excelBySap = new Map(
      excelSheet.rows.map((row) => [sapLookupKey(row.sap), row] as const),
    );
    const selected = employees.filter((row) =>
      selectedEmployeeIds.has(row.employeeId),
    );
    const listedIds = new Set(selected.map((row) => row.employeeId));

    const applyMappedValues = (
      employeeId: string,
      employeeName: string,
      sourceValues: RowValues,
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
      return {
        rowKey: employeeId,
        employeeId,
        employeeName: nextName,
        isNew: false,
        values,
        original,
      };
    };

    const existingRows = selected.map((row) =>
      applyMappedValues(
        row.employeeId,
        row.employeeName,
        buildBulkUploadRowValues(
          row,
          usersByEmployeeId.get(row.employeeId),
          entityList,
        ),
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
        return applyMappedValues(id, name, values);
      });

    setSheetRows([...existingRows, ...extraRows]);
  }, [
    excelSheet,
    columnMapping,
    selectedColumnIds,
    selectedEmployeeIds,
    employees,
    entities,
    usersByEmployeeId,
  ]);

  const updateCell = (
    rowKey: string,
    columnId: BulkUploadColumnId,
    nextValue: string,
  ) => {
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

  const closeChecks = () => {
    if (saveMutation.isPending) return;
    checkRunId.current += 1;
    setCheckOpen(false);
    setCheckFailedStep(null);
    setCheckResult(null);
  };

  const startSaveChecks = async () => {
    if (!hasImportedSheet || selectedEmployeeIds.size === 0) {
      setError("Upload an Excel file with a SAP column first.");
      return;
    }
    if (selectedColumnIds.size === 0) {
      setError("Select at least one column to update.");
      return;
    }

    const runId = ++checkRunId.current;
    const stillCurrent = () => checkRunId.current === runId;

    setError(null);
    setCheckOpen(true);
    setCheckFailedStep(null);
    setCheckResult(null);
    setCheckStep("collect");

    const formTemplateIds = new Set(
      (formTemplates ?? []).map((template) => String(template.id)),
    );
    const userList = users ?? [];
    const entityList = entities ?? [];

    await delay(280);
    if (!stillCurrent()) return;
    const collected = collectBulkUploadSaveGroups(sheetRows, selectedColumnIds);
    const creates = collectBulkUploadCreates(sheetRows);
    if (collected.changedRowCount === 0 && creates.length === 0) {
      setCheckFailedStep("collect");
      setCheckResult({
        ok: false,
        issues: [
          {
            employeeId: "",
            employeeName: "",
            message: "No cell values have changed and no new employees were added.",
          },
        ],
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
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-primary px-4 py-2 text-white dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <Upload className="size-4 shrink-0" aria-hidden="true" />
            <h2
              id="bulk-upload-staff-modal-title"
              className="text-sm font-semibold"
            >
              Bulk update &amp; upload
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close bulk upload"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="space-y-3">
            <section className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
              <EmployeeStep
                fileName={importFileName}
                parsing={importParsing}
                loadingStaff={employeesLoading}
                dragOver={importDragOver}
                matchedPeople={matchedPeople}
                unmatchedSaps={importUnmatched}
                onDragOverChange={setImportDragOver}
                onFile={handleExcelFile}
              />
            </section>
            {hasImportedSheet ? (
              <>
                <div className="grid items-start gap-3 lg:grid-cols-2">
                  <ColumnStep
                    selectedIds={selectedColumnIds}
                    onToggle={toggleColumn}
                    onSelectAll={selectAllColumns}
                    onClearAll={clearAllColumns}
                    onToggleGroup={toggleColumnGroup}
                  />
                  <MappingStep
                    columns={excelSheet?.columns ?? []}
                    mapping={columnMapping}
                    targets={selectedColumns}
                    onChange={setExcelTargetMapping}
                  />
                </div>
                <SheetStep
                  rows={sheetRows}
                  columns={selectedColumns}
                  org1Options={org1Options}
                  org2OptionsFor={org2OptionsFor}
                  managerOptions={managerSelectOptions}
                  formOptions={formSelectOptions}
                  onChange={updateCell}
                  disabled={saveMutation.isPending || checkOpen}
                />
              </>
            ) : null}
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error ? (
              <span className="font-medium text-red-600 dark:text-red-400">{error}</span>
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
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void startSaveChecks();
              }}
              disabled={
                !hasImportedSheet ||
                sheetRows.length === 0 ||
                saveMutation.isPending ||
                checkOpen
              }
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              Next
            </button>
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
                          . New logins use Welcome@{"{SAP}"}.
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
  onDragOverChange,
  onFile,
}: {
  fileName: string | null;
  parsing: boolean;
  loadingStaff: boolean;
  dragOver: boolean;
  matchedPeople: Array<{ employeeId: string; name: string }>;
  unmatchedSaps: string[];
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
          dragOver && "bg-slate-100 dark:bg-slate-800",
        )}
      >
        {parsing ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-slate-500" aria-hidden="true" />
        ) : (
          <FileSpreadsheet className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
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
        <span className="shrink-0 text-xs font-medium text-slate-600 underline-offset-2 hover:underline dark:text-slate-300">
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
          <span className="font-semibold tabular-nums">{matchedPeople.length}</span> matched
          <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
          <span className="font-semibold tabular-nums">{unmatchedSaps.length}</span> not found
          {unmatchedSaps.length > 0
            ? ` (${unmatchedSaps.slice(0, 8).join(", ")}${
                unmatchedSaps.length > 8 ? "…" : ""
              })`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

function ColumnStep({
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
  onToggleGroup,
}: {
  selectedIds: Set<BulkUploadColumnId>;
  onToggle: (id: BulkUploadColumnId) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onToggleGroup: (group: BulkUploadColumnGroup) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Columns to update
        </h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            All
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            None
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {BULK_UPLOAD_COLUMN_GROUPS.map((group) => {
          const columns = BULK_UPLOAD_SELECTABLE_COLUMNS.filter(
            (column) => column.group === group,
          );
          if (columns.length === 0) return null;
          const allSelected = columns.every((column) => selectedIds.has(column.id));
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
                {columns.map((column) => {
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
  columns,
  mapping,
  targets,
  onChange,
}: {
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
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Map Excel columns
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {mappedCount} mapped
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="border-b border-slate-200 px-3 py-1.5 font-medium dark:border-slate-700">
                Excel
              </th>
              <th className="border-b border-slate-200 px-3 py-1.5 font-medium dark:border-slate-700">
                Maps to
              </th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr
                key={column.index}
                className="border-b border-slate-200 last:border-b-0 dark:border-slate-700"
              >
                <td className="px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100">
                  <span className="font-medium">{column.header}</span>
                  {column.isSap ? (
                    <span className="ml-1.5 text-[10px] font-medium uppercase text-slate-400">
                      Match
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5">
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

function SheetStep({
  rows,
  columns,
  org1Options,
  org2OptionsFor,
  managerOptions,
  formOptions,
  onChange,
  disabled,
}: {
  rows: SheetRow[];
  columns: readonly BulkUploadColumnDef[];
  org1Options: { value: string; label: string }[];
  org2OptionsFor: (org1Id: string) => { value: string; label: string }[];
  managerOptions: { value: string; label: string }[];
  formOptions: { value: string; label: string }[];
  onChange: (rowKey: string, columnId: BulkUploadColumnId, next: string) => void;
  disabled: boolean;
}) {
  const changedCount = rows.filter((row) =>
    columns.some((column) => row.values[column.id] !== row.original[column.id]),
  ).length;

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Preview
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {rows.length} staff · {changedCount} with changes
        </p>
      </div>
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
                  No matched staff to preview.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.rowKey}
                  className={
                    index % 2 === 0
                      ? "bg-white dark:bg-slate-950"
                      : "bg-slate-50 dark:bg-slate-900/60"
                  }
                >
                  <td className="sticky left-0 z-10 border-r border-b border-slate-200 bg-inherit px-3 py-1 text-xs font-semibold tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    {row.employeeId}
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className="border-r border-b border-slate-200 p-0 dark:border-slate-700"
                      style={{ minWidth: column.minWidth }}
                    >
                      <SheetCell
                        column={column}
                        row={row}
                        org1Options={org1Options}
                        org2Options={org2OptionsFor(row.values.orgLevel1)}
                        managerOptions={managerOptions}
                        formOptions={formOptions}
                        onChange={onChange}
                        disabled={disabled}
                      />
                    </td>
                  ))}
                </tr>
              ))
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
  onChange,
  disabled,
}: {
  column: BulkUploadColumnDef;
  row: SheetRow;
  org1Options: { value: string; label: string }[];
  org2Options: { value: string; label: string }[];
  managerOptions: { value: string; label: string }[];
  formOptions: { value: string; label: string }[];
  onChange: (rowKey: string, columnId: BulkUploadColumnId, next: string) => void;
  disabled: boolean;
}) {
  const value = row.values[column.id];
  const dirty = row.isNew ? Boolean(value) : value !== row.original[column.id];
  const setValue = (next: string) => onChange(row.rowKey, column.id, next);
  const createEditable = row.isNew && isBulkUploadCreateField(column.id);
  const readOnly =
    !createEditable && (column.input === "readonly" || !column.persistable);

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
