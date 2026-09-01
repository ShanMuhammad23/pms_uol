"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileBarChart, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { SearchableSelect } from "@/app/components/common/SearchableSelect";
import { buildCalibrationData } from "@/app/helpers/dashboard-calibration";
import {
  fetchOrgReportSubmissions,
  formatOrgEntityOptionLabel,
  resolveOrgReportCompletion,
  sortOrgEntitiesForPicker,
} from "@/app/helpers/dashboard-org-report";
import { downloadOrgCalibrationReport } from "@/app/helpers/dashboard-org-report-pdf";
import { buildRatingQuartileMatrix } from "@/app/helpers/dashboard-rating-matrix";
import {
  useActiveFinancialYearId,
  useFinancialYearsQuery,
  useInstitutionalQuotaChartQuery,
  useMatrixForDistribution,
  usePerformanceMatrixQuery,
} from "@/app/queries/performance";
import { useDashboardEntitiesQuery } from "@/app/queries/organization";
import { countEligibleSubmissions } from "@/app/helpers/dashboard-workflow-stats";
import { cn } from "@/lib/utils";

export function GenerateOrgReportButton() {
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
      <GenerateOrgReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface GenerateOrgReportModalProps {
  open: boolean;
  onClose: () => void;
}

function GenerateOrgReportModal({ open, onClose }: GenerateOrgReportModalProps) {
  const { data: entities = [], isLoading: entitiesLoading } =
    useDashboardEntitiesQuery();
  const { data: financialYears } = useFinancialYearsQuery();
  const activeFinancialYearId = useActiveFinancialYearId(financialYears);
  const { data: institutionalQuotaRows } =
    useInstitutionalQuotaChartQuery(activeFinancialYearId);
  const { data: performanceMatrix, isLoading: matrixLoading } =
    usePerformanceMatrixQuery(activeFinancialYearId);
  const matrixForDistribution = useMatrixForDistribution(performanceMatrix);

  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgOptions = useMemo(() => {
    return sortOrgEntitiesForPicker(entities).map((entity) => ({
      value: String(entity.id),
      label: formatOrgEntityOptionLabel(entity),
    }));
  }, [entities]);

  const selectedEntity = useMemo(
    () => entities.find((entity) => String(entity.id) === selectedEntityId) ?? null,
    [entities, selectedEntityId],
  );

  const handleClose = () => {
    if (isGenerating) return;
    setError(null);
    onClose();
  };

  const handleGenerate = async () => {
    if (!selectedEntity) {
      setError("Select an organization level to generate the report.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const submissions = await fetchOrgReportSubmissions(selectedEntity);
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

      await downloadOrgCalibrationReport({
        entity: selectedEntity,
        generatedAt: new Date(),
        completion,
        calibrationData,
        ratingQuartileMatrix,
      });
      onClose();
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
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-report-title"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-white/10">
              <div>
                <h3
                  id="org-report-title"
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                >
                  Generate calibration report
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Select an organization level. The PDF includes the rating curve
                  and distribution matrix for that org.
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

            <div className="space-y-4 px-5 py-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Organization level
                </span>
                <SearchableSelect
                  value={selectedEntityId}
                  options={orgOptions}
                  onChange={(next) => {
                    setSelectedEntityId(next);
                    setError(null);
                  }}
                  disabled={entitiesLoading || isGenerating}
                  placeholder={
                    entitiesLoading
                      ? "Loading organizations…"
                      : "Search by name or org level…"
                  }
                />
              </label>

              {error ? (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
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
                onClick={() => void handleGenerate()}
                disabled={!selectedEntity || isGenerating || matrixLoading}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileBarChart className="h-3.5 w-3.5" />
                )}
                {isGenerating ? "Generating PDF…" : "Download PDF"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
