"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, Eye, FileBarChart, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardFilterBar } from "@/app/components/dashboard/DashboardFilterBar";
import type { ActiveFilter } from "@/app/components/dashboard/DashboardFilterBar";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import { buildCalibrationData } from "@/app/helpers/dashboard-calibration";
import {
  ENTITY_FILTER_LEVELS,
  getEntitiesForFilterLevels,
  pruneMultiSelection,
} from "@/app/helpers/dashboard-entity-filters";
import {
  FORM_STATE_CONFIG,
  FORM_STATE_IDS,
} from "@/app/helpers/dashboard-form-state";
import {
  buildOrgReportStaffRows,
  cloneDashboardFilterParams,
  fetchOrgReportSubmissions,
  formatReportFilterSummary,
  resolveOrgReportCompletion,
  resolveReportOrgTitle,
} from "@/app/helpers/dashboard-org-report";
import {
  buildOrgCalibrationReport,
  downloadReportBlob,
} from "@/app/helpers/dashboard-org-report-pdf";
import { buildRatingQuartileMatrix } from "@/app/helpers/dashboard-rating-matrix";
import { countEligibleSubmissions } from "@/app/helpers/dashboard-workflow-stats";
import {
  useActiveFinancialYearId,
  useFinancialYearsQuery,
  useInstitutionalQuotaChartQuery,
  useMatrixForDistribution,
  usePerformanceMatrixQuery,
} from "@/app/queries/performance";
import { useDashboardOverviewQuery } from "@/app/queries/forms";
import {
  useDashboardEntitiesQuery,
  useUniqueDesignationsQuery,
} from "@/app/queries/organization";
import type { DashboardFilterParams } from "@/types/dashboard-api";
import type { FormState } from "@/app/helpers/dashboard-types";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface GenerateOrgReportButtonProps {
  /** Current dashboard filters — used as the starting point in the dialog. */
  initialFilters?: DashboardFilterParams;
}

export function GenerateOrgReportButton({
  initialFilters,
}: GenerateOrgReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
      >
        <FileBarChart className="h-3.5 w-3.5" />
        Generate Report
      </button>
      <GenerateOrgReportModal
        open={open}
        initialFilters={initialFilters}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

interface GenerateOrgReportModalProps {
  open: boolean;
  initialFilters?: DashboardFilterParams;
  onClose: () => void;
}

function idsToStrings(ids: number[] | null): string[] | null {
  return ids === null ? null : ids.map(String);
}

function stringsToIds(values: string[] | null): number[] | null {
  return values === null ? null : values.map(Number);
}

function idsEqual(left: number[] | null, right: number[] | null): boolean {
  if (left === right) return true;
  if (left === null || right === null) return false;
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

function mergeCountOptions(
  options: MultiSelectOption[],
  counts: Array<{ value: string; count: number }> | undefined,
  keepZero = false,
): MultiSelectOption[] {
  const countByValue = new Map(
    (counts ?? []).map((row) => [row.value, row.count]),
  );
  const merged = options.map((option) => ({
    ...option,
    count: countByValue.get(option.value) ?? 0,
  }));
  if (keepZero) {
    for (const row of counts ?? []) {
      if (!merged.some((option) => option.value === row.value)) {
        merged.push({
          value: row.value,
          label: row.value,
          count: row.count,
        });
      }
    }
  }
  return merged;
}

function GenerateOrgReportModal({
  open,
  initialFilters,
  onClose,
}: GenerateOrgReportModalProps) {
  const { data: entities = [], isLoading: entitiesLoading } =
    useDashboardEntitiesQuery();
  const { data: designations = [], isLoading: designationsLoading } =
    useUniqueDesignationsQuery();
  const { data: financialYears } = useFinancialYearsQuery();
  const activeFinancialYearId = useActiveFinancialYearId(financialYears);
  const { data: institutionalQuotaRows } =
    useInstitutionalQuotaChartQuery(activeFinancialYearId);
  const { data: performanceMatrix, isLoading: matrixLoading } =
    usePerformanceMatrixQuery(activeFinancialYearId);
  const matrixForDistribution = useMatrixForDistribution(performanceMatrix);

  const [filters, setFilters] = useState<DashboardFilterParams>(() =>
    cloneDashboardFilterParams(initialFilters),
  );
  const [includeSalary, setIncludeSalary] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const { data: overview, isLoading: overviewLoading } =
    useDashboardOverviewQuery(filters);

  const clearPreview = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setPreviewBlob(null);
    setPreviewFileName(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    setFilters(cloneDashboardFilterParams(initialFilters));
    setIncludeSalary(false);
    setError(null);
    clearPreview();
  }, [open, initialFilters, clearPreview]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const category0Entities = useMemo(
    () => getEntitiesForFilterLevels(entities, 0, null),
    [entities],
  );
  const category1Entities = useMemo(
    () =>
      getEntitiesForFilterLevels(entities, 1, filters.category0EntityIds),
    [entities, filters.category0EntityIds],
  );
  const category2Entities = useMemo(
    () =>
      getEntitiesForFilterLevels(entities, 2, filters.category1EntityIds),
    [entities, filters.category1EntityIds],
  );

  useEffect(() => {
    if (entitiesLoading || entities.length === 0) return;
    setFilters((current) => {
      const nextC1 = pruneMultiSelection(
        current.category1EntityIds,
        category1Entities.map((entity) => entity.id),
      );
      const nextC2 = pruneMultiSelection(
        current.category2EntityIds,
        category2Entities.map((entity) => entity.id),
      );
      if (
        idsEqual(nextC1, current.category1EntityIds) &&
        idsEqual(nextC2, current.category2EntityIds)
      ) {
        return current;
      }
      return {
        ...current,
        category1EntityIds: nextC1,
        category2EntityIds: nextC2,
      };
    });
  }, [category1Entities, category2Entities, entitiesLoading, entities.length]);

  const category0Options = useMemo(
    () =>
      mergeCountOptions(
        category0Entities.map((entity) => ({
          value: String(entity.id),
          label: entity.name,
          count: 0,
        })),
        overview?.filters.category0,
      ),
    [category0Entities, overview?.filters.category0],
  );

  const category0DistributionOptions = useMemo(() => {
    const visible =
      filters.category0EntityIds !== null &&
        filters.category0EntityIds.length > 0
        ? category0Entities.filter((entity) =>
          filters.category0EntityIds?.includes(entity.id),
        )
        : category0Entities;
    return mergeCountOptions(
      visible.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: 0,
      })),
      overview?.filters.category0Distribution,
    ).filter((option) => option.count > 0);
  }, [
    category0Entities,
    filters.category0EntityIds,
    overview?.filters.category0Distribution,
  ]);

  const category1Options = useMemo(
    () =>
      mergeCountOptions(
        category1Entities.map((entity) => ({
          value: String(entity.id),
          label: entity.name,
          count: 0,
        })),
        overview?.filters.category1,
      ),
    [category1Entities, overview?.filters.category1],
  );

  const category2Options = useMemo(
    () =>
      mergeCountOptions(
        category2Entities.map((entity) => ({
          value: String(entity.id),
          label: entity.name,
          count: 0,
        })),
        overview?.filters.category2,
      ),
    [category2Entities, overview?.filters.category2],
  );

  const roleCategoryOptions = useMemo(
    () =>
      mergeCountOptions(
        (filters.roleCategories ?? []).map((value) => ({
          value,
          label: value,
          count: 0,
        })),
        overview?.filters.roleCategories,
        true,
      ),
    [filters.roleCategories, overview?.filters.roleCategories],
  );

  const designationOptions = useMemo(
    () =>
      mergeCountOptions(
        designations.map((designation) => ({
          value: designation,
          label: designation,
          count: 0,
        })),
        overview?.filters.designations,
      ).filter((option) => option.count > 0 || filters.designations?.includes(option.value)),
    [designations, overview?.filters.designations, filters.designations],
  );

  const formStateOptions = useMemo(
    () =>
      mergeCountOptions(
        FORM_STATE_IDS.map((state) => ({
          value: state,
          label: FORM_STATE_CONFIG[state].label,
          count: 0,
        })),
        overview?.filters.formStates,
      ),
    [overview?.filters.formStates],
  );

  const bumpFilters = useCallback(
    (patch: Partial<DashboardFilterParams>) => {
      setFilters((current) => ({ ...current, ...patch }));
      setError(null);
      clearPreview();
    },
    [clearPreview],
  );

  const activeFilters = useMemo(() => {
    const chips: ActiveFilter[] = [];
    const pushEntityChip = (
      prefix: string,
      ids: number[] | null,
      onRemove: () => void,
    ) => {
      if (ids === null) return;
      const names = ids.map(
        (id) => entities.find((entity) => entity.id === id)?.name ?? String(id),
      );
      chips.push({
        label:
          names.length === 1
            ? `${prefix}: ${names[0]}`
            : `${prefix}: ${names.length} selected`,
        onRemove,
        color: "slate",
      });
    };

    pushEntityChip(ENTITY_FILTER_LEVELS[0].label, filters.category0EntityIds, () =>
      bumpFilters({ category0EntityIds: null }),
    );
    pushEntityChip(ENTITY_FILTER_LEVELS[1].label, filters.category1EntityIds, () =>
      bumpFilters({ category1EntityIds: null }),
    );
    pushEntityChip(ENTITY_FILTER_LEVELS[2].label, filters.category2EntityIds, () =>
      bumpFilters({ category2EntityIds: null }),
    );

    if (filters.roleCategories !== null) {
      chips.push({
        label:
          filters.roleCategories.length === 1
            ? `Role Category: ${filters.roleCategories[0]}`
            : `Role Category: ${filters.roleCategories.length} selected`,
        onRemove: () => bumpFilters({ roleCategories: null }),
        color: "amber",
      });
    }
    if (filters.designations !== null) {
      chips.push({
        label:
          filters.designations.length === 1
            ? `Designation: ${filters.designations[0]}`
            : `Designation: ${filters.designations.length} selected`,
        onRemove: () => bumpFilters({ designations: null }),
        color: "emerald",
      });
    }
    if (filters.formStates !== null) {
      chips.push({
        label:
          filters.formStates.length === 1
            ? `State: ${FORM_STATE_CONFIG[filters.formStates[0]]?.label ?? filters.formStates[0]}`
            : `State: ${filters.formStates.length} selected`,
        onRemove: () => bumpFilters({ formStates: null }),
        color: "orange",
      });
    }
    return chips;
  }, [filters, entities, bumpFilters]);

  const handleClose = () => {
    if (isGenerating) return;
    setError(null);
    onClose();
  };

  const buildReport = async () => {
    const submissions = await fetchOrgReportSubmissions(filters);
    const completion = resolveOrgReportCompletion(submissions);
    const calibrationData = buildCalibrationData(
      submissions,
      institutionalQuotaRows,
      countEligibleSubmissions(submissions),
    );
    const ratingQuartileMatrix = buildRatingQuartileMatrix(
      submissions,
      matrixForDistribution,
    );
    const orgTitle = resolveReportOrgTitle(filters, entities);
    return buildOrgCalibrationReport({
      orgTitle,
      filterSummary: formatReportFilterSummary(filters, entities),
      generatedAt: new Date(),
      includeSalary,
      completion,
      calibrationData,
      ratingQuartileMatrix,
      staffRows: buildOrgReportStaffRows(submissions),
    });
  };

  const handlePreview = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const { blob, fileName } = await buildReport();
      clearPreview();
      const url = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewFileName(fileName);
      setPreviewUrl(url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to generate the report preview. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (previewBlob && previewFileName) {
      downloadReportBlob(previewBlob, previewFileName);
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const { blob, fileName } = await buildReport();
      downloadReportBlob(blob, fileName);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to generate the report. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-report-title"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-white/10">
              <div>
                <h3
                  id="org-report-title"
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                >
                  Generate performance report
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Filter by organization the same way as the dashboard, choose
                  whether to include salary, then preview before downloading.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isGenerating}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <DashboardFilterBar
                embedded
                selectedCategory0EntityIds={idsToStrings(filters.category0EntityIds)}
                onCategory0EntityChange={(values) =>
                  bumpFilters({ category0EntityIds: stringsToIds(values) })
                }
                selectedCategory1EntityIds={idsToStrings(filters.category1EntityIds)}
                onCategory1EntityChange={(values) =>
                  bumpFilters({ category1EntityIds: stringsToIds(values) })
                }
                selectedCategory2EntityIds={idsToStrings(filters.category2EntityIds)}
                onCategory2EntityChange={(values) =>
                  bumpFilters({ category2EntityIds: stringsToIds(values) })
                }
                category0Options={category0Options}
                category0DistributionOptions={category0DistributionOptions}
                onCategory0DistributionSelect={(value) => {
                  const id = Number(value);
                  const current = filters.category0EntityIds;
                  if (current !== null && current.length === 1 && current[0] === id) {
                    bumpFilters({ category0EntityIds: null });
                    return;
                  }
                  bumpFilters({ category0EntityIds: [id] });
                }}
                category1Options={category1Options}
                category2Options={category2Options}
                selectedRoleCategories={filters.roleCategories}
                onRoleCategoryChange={(values) =>
                  bumpFilters({ roleCategories: values })
                }
                roleCategoryOptions={roleCategoryOptions}
                selectedDesignations={filters.designations}
                onDesignationChange={(values) =>
                  bumpFilters({ designations: values })
                }
                designationOptions={designationOptions}
                designationsLoading={designationsLoading || overviewLoading}
                selectedFormStates={
                  filters.formStates === null
                    ? null
                    : filters.formStates.map(String)
                }
                onFormStateChange={(values) =>
                  bumpFilters({
                    formStates:
                      values === null ? null : (values as FormState[]),
                    cardFilter: null,
                  })
                }
                formStateOptions={formStateOptions}
                entitiesLoading={entitiesLoading || overviewLoading}
                activeFilters={activeFilters}
                onClearAllFilters={() =>
                  bumpFilters(cloneDashboardFilterParams())
                }
              />

              <fieldset className="mt-4">
                <legend className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Salary in staff listing
                </legend>
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeSalary(false);
                      clearPreview();
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                      !includeSalary
                        ? "bg-primary text-white"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5",
                    )}
                  >
                    Without salary
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeSalary(true);
                      clearPreview();
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                      includeSalary
                        ? "bg-primary text-white"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5",
                    )}
                  >
                    With salary
                  </button>
                </div>
              </fieldset>

              {error ? (
                <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}

              <div className="mt-4 min-h-80 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950">
                {isGenerating ? (
                  <div className="flex h-80 flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                    <Image src='/Ai-powered marketing tools abstract.svg' alt='Loading' width={260} height={120} />
                    <p className="text-xs font-medium">Building report preview…</p>
                  </div>
                ) : previewUrl ? (
                  <iframe
                    title="Performance report preview"
                    src={`${previewUrl}#toolbar=0&navpanes=0`}
                    className="h-[min(52vh,36rem)] w-full bg-white"
                  />
                ) : (
                  <div className="flex h-80 flex-col items-center justify-center gap-1 px-6 text-center">
                    <Image src='/Business Grow Lottie Animation.svg' alt='Preview' width={120} height={64} />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Preview the report before downloading
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Apply org filters, choose salary inclusion, then generate a
                      preview of the Performance Report PDF.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
              <button
                type="button"
                onClick={handleClose}
                disabled={isGenerating}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handlePreview()}
                disabled={isGenerating || matrixLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/10"
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {isGenerating ? "Generating…" : "Show preview"}
              </button>
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={isGenerating || matrixLoading || !previewBlob}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
