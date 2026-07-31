"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pencil, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getUserOrgLevel1,
  getUserOrgLevel2,
} from "@/app/helpers/users-table-columns";
import type { EntityRecord } from "@/types/entities";
import type { FormTemplateListItem } from "@/types/forms";
import {
  USER_ROLE_LABELS,
  USER_ROLES,
  type UpdateUserInput,
  type UserRecord,
  type UserRole,
} from "@/types/users";
import { fetchFormTemplatesForDashboard } from "@/lib/queries/forms-client";
import { fetchEmployeeAssignedForms } from "@/lib/queries/form-submissions-client";
import { SearchableManagerSelect } from "@/app/components/users/SearchableManagerSelect";
import { filterManagerEligibleUsers } from "@/app/helpers/manager-eligibility";
import { cn } from "@/lib/utils";

interface EditUserFormState {
  employeeId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  designation: string;
  roleCategory: string;
  dateOfJoining: string;
  systemRole: UserRole;
  entityId: string;
  headId: string;
  manager2Id: string;
  isManagerEligible: boolean;
  qualification: string;
  qualificationYear: string;
  qualificationSubject: string;
  qualificationInstitute: string;
  qualificationCountry: string;
  isActive: boolean;
}

function toFormState(user: UserRecord): EditUserFormState {
  return {
    employeeId: user.employeeId,
    email: user.email,
    password: "",
    firstName: user.firstName,
    lastName: user.lastName,
    designation: user.designation ?? "",
    roleCategory: user.roleCategory ?? "",
    dateOfJoining: user.dateOfJoining?.slice(0, 10) ?? "",
    systemRole: user.systemRole,
    entityId: user.entityId ? String(user.entityId) : "",
    headId: user.headId ? String(user.headId) : "",
    manager2Id: user.manager2Id ? String(user.manager2Id) : "",
    isManagerEligible: user.isManagerEligible,
    qualification: user.qualification ?? "",
    qualificationYear: user.qualificationYear ?? "",
    qualificationSubject: user.qualificationSubject ?? "",
    qualificationInstitute: user.qualificationInstitute ?? "",
    qualificationCountry: user.qualificationCountry ?? "",
    isActive: user.isActive,
  };
}

interface EditUserModalProps {
  open: boolean;
  user: UserRecord | null;
  users: UserRecord[];
  entities: EntityRecord[];
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (input: UpdateUserInput, templateIds?: number[]) => void;
}

export function EditUserModal({
  open,
  user,
  users,
  entities,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: EditUserModalProps) {
  const [form, setForm] = useState<EditUserFormState | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set());
  const [initialTemplateIds, setInitialTemplateIds] = useState<Set<number>>(new Set());

  const { data: formTemplates } = useQuery({
    queryKey: ["form-templates"],
    queryFn: fetchFormTemplatesForDashboard,
    enabled: open,
  });

  const { data: assignedFormsData } = useQuery({
    queryKey: ["employee-assigned-forms", user?.employeeId],
    queryFn: () => fetchEmployeeAssignedForms(user!.employeeId),
    enabled: open && !!user?.employeeId,
  });

  useEffect(() => {
    if (open && user) {
      setForm(toFormState(user));
      const assignedIds = new Set(
        (assignedFormsData?.forms ?? []).map((f) => f.templateId),
      );
      setSelectedTemplateIds(assignedIds);
      setInitialTemplateIds(assignedIds);
    }
    if (!open) {
      setForm(null);
      setSelectedTemplateIds(new Set());
      setInitialTemplateIds(new Set());
    }
  }, [open, user, assignedFormsData]);

  const headOptions = useMemo(() => {
    if (!user) return filterManagerEligibleUsers(users);
    return filterManagerEligibleUsers(
      users.filter((candidate) => candidate.id !== user.id),
      form?.headId ?? null,
    );
  }, [users, user, form?.headId]);

  const manager2Options = useMemo(() => {
    if (!user || !form) return headOptions;
    return headOptions.filter(
      (candidate) =>
        String(candidate.id) !== form.headId ||
        String(candidate.id) === form.manager2Id,
    );
  }, [headOptions, user, form]);

  const selectedEntity = useMemo(
    () => entities.find((entity) => String(entity.id) === form?.entityId) ?? null,
    [entities, form?.entityId],
  );

  const orgPreviewUser = useMemo(() => {
    if (!user || !form) return null;
    return {
      ...user,
      entityId: form.entityId ? Number(form.entityId) : null,
      entityName: selectedEntity?.name ?? null,
      parentEntityName: selectedEntity?.parentName ?? null,
    } satisfies UserRecord;
  }, [user, form, selectedEntity]);

  if (!open || !user || !form) {
    return null;
  }

  const inputClassName =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-70 dark:border-white/10 dark:bg-slate-950 dark:text-white";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const yearValue = form.qualificationYear.trim();
    const templateIds = [...selectedTemplateIds].sort((a, b) => a - b);
    const initialIds = [...initialTemplateIds].sort((a, b) => a - b);
    const templatesChanged =
      templateIds.length !== initialIds.length ||
      templateIds.some((id, i) => id !== initialIds[i]);
    onSubmit(
      {
        employeeId: form.employeeId.trim(),
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        designation: form.designation.trim() || null,
        roleCategory: form.roleCategory.trim() || null,
        dateOfJoining: form.dateOfJoining || null,
        systemRole: form.systemRole,
        empCategory: "ADMINISTRATION",
        empSubCategory: "SYSTEM_ADMIN",
        entityId: form.entityId ? Number(form.entityId) : null,
        headId: form.headId ? Number(form.headId) : null,
        manager2Id: form.manager2Id ? Number(form.manager2Id) : null,
        isManagerEligible: form.isManagerEligible,
        qualification: form.qualification.trim() || null,
        qualificationYear: yearValue ? Number(yearValue) : null,
        qualificationSubject: form.qualificationSubject.trim() || null,
        qualificationInstitute: form.qualificationInstitute.trim() || null,
        qualificationCountry: form.qualificationCountry.trim() || null,
        isActive: form.isActive,
        ...(form.password ? { password: form.password } : {}),
      },
      templatesChanged ? templateIds : undefined,
    );
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="edit-user-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-100 flex items-center justify-center p-4"
        >
          <motion.button
            type="button"
            aria-label="Close edit user dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/15 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-white/10">
              <div>
                <h2
                  id="edit-user-modal-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Edit User
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Update all listing fields for {user.firstName} {user.lastName}.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label="Close"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-white/15 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="SAP Code" htmlFor="edit-user-employee-id">
                    <input
                      id="edit-user-employee-id"
                      type="text"
                      value={form.employeeId}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, employeeId: event.target.value }
                            : current,
                        )
                      }
                      maxLength={30}
                      required
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="First Name" htmlFor="edit-user-first-name">
                    <input
                      id="edit-user-first-name"
                      type="text"
                      value={form.firstName}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, firstName: event.target.value }
                            : current,
                        )
                      }
                      maxLength={50}
                      required
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Last Name" htmlFor="edit-user-last-name">
                    <input
                      id="edit-user-last-name"
                      type="text"
                      value={form.lastName}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, lastName: event.target.value }
                            : current,
                        )
                      }
                      maxLength={50}
                      required
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Email" htmlFor="edit-user-email">
                    <input
                      id="edit-user-email"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, email: event.target.value }
                            : current,
                        )
                      }
                      maxLength={150}
                      required
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Designation" htmlFor="edit-user-designation">
                    <input
                      id="edit-user-designation"
                      type="text"
                      value={form.designation}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, designation: event.target.value }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Role Category" htmlFor="edit-user-role-category">
                    <input
                      id="edit-user-role-category"
                      type="text"
                      value={form.roleCategory}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, roleCategory: event.target.value }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Entity" htmlFor="edit-user-entity">
                    <select
                      id="edit-user-entity"
                      value={form.entityId}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, entityId: event.target.value }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    >
                      <option value="">None</option>
                      {entities.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name}
                          {entity.parentName ? ` (${entity.parentName})` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="ORG Level 1" htmlFor="edit-user-org-1">
                    <input
                      id="edit-user-org-1"
                      type="text"
                      readOnly
                      value={
                        orgPreviewUser ? getUserOrgLevel1(orgPreviewUser) : "—"
                      }
                      className={cn(inputClassName, "bg-slate-50 dark:bg-slate-900")}
                    />
                  </Field>

                  <Field label="ORG Level 2" htmlFor="edit-user-org-2">
                    <input
                      id="edit-user-org-2"
                      type="text"
                      readOnly
                      value={
                        orgPreviewUser ? getUserOrgLevel2(orgPreviewUser) : "—"
                      }
                      className={cn(inputClassName, "bg-slate-50 dark:bg-slate-900")}
                    />
                  </Field>

                  <Field label="DOJ" htmlFor="edit-user-doj">
                    <input
                      id="edit-user-doj"
                      type="date"
                      value={form.dateOfJoining}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, dateOfJoining: event.target.value }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="System Role" htmlFor="edit-user-system-role">
                    <select
                      id="edit-user-system-role"
                      value={form.systemRole}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                systemRole: event.target.value as UserRole,
                              }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    >
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {USER_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Manager Role" htmlFor="edit-user-manager-role">
                    <select
                      id="edit-user-manager-role"
                      value={form.isManagerEligible ? "yes" : "no"}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                isManagerEligible: event.target.value === "yes",
                              }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </Field>

                  <Field label="Manager 1" htmlFor="edit-user-head">
                    <SearchableManagerSelect
                      id="edit-user-head"
                      value={form.headId}
                      options={headOptions}
                      onChange={(next) =>
                        setForm((current) => {
                          if (!current) return current;
                          const nextManager2Id =
                            current.manager2Id === next
                              ? ""
                              : current.manager2Id;
                          return {
                            ...current,
                            headId: next,
                            manager2Id: nextManager2Id,
                          };
                        })
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Manager 2" htmlFor="edit-user-manager-2">
                    <SearchableManagerSelect
                      id="edit-user-manager-2"
                      value={form.manager2Id}
                      options={manager2Options}
                      onChange={(next) =>
                        setForm((current) =>
                          current
                            ? { ...current, manager2Id: next }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Qualification" htmlFor="edit-user-qualification">
                    <input
                      id="edit-user-qualification"
                      type="text"
                      value={form.qualification}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, qualification: event.target.value }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Year" htmlFor="edit-user-qualification-year">
                    <input
                      id="edit-user-qualification-year"
                      type="number"
                      min={1900}
                      max={2100}
                      value={form.qualificationYear}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                qualificationYear: event.target.value,
                              }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Subject" htmlFor="edit-user-qualification-subject">
                    <input
                      id="edit-user-qualification-subject"
                      type="text"
                      value={form.qualificationSubject}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                qualificationSubject: event.target.value,
                              }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field
                    label="Institute"
                    htmlFor="edit-user-qualification-institute"
                  >
                    <input
                      id="edit-user-qualification-institute"
                      type="text"
                      value={form.qualificationInstitute}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                qualificationInstitute: event.target.value,
                              }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field
                    label="Country"
                    htmlFor="edit-user-qualification-country"
                  >
                    <input
                      id="edit-user-qualification-country"
                      type="text"
                      value={form.qualificationCountry}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                qualificationCountry: event.target.value,
                              }
                            : current,
                        )
                      }
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Password" htmlFor="edit-user-password">
                    <input
                      id="edit-user-password"
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, password: event.target.value }
                            : current,
                        )
                      }
                      minLength={8}
                      placeholder="Leave blank to keep current password"
                      disabled={isSubmitting}
                      className={inputClassName}
                    />
                  </Field>

                  <div className="flex items-end pb-2">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(event) =>
                          setForm((current) =>
                            current
                              ? { ...current, isActive: event.target.checked }
                              : current,
                          )
                        }
                        disabled={isSubmitting}
                        className="size-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-white/20"
                      />
                      Active account
                    </label>
                  </div>
                </div>

                {/* Form Assignment */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Form Assignment
                  </span>
                  <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-950">
                    {formTemplates && formTemplates.length > 0 ? (
                      <div className="space-y-1">
                        {formTemplates.map((t: FormTemplateListItem) => {
                          const checked = selectedTemplateIds.has(t.id);
                          return (
                            <label
                              key={t.id}
                              className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSelectedTemplateIds((current) => {
                                    const next = new Set(current);
                                    if (next.has(t.id)) {
                                      next.delete(t.id);
                                    } else {
                                      next.add(t.id);
                                    }
                                    return next;
                                  })
                                }
                                disabled={isSubmitting}
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

                {errorMessage ? (
                  <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {isSubmitting ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5" htmlFor={htmlFor}>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
