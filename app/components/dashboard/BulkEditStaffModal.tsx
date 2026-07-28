"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pencil, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelStaffListingQueries,
  getStaffListingSnapshots,
  invalidateStaffListingQueries,
  patchStaffListingCaches,
  restoreStaffListingSnapshots,
} from "@/app/helpers/dashboard-listing-cache";
import { queryKeys } from "@/app/queries/keys";
import { bulkUpdateEmployeeListingFields } from "@/lib/queries/form-submissions-client";
import { assignFormTemplateToEmployees, fetchFormTemplatesForDashboard } from "@/lib/queries/forms-client";
import { fetchDashboardEntities } from "@/lib/queries/entities-client";
import { fetchUsersOverview } from "@/lib/queries/users-client";
import type { UserRecord } from "@/types/users";
import type { FormTemplateListItem } from "@/types/forms";
import type { EntityRecord } from "@/types/entities";
import { canReviewSubmissions } from "@/lib/auth/submission-review-roles";
import { cn } from "@/lib/utils";

interface BulkEditStaffModalProps {
  open: boolean;
  selectedEmployeeIds: string[];
  onClose: () => void;
  onSuccess: () => void;
  /** Current user role — controls whether score adjustment fields are shown. */
  role?: string | null;
}

type FieldKey =
  | "roleCategory"
  | "designation"
  | "entityId"
  | "templateId"
  | "qualification"
  | "qualificationYear"
  | "qualificationSubject"
  | "qualificationInstitute"
  | "qualificationCountry"
  | "creditHrsErpScoreAdj"
  | "pubOricScoreAdj"
  | "qecScoreAdj"
  | "calibrationFactor"
  | "manager1UserId"
  | "manager2UserId";

const TEXT_FIELDS: { key: FieldKey; label: string; placeholder: string }[] = [
  { key: "roleCategory", label: "Role Category", placeholder: "Enter role category" },
  { key: "designation", label: "Designation", placeholder: "Enter designation" },
  { key: "qualification", label: "Qualification", placeholder: "Enter qualification" },
  { key: "qualificationSubject", label: "Subject", placeholder: "Enter subject" },
  { key: "qualificationInstitute", label: "Institution", placeholder: "Enter institution" },
  { key: "qualificationCountry", label: "Country", placeholder: "Enter country" },
];

const NUMBER_FIELDS: { key: FieldKey; label: string; placeholder: string; step?: string }[] = [
  { key: "qualificationYear", label: "Year", placeholder: "Enter year", step: "1" },
  { key: "creditHrsErpScoreAdj", label: "CH ADJ", placeholder: "e.g. 0", step: "1" },
  { key: "pubOricScoreAdj", label: "ORIC ADJ", placeholder: "e.g. 0", step: "1" },
  { key: "qecScoreAdj", label: "QEC", placeholder: "e.g. 0", step: "1" },
  { key: "calibrationFactor", label: "Cal Fr.", placeholder: "1.0", step: "0.01" },
];

const SCORE_ADJ_FIELDS: FieldKey[] = [
  "creditHrsErpScoreAdj",
  "pubOricScoreAdj",
  "qecScoreAdj",
  "calibrationFactor",
];

export function BulkEditStaffModal({
  open,
  selectedEmployeeIds,
  onClose,
  onSuccess,
  role,
}: BulkEditStaffModalProps) {
  const queryClient = useQueryClient();
  const [textValues, setTextValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [numberValues, setNumberValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [selectValues, setSelectValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [selectedFormTemplateIds, setSelectedFormTemplateIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const canEditScores = canReviewSubmissions(role ?? undefined);

  const { data: formTemplates } = useQuery({
    queryKey: ["form-templates"],
    queryFn: fetchFormTemplatesForDashboard,
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

  useEffect(() => {
    if (open) {
      setTextValues({});
      setNumberValues({});
      setSelectValues({});
      setSelectedFormTemplateIds(new Set());
      setError(null);
    }
  }, [open]);

  const managerOptions = useMemo(() => {
    if (!users) return [];
    return users
      .filter((u) => u.isActive)
      .map((u) => ({
        id: u.id,
        label: `${u.firstName} ${u.lastName} (${u.employeeId})`,
      }));
  }, [users]);

  const buildFields = () => {
    const fields: Record<string, unknown> = {};

    for (const { key } of TEXT_FIELDS) {
      const val = textValues[key];
      if (val !== undefined && val.trim() !== "") {
        fields[key] = val.trim();
      }
    }

    for (const { key } of NUMBER_FIELDS) {
      const val = numberValues[key];
      if (val !== undefined && val.trim() !== "") {
        const parsed = Number(val);
        if (Number.isFinite(parsed)) {
          fields[key] = parsed;
        }
      }
    }

    if (selectValues.entityId !== undefined) {
      const parsed = Number(selectValues.entityId);
      if (Number.isFinite(parsed)) {
        fields.entityId = parsed;
      }
    }
    if (selectValues.manager1UserId !== undefined) {
      const parsed = Number(selectValues.manager1UserId);
      if (Number.isFinite(parsed)) {
        fields.manager1UserId = parsed;
      }
    }
    if (selectValues.manager2UserId !== undefined) {
      const parsed = Number(selectValues.manager2UserId);
      if (Number.isFinite(parsed)) {
        fields.manager2UserId = parsed;
      }
    }

    return fields;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fields = buildFields();
      const hasFormSelection = selectedFormTemplateIds.size > 0;

      if (Object.keys(fields).length === 0 && !hasFormSelection) {
        throw new Error("Enter a value for at least one field.");
      }

      if (Object.keys(fields).length > 0) {
        await bulkUpdateEmployeeListingFields(selectedEmployeeIds, fields);
      }

      if (hasFormSelection) {
        for (const templateId of selectedFormTemplateIds) {
          await assignFormTemplateToEmployees(templateId, selectedEmployeeIds);
        }
      }
    },
    onMutate: async () => {
      setError(null);
      await Promise.all([
        cancelStaffListingQueries(queryClient),
        queryClient.cancelQueries({ queryKey: queryKeys.users }),
      ]);

      const listingSnapshots = getStaffListingSnapshots(queryClient);
      const previousUsers = queryClient.getQueryData<UserRecord[]>(queryKeys.users);
      const previousUsersOverview = queryClient.getQueryData<UserRecord[]>(
        queryKeys.usersOverview,
      );

      const selected = new Set(selectedEmployeeIds);
      const fields = buildFields();

      patchStaffListingCaches(queryClient, (row) => {
        if (!selected.has(row.employeeId)) return row;
        return {
          ...row,
          ...(fields.roleCategory != null ? { roleCategory: fields.roleCategory as string } : {}),
          ...(fields.designation != null ? { designation: fields.designation as string } : {}),
          ...(fields.entityId != null ? { entityId: fields.entityId as number } : {}),
          ...(fields.templateId != null ? { templateId: fields.templateId as number } : {}),
          ...(fields.qualification != null ? { qualification: fields.qualification as string } : {}),
          ...(fields.qualificationYear != null ? { qualificationYear: fields.qualificationYear as number } : {}),
          ...(fields.qualificationSubject != null ? { qualificationSubject: fields.qualificationSubject as string } : {}),
          ...(fields.qualificationInstitute != null ? { qualificationInstitute: fields.qualificationInstitute as string } : {}),
          ...(fields.qualificationCountry != null ? { qualificationCountry: fields.qualificationCountry as string } : {}),
          ...(fields.creditHrsErpScoreAdj != null ? { creditHrsErpScoreAdj: fields.creditHrsErpScoreAdj as number } : {}),
          ...(fields.pubOricScoreAdj != null ? { pubOricScoreAdj: fields.pubOricScoreAdj as number } : {}),
          ...(fields.qecScoreAdj != null ? { qecScoreAdj: fields.qecScoreAdj as number } : {}),
          ...(fields.calibrationFactor != null ? { calibrationFactor: fields.calibrationFactor as number } : {}),
          ...(fields.manager1UserId != null ? { manager1UserId: fields.manager1UserId as number } : {}),
          ...(fields.manager2UserId != null ? { manager2UserId: fields.manager2UserId as number } : {}),
        };
      });

      const patchUser = (row: UserRecord) => {
        if (!selected.has(row.employeeId)) return row;
        return {
          ...row,
          ...(fields.roleCategory != null ? { roleCategory: fields.roleCategory as string } : {}),
          ...(fields.designation != null ? { designation: fields.designation as string } : {}),
          ...(fields.entityId != null ? { entityId: fields.entityId as number } : {}),
          ...(fields.qualification != null ? { qualification: fields.qualification as string } : {}),
          ...(fields.qualificationYear != null ? { qualificationYear: String(fields.qualificationYear) } : {}),
          ...(fields.qualificationSubject != null ? { qualificationSubject: fields.qualificationSubject as string } : {}),
          ...(fields.qualificationInstitute != null ? { qualificationInstitute: fields.qualificationInstitute as string } : {}),
          ...(fields.qualificationCountry != null ? { qualificationCountry: fields.qualificationCountry as string } : {}),
          ...(fields.manager1UserId != null ? { headId: fields.manager1UserId as number } : {}),
          ...(fields.manager2UserId != null ? { manager2Id: fields.manager2UserId as number } : {}),
        };
      };

      queryClient.setQueryData<UserRecord[]>(queryKeys.users, (current) =>
        current?.map(patchUser),
      );
      queryClient.setQueryData<UserRecord[]>(queryKeys.usersOverview, (current) =>
        current?.map(patchUser),
      );
      queryClient.setQueriesData<UserRecord[]>(
        { queryKey: ["users", "by-ids"] },
        (current) => current?.map(patchUser),
      );

      return { ...listingSnapshots, previousUsers, previousUsersOverview };
    },
    onError: (mutationError, _vars, context) => {
      if (context) {
        restoreStaffListingSnapshots(queryClient, context);
      }
      if (context?.previousUsers) {
        queryClient.setQueryData(queryKeys.users, context.previousUsers);
      }
      if (context?.previousUsersOverview) {
        queryClient.setQueryData(
          queryKeys.usersOverview,
          context.previousUsersOverview,
        );
      }
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to apply bulk edit.",
      );
    },
    onSuccess: () => {
      invalidateStaffListingQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
      void queryClient.invalidateQueries({ queryKey: ["form-templates"] });
      void queryClient.invalidateQueries({ queryKey: ["employee-assigned-forms"] });
      onSuccess();
      onClose();
    },
  });

  const inputClassName = cn(
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white",
    saveMutation.isPending && "opacity-70",
  );

  const labelClassName =
    "text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

  const visibleNumberFields = canEditScores
    ? NUMBER_FIELDS
    : NUMBER_FIELDS.filter((f) => !SCORE_ADJ_FIELDS.includes(f.key));

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="bulk-edit-staff-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-edit-staff-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-100 flex items-center justify-center p-4"
        >
          <motion.button
            type="button"
            aria-label="Close bulk edit dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            disabled={saveMutation.isPending}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="bulk-edit-staff-modal-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Bulk edit
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Apply values to {selectedEmployeeIds.length} selected staff.
                  Leave a field blank to keep existing values.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={saveMutation.isPending}
                aria-label="Close"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-white/15 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* Form Assignment (multi-select) */}
              <div className="block space-y-1.5">
                <span className={labelClassName}>Form Assignment</span>
                <div className={cn(
                  "max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-950",
                  saveMutation.isPending && "opacity-70",
                )}>
                  {formTemplates && formTemplates.length > 0 ? (
                    <div className="space-y-1">
                      {formTemplates.map((t: FormTemplateListItem) => {
                        const checked = selectedFormTemplateIds.has(t.id);
                        return (
                          <label
                            key={t.id}
                            className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedFormTemplateIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(t.id)) {
                                    next.delete(t.id);
                                  } else {
                                    next.add(t.id);
                                  }
                                  return next;
                                })
                              }
                              disabled={saveMutation.isPending}
                              className="size-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-white/20"
                            />
                            <span className="truncate">{t.title}</span>
                            <span className="ml-auto shrink-0 text-xs text-slate-400">
                              FY {t.fiscalYear}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-2 text-center text-sm text-slate-400">
                      No form templates available.
                    </p>
                  )}
                </div>
              </div>

              {/* Text fields */}
              {TEXT_FIELDS.map((field) => (
                <label key={field.key} className="block space-y-1.5">
                  <span className={labelClassName}>{field.label}</span>
                  <input
                    type="text"
                    value={textValues[field.key] ?? ""}
                    onChange={(e) =>
                      setTextValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    disabled={saveMutation.isPending}
                    placeholder={field.placeholder}
                    className={inputClassName}
                  />
                </label>
              ))}

              {/* Organization (entity) */}
              <label className="block space-y-1.5">
                <span className={labelClassName}>Organization</span>
                <select
                  value={selectValues.entityId ?? ""}
                  onChange={(e) =>
                    setSelectValues((prev) => ({
                      ...prev,
                      entityId: e.target.value || undefined,
                    }))
                  }
                  disabled={saveMutation.isPending}
                  className={inputClassName}
                >
                  <option value="">— Keep existing —</option>
                  {entities?.map((ent: EntityRecord) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Number fields (qualification year + score adjustments) */}
              {visibleNumberFields.map((field) => (
                <label key={field.key} className="block space-y-1.5">
                  <span className={labelClassName}>{field.label}</span>
                  <input
                    type="number"
                    step={field.step}
                    value={numberValues[field.key] ?? ""}
                    onChange={(e) =>
                      setNumberValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    disabled={saveMutation.isPending}
                    placeholder={field.placeholder}
                    className={inputClassName}
                  />
                </label>
              ))}

              {/* Manager 1 */}
              <label className="block space-y-1.5">
                <span className={labelClassName}>Manager 1</span>
                <select
                  value={selectValues.manager1UserId ?? ""}
                  onChange={(e) =>
                    setSelectValues((prev) => ({
                      ...prev,
                      manager1UserId: e.target.value || undefined,
                    }))
                  }
                  disabled={saveMutation.isPending}
                  className={inputClassName}
                >
                  <option value="">— Keep existing —</option>
                  {managerOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Manager 2 */}
              <label className="block space-y-1.5">
                <span className={labelClassName}>Manager 2</span>
                <select
                  value={selectValues.manager2UserId ?? ""}
                  onChange={(e) =>
                    setSelectValues((prev) => ({
                      ...prev,
                      manager2UserId: e.target.value || undefined,
                    }))
                  }
                  disabled={saveMutation.isPending}
                  className={inputClassName}
                >
                  <option value="">— Keep existing —</option>
                  {managerOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saveMutation.isPending}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                <Pencil className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Applying..." : "Apply to selected"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
