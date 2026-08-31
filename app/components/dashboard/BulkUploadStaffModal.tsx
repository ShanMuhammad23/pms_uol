"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, CheckCircle2, Loader2, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SearchableSelect } from "@/app/components/common/SearchableSelect";
import { filterManagerEligibleUsers } from "@/app/helpers/manager-eligibility";
import {
  BULK_UPLOAD_COLUMN_GROUPS,
  BULK_UPLOAD_COLUMNS,
  CREATE_REQUIRED_COLUMN_IDS,
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

type WizardStep = 1 | 2 | 3;

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

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Employees" },
  { id: 2, label: "Columns" },
  { id: 3, label: "Edit values" },
];

const SECTION_STYLE: Record<BulkUploadColumnGroup, string> = {
  basic:
    "bg-slate-100 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50",
  performance:
    "bg-emerald-100 border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-700/50",
  compensation:
    "bg-amber-100 border-amber-200 dark:bg-amber-900/40 dark:border-amber-700/50",
};

const cellInputClassName =
  "h-8 w-full min-w-0 border-0 bg-transparent px-2 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40 dark:text-slate-100 dark:focus:bg-slate-900";

const sheetSelectClassName =
  "[&_button]:h-7 [&_button]:rounded-md [&_button]:px-2 [&_button]:py-0 [&_button]:text-xs [&_button]:focus:ring-1";

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
  const [step, setStep] = useState<WizardStep>(1);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedColumnIds, setSelectedColumnIds] = useState<Set<BulkUploadColumnId>>(
    () => new Set(DEFAULT_BULK_UPLOAD_COLUMN_IDS),
  );
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectionSeeded, setSelectionSeeded] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkStep, setCheckStep] = useState<BulkUploadCheckStepId>("collect");
  const [checkFailedStep, setCheckFailedStep] = useState<BulkUploadCheckStepId | null>(
    null,
  );
  const [checkResult, setCheckResult] = useState<BulkUploadCheckResult | null>(null);
  const checkRunId = useRef(0);
  const newRowSeq = useRef(0);

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

  const employees = pageData?.items ?? [];

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep(1);
      setEmployeeSearch("");
      setSelectedEmployeeIds(new Set());
      setSelectedColumnIds(new Set(DEFAULT_BULK_UPLOAD_COLUMN_IDS));
      setSheetRows([]);
      setError(null);
      setSelectionSeeded(false);
      setCheckOpen(false);
      setCheckFailedStep(null);
      setCheckResult(null);
      checkRunId.current += 1;
      newRowSeq.current = 0;
    }
  }

  if (open && !selectionSeeded && employees.length > 0) {
    setSelectedEmployeeIds(new Set(employees.map((row) => row.employeeId)));
    setSelectionSeeded(true);
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

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((row) => {
      return (
        row.employeeName.toLowerCase().includes(query) ||
        row.employeeId.toLowerCase().includes(query)
      );
    });
  }, [employees, employeeSearch]);

  const hasNewRows = sheetRows.some((row) => row.isNew);
  const selectedColumns = useMemo(() => {
    const ids = new Set(selectedColumnIds);
    if (hasNewRows) {
      for (const id of CREATE_REQUIRED_COLUMN_IDS) ids.add(id);
    }
    return BULK_UPLOAD_COLUMNS.filter((column) => ids.has(column.id));
  }, [selectedColumnIds, hasNewRows]);

  const allFilteredSelected =
    filteredEmployees.length > 0 &&
    filteredEmployees.every((row) => selectedEmployeeIds.has(row.employeeId));
  const someFilteredSelected =
    !allFilteredSelected &&
    filteredEmployees.some((row) => selectedEmployeeIds.has(row.employeeId));

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        for (const row of filteredEmployees) next.delete(row.employeeId);
      } else {
        for (const row of filteredEmployees) next.add(row.employeeId);
      }
      return next;
    });
  };

  const toggleColumn = (id: BulkUploadColumnId) => {
    setSelectedColumnIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllColumns = () => {
    setSelectedColumnIds(new Set(BULK_UPLOAD_COLUMNS.map((column) => column.id)));
  };

  const clearAllColumns = () => {
    setSelectedColumnIds(new Set());
  };

  const toggleColumnGroup = (group: BulkUploadColumnGroup) => {
    const groupIds = BULK_UPLOAD_COLUMNS.filter((column) => column.group === group).map(
      (column) => column.id,
    );
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

  const buildSheet = () => {
    const entityList = entities ?? [];
    const selected = employees.filter((row) =>
      selectedEmployeeIds.has(row.employeeId),
    );
    const previousExisting = new Map(
      sheetRows.filter((row) => !row.isNew).map((row) => [row.rowKey, row]),
    );
    const previousNew = sheetRows.filter((row) => row.isNew);
    const existingRows = selected.map((row) => {
      const values = buildBulkUploadRowValues(
        row,
        usersByEmployeeId.get(row.employeeId),
        entityList,
      );
      const previous = previousExisting.get(row.employeeId);
      if (!previous) {
        return {
          rowKey: row.employeeId,
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          isNew: false,
          values,
          original: { ...values },
        };
      }
      const merged = { ...values };
      for (const column of selectedColumns) {
        if (previous.values[column.id] !== previous.original[column.id]) {
          merged[column.id] = previous.values[column.id];
        }
      }
      return {
        rowKey: row.employeeId,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        isNew: false,
        values: merged,
        original: values,
      };
    });
    setSheetRows([...existingRows, ...previousNew]);
  };

  const addNewEmployeeRow = () => {
    newRowSeq.current += 1;
    const values = emptyBulkUploadRowValues();
    setSheetRows((current) => [
      ...current,
      {
        rowKey: `new-${newRowSeq.current}`,
        employeeId: "",
        employeeName: "",
        isNew: true,
        values,
        original: { ...values },
      },
    ]);
    setSelectedColumnIds((current) => {
      const next = new Set(current);
      for (const id of CREATE_REQUIRED_COLUMN_IDS) next.add(id);
      return next;
    });
  };

  const removeNewEmployeeRow = (rowKey: string) => {
    setSheetRows((current) => current.filter((row) => row.rowKey !== rowKey));
  };

  const goNext = () => {
    setError(null);
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (selectedColumnIds.size === 0 && selectedEmployeeIds.size > 0) {
        setError("Select at least one column.");
        return;
      }
      if (selectedColumnIds.size === 0) {
        setSelectedColumnIds(
          new Set([...DEFAULT_BULK_UPLOAD_COLUMN_IDS, ...CREATE_REQUIRED_COLUMN_IDS]),
        );
      }
      buildSheet();
      setStep(3);
    }
  };

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

  const updateIdentity = (rowKey: string, employeeId: string) => {
    setSheetRows((current) =>
      current.map((row) =>
        row.rowKey === rowKey ? { ...row, employeeId } : row,
      ),
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
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-slate-800 text-white dark:bg-amber-600">
              <Upload className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="bulk-upload-staff-modal-title"
                className="text-sm font-semibold text-slate-900 dark:text-white"
              >
                Bulk update & upload
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update existing staff or add new employees on the same sheet.
              </p>
            </div>
          </div>
          <ol className="hidden items-center gap-2 md:flex">
            {STEPS.map((item, index) => (
              <li key={item.id} className="flex items-center gap-2">
                {index > 0 ? (
                  <span className="h-px w-8 bg-slate-200 dark:bg-slate-700" />
                ) : null}
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    step === item.id
                      ? "bg-slate-800 text-white dark:bg-amber-600"
                      : step > item.id
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                  )}
                >
                  {step > item.id ? (
                    <Check className="size-3" aria-hidden="true" />
                  ) : (
                    <span>{item.id}</span>
                  )}
                  {item.label}
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/10 dark:hover:bg-white/10"
            aria-label="Close bulk upload"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {step === 1 ? (
            <EmployeeStep
              employees={filteredEmployees}
              totalCount={employees.length}
              isLoading={employeesLoading}
              search={employeeSearch}
              onSearchChange={setEmployeeSearch}
              selectedIds={selectedEmployeeIds}
              allFilteredSelected={allFilteredSelected}
              someFilteredSelected={someFilteredSelected}
              onToggle={toggleEmployee}
              onToggleAll={toggleSelectAllFiltered}
            />
          ) : null}
          {step === 2 ? (
            <ColumnStep
              selectedIds={selectedColumnIds}
              onToggle={toggleColumn}
              onSelectAll={selectAllColumns}
              onClearAll={clearAllColumns}
              onToggleGroup={toggleColumnGroup}
            />
          ) : null}
          {step === 3 ? (
            <SheetStep
              rows={sheetRows}
              columns={selectedColumns}
              org1Options={org1Options}
              org2OptionsFor={org2OptionsFor}
              managerOptions={managerSelectOptions}
              formOptions={formSelectOptions}
              onChange={updateCell}
              onIdentityChange={updateIdentity}
              onAddRow={addNewEmployeeRow}
              onRemoveRow={removeNewEmployeeRow}
              disabled={saveMutation.isPending || checkOpen}
            />
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error ? (
              <span className="font-medium text-red-600 dark:text-red-400">{error}</span>
            ) : step === 1 ? (
              `${selectedEmployeeIds.size} of ${employees.length} existing employees selected`
            ) : step === 2 ? (
              `${selectedColumnIds.size} columns selected`
            ) : (
              `${sheetRows.filter((row) => !row.isNew).length} existing · ${sheetRows.filter((row) => row.isNew).length} new · ${selectedColumns.length} columns`
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
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep((current) => (current === 3 ? 2 : 1));
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Back
              </button>
            ) : null}
            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void startSaveChecks();
                }}
                disabled={saveMutation.isPending || checkOpen}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                Save changes
              </button>
            )}
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
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-white/10">
              <h3
                id="bulk-upload-save-checks-title"
                className="text-sm font-semibold text-slate-900 dark:text-white"
              >
                Review changes
              </h3>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white"
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
                          "mx-auto flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
                          isFailed
                            ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                            : isComplete
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : isCurrent
                                ? "bg-slate-800 text-white dark:bg-amber-600"
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
                        )}
                      >
                        {isFailed ? (
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                        ) : isComplete ? (
                          <Check className="size-3.5" aria-hidden="true" />
                        ) : isCurrent ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <p
                        className={cn(
                          "mt-1 truncate text-[10px] font-medium",
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
                <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {saving
                    ? "Saving changes…"
                    : hasFailed
                      ? `${current.title} failed`
                      : readyToSave
                        ? "Checks passed. Confirm to save."
                        : current.description}
                </p>
              </div>

              {result && !result.ok ? (
                <div className="max-h-48 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">
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
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs text-emerald-800 dark:text-emerald-200">
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
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{saveError}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                {hasFailed ? "Close" : "Cancel"}
              </button>
              {readyToSave || saving ? (
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={!readyToSave || saving}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
                >
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
  employees,
  totalCount,
  isLoading,
  search,
  onSearchChange,
  selectedIds,
  allFilteredSelected,
  someFilteredSelected,
  onToggle,
  onToggleAll,
}: {
  employees: FormSubmissionListItem[];
  totalCount: number;
  isLoading: boolean;
  search: string;
  onSearchChange: (next: string) => void;
  selectedIds: Set<string>;
  allFilteredSelected: boolean;
  someFilteredSelected: boolean;
  onToggle: (employeeId: string) => void;
  onToggleAll: () => void;
}) {
  return (
    <div className=" space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Select existing employees to update. You can add new employees on the spreadsheet in the next steps.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name or SAP"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-primary/40 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = someFilteredSelected;
                  }}
                  onChange={onToggleAll}
                  disabled={employees.length === 0}
                  aria-label="Select all filtered employees"
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/40"
                />
              </th>
              <th className="px-3 py-2">SAP</th>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Designation</th>
              <th className="px-3 py-2">ORG Level 1</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                  Loading employees…
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                  No employees match the current master filters.
                </td>
              </tr>
            ) : (
              employees.map((row) => (
                <tr
                  key={row.employeeId}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.employeeId)}
                      onChange={() => onToggle(row.employeeId)}
                      aria-label={`Select ${row.employeeName}`}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/40"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium tabular-nums text-slate-700 dark:text-slate-300">
                    {row.employeeId}
                  </td>
                  <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                    {row.employeeName}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {row.designation ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {row.orgLevel1Name ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Showing {employees.length} of {totalCount} employees in the current filter.
      </p>
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
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Choose columns for the spreadsheet. SAP ID is always included.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        {BULK_UPLOAD_COLUMN_GROUPS.map((group) => {
          const columns = BULK_UPLOAD_COLUMNS.filter((column) => column.group === group);
          const allSelected = columns.every((column) => selectedIds.has(column.id));
          return (
            <section
              key={group}
              className={cn("min-w-0 rounded-lg border p-3", SECTION_STYLE[group])}
            >
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2 dark:border-white/10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {bulkUploadGroupLabel(group)}
                </h3>
                <button
                  type="button"
                  onClick={() => onToggleGroup(group)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {allSelected ? "Clear" : "Select"}
                </button>
              </div>
              <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {columns.map((column) => {
                  const checked = selectedIds.has(column.id);
                  return (
                    <label
                      key={column.id}
                      className={cn(
                        "flex min-w-0 cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                        checked
                          ? "border-slate-300 bg-white dark:border-white/15 dark:bg-slate-950/50"
                          : "border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-slate-950/40",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(column.id)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-primary focus:ring-1 focus:ring-primary/40"
                      />
                      <span className="min-w-0 truncate" title={column.label}>
                        {column.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
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
  onIdentityChange,
  onAddRow,
  onRemoveRow,
  disabled,
}: {
  rows: SheetRow[];
  columns: readonly BulkUploadColumnDef[];
  org1Options: { value: string; label: string }[];
  org2OptionsFor: (org1Id: string) => { value: string; label: string }[];
  managerOptions: { value: string; label: string }[];
  formOptions: { value: string; label: string }[];
  onChange: (rowKey: string, columnId: BulkUploadColumnId, next: string) => void;
  onIdentityChange: (rowKey: string, employeeId: string) => void;
  onAddRow: () => void;
  onRemoveRow: (rowKey: string) => void;
  disabled: boolean;
}) {
  const sheetColumns = columns.filter((column) => column.id !== "employeeName");
  const addColSpan = sheetColumns.length + 3;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        New rows create employees. Existing rows only update selected columns.
      </p>
      <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-800 text-white dark:bg-slate-900">
              <th className="sticky left-0 z-20 whitespace-nowrap border-r border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold dark:bg-slate-900">
                SAP
              </th>
              <th className="whitespace-nowrap border-r border-slate-700 px-3 py-2 text-xs font-semibold">
                Employee
              </th>
              {sheetColumns.map((column) => (
                <th
                  key={column.id}
                  className="whitespace-nowrap border-r border-slate-700 px-3 py-2 text-xs font-semibold"
                  style={{ minWidth: column.minWidth }}
                >
                  {column.label}
                </th>
              ))}
              <th className="w-10 px-2 py-2 text-xs font-semibold"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.rowKey}
                className={cn(
                  row.isNew
                    ? "bg-sky-50/80 dark:bg-sky-950/20"
                    : index % 2 === 0
                      ? "bg-white dark:bg-slate-950"
                      : "bg-slate-50 dark:bg-slate-900/60",
                )}
              >
                <td className="sticky left-0 z-10 border-r border-b border-slate-200 bg-inherit p-0 dark:border-slate-700">
                  {row.isNew ? (
                    <input
                      value={row.employeeId}
                      onChange={(event) =>
                        onIdentityChange(row.rowKey, event.target.value)
                      }
                      disabled={disabled}
                      placeholder="SAP"
                      className={cn(cellInputClassName, "font-semibold tabular-nums")}
                    />
                  ) : (
                    <div className="px-3 py-1 text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {row.employeeId}
                    </div>
                  )}
                </td>
                <td className="border-r border-b border-slate-200 p-0 dark:border-slate-700">
                  {row.isNew ? (
                    <input
                      value={row.employeeName}
                      onChange={(event) =>
                        onChange(row.rowKey, "employeeName", event.target.value)
                      }
                      disabled={disabled}
                      placeholder="First Last"
                      className={cellInputClassName}
                    />
                  ) : (
                    <div className="px-3 py-1 text-xs text-slate-600 dark:text-slate-300">
                      {row.employeeName}
                    </div>
                  )}
                </td>
                {sheetColumns.map((column) => (
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
                <td className="border-b border-slate-200 px-1 py-1 dark:border-slate-700">
                  {row.isNew ? (
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row.rowKey)}
                      disabled={disabled}
                      className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
                      aria-label="Remove new employee"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            <tr>
              <td
                colSpan={addColSpan}
                className="bg-white px-2 py-1.5 dark:bg-slate-950"
              >
                <button
                  type="button"
                  onClick={onAddRow}
                  disabled={disabled}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add employee
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
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
