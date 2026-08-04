"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Table2, Users } from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { SearchableSelect } from "@/app/components/common/SearchableSelect";
import { DashboardFilterBar } from "@/app/components/dashboard/DashboardFilterBar";
import { EditUserModal } from "@/app/components/users/EditUserModal";
import { SearchableManagerSelect } from "@/app/components/users/SearchableManagerSelect";
import { UsersListingTable } from "@/app/components/users/UsersListingTable";
import { invalidateStaffListingQueries } from "@/app/helpers/dashboard-listing-cache";
import { filterManagerEligibleUsers } from "@/app/helpers/manager-eligibility";
import {
  getUserOrgLevel1,
  getUserOrgLevel2,
} from "@/app/helpers/users-table-columns";
import { queryKeys } from "@/app/queries/keys";
import {
  useEntitiesQuery,
  useUniqueDesignationsQuery,
} from "@/app/queries/organization";
import { useUsersOverviewQuery } from "@/app/queries/users";
import { useUsersPageFilters } from "@/app/queries/users-filters";
import { saveUserAdditionalAccess } from "@/lib/queries/additional-access-client";
import { fetchEmployeeAssignedForms } from "@/lib/queries/form-submissions-client";
import {
  assignFormTemplateToEmployees,
  fetchFormTemplatesForDashboard,
  unassignFormTemplateFromEmployees,
} from "@/lib/queries/forms-client";
import {
  createUser,
  deleteUser,
  updateUser,
} from "@/lib/queries/users-client";
import { cn } from "@/lib/utils";
import type { FormTemplateListItem } from "@/types/forms";
import {
  ADDITIONAL_ACCESS_LEVEL_LABELS,
  ADDITIONAL_ACCESS_MODULE_LABELS,
  ADDITIONAL_ACCESS_MODULES,
  type AdditionalAccessLevel,
  type AdditionalAccessModule,
  type AdditionalAccessPermission,
} from "@/types/additional-access";
import {
  USER_ROLE_LABELS,
  USER_ROLES,
  type CreateUserInput,
  type UserRecord,
  type UserRole,
} from "@/types/users";

type MessageTone = "success" | "error";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

type UserSectionTab = "list" | "add";

interface UserFormState {
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

const emptyForm: UserFormState = {
  employeeId: "",
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  designation: "",
  roleCategory: "",
  dateOfJoining: "",
  systemRole: "EMPLOYEE",
  entityId: "",
  headId: "",
  manager2Id: "",
  isManagerEligible: false,
  qualification: "",
  qualificationYear: "",
  qualificationSubject: "",
  qualificationInstitute: "",
  qualificationCountry: "",
  isActive: true,
};

const emptyAdditionalAccess = () =>
  Object.fromEntries(
    ADDITIONAL_ACCESS_MODULES.map((m) => [m, null]),
  ) as Record<AdditionalAccessModule, AdditionalAccessLevel | null>;

export default function UsersManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [activeTab, setActiveTab] = useState<UserSectionTab>("list");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(
    new Set(),
  );
  const [additionalAccess, setAdditionalAccess] =
    useState(emptyAdditionalAccess);

  const { data: entities = [], isLoading: entitiesLoading } = useEntitiesQuery();
  const { data: designations = [], isLoading: designationsLoading } =
    useUniqueDesignationsQuery();

  const {
    data: users = [],
    isLoading: overviewLoading,
    error,
  } = useUsersOverviewQuery();

  const { data: formTemplates } = useQuery({
    queryKey: ["form-templates"],
    queryFn: fetchFormTemplatesForDashboard,
    enabled: activeTab === "add",
  });

  const {
    selectedCategory0EntityIds,
    selectedCategory1EntityIds,
    selectedCategory2EntityIds,
    selectedRoleCategories,
    selectedDesignations,
    category0Options,
    category0DistributionOptions,
    category1Options,
    category2Options,
    roleCategoryOptions,
    designationOptions,
    filteredUsers,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory0DistributionSelect,
    handleCategory1EntityChange,
    handleCategory2EntityChange,
    handleRoleCategoryChange,
    handleDesignationChange,
    clearAllFilters,
  } = useUsersPageFilters({
    users,
    entities,
    designations,
  });

  const headOptions = useMemo(() => {
    return filterManagerEligibleUsers(users);
  }, [users]);

  const manager2Options = useMemo(() => {
    if (!form.headId) return headOptions;
    return headOptions.filter((user) => String(user.id) !== form.headId);
  }, [headOptions, form.headId]);

  const entityOptions = useMemo(
    () =>
      entities.map((entity) => ({
        value: String(entity.id),
        label: entity.parentName
          ? `${entity.name} (${entity.parentName})`
          : entity.name,
      })),
    [entities],
  );

  const selectedEntity = useMemo(
    () => entities.find((entity) => String(entity.id) === form.entityId) ?? null,
    [entities, form.entityId],
  );

  const orgPreviewUser = useMemo(
    () =>
      ({
        id: 0,
        employeeId: form.employeeId,
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        designation: form.designation || null,
        roleCategory: form.roleCategory || null,
        dateOfJoining: form.dateOfJoining || null,
        systemRole: form.systemRole,
        empCategory: "ADMINISTRATION",
        empSubCategory: "SYSTEM_ADMIN",
        entityId: form.entityId ? Number(form.entityId) : null,
        entityName: selectedEntity?.name ?? null,
        parentEntityName: selectedEntity?.parentName ?? null,
        headId: form.headId ? Number(form.headId) : null,
        headName: null,
        manager2Id: form.manager2Id ? Number(form.manager2Id) : null,
        manager2Name: null,
        isManagerEligible: form.isManagerEligible,
        qualification: form.qualification || null,
        qualificationYear: form.qualificationYear || null,
        qualificationSubject: form.qualificationSubject || null,
        qualificationInstitute: form.qualificationInstitute || null,
        qualificationCountry: form.qualificationCountry || null,
        isActive: form.isActive,
        createdAt: "",
      }) satisfies UserRecord,
    [form, selectedEntity],
  );

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedTemplateIds(new Set());
    setAdditionalAccess(emptyAdditionalAccess());
  };

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users });
  };

  const createMutation = useMutation({
    mutationFn: async ({
      input,
      templateIds,
      permissions,
    }: {
      input: CreateUserInput;
      templateIds: number[];
      permissions: AdditionalAccessPermission[];
    }) => {
      const created = await createUser(input);

      if (permissions.length > 0) {
        try {
          await saveUserAdditionalAccess(created.id, permissions);
        } catch {
          // non-fatal: user was created
        }
      }

      for (const tid of templateIds) {
        try {
          await assignFormTemplateToEmployees(tid, [created.employeeId]);
        } catch {
          // non-fatal
        }
      }

      return created;
    },
    onSuccess: (user) => {
      setFormMessage({
        tone: "success",
        text: `User "${user.firstName} ${user.lastName}" created successfully.`,
      });
      resetForm();
      invalidateList();
      invalidateStaffListingQueries(queryClient);
      void queryClient.invalidateQueries({
        queryKey: ["employee-assigned-forms"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["form-templates"],
      });
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      input,
      templateIds,
      employeeId,
    }: {
      id: number;
      input: Parameters<typeof updateUser>[1];
      templateIds?: number[];
      employeeId: string;
    }) => {
      const updatedUser = await updateUser(id, input);

      if (templateIds !== undefined) {
        const assigned = await fetchEmployeeAssignedForms(employeeId);
        const currentIds = new Set(assigned.forms.map((f) => f.templateId));
        const targetIds = new Set(templateIds);

        const toAssign = templateIds.filter((tid) => !currentIds.has(tid));
        const toUnassign = [...currentIds].filter((tid) => !targetIds.has(tid));

        for (const tid of toAssign) {
          await assignFormTemplateToEmployees(tid, [employeeId]);
        }
        for (const tid of toUnassign) {
          await unassignFormTemplateFromEmployees(tid, [employeeId]);
        }
      }

      return updatedUser;
    },
    onSuccess: (user) => {
      setFormMessage({
        tone: "success",
        text: `User "${user.firstName} ${user.lastName}" updated successfully.`,
      });
      setEditingUser(null);
      invalidateList();
      invalidateStaffListingQueries(queryClient);
      void queryClient.invalidateQueries({
        queryKey: ["employee-assigned-forms"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["form-templates"],
      });
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "User deleted successfully.",
      });
      if (editingUser) {
        setEditingUser(null);
      }
      invalidateList();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const isSubmitting = createMutation.isPending;
  const filtersReady = !entitiesLoading && !overviewLoading;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);

    const yearValue = form.qualificationYear.trim();
    const permissions: AdditionalAccessPermission[] = [];
    for (const module of ADDITIONAL_ACCESS_MODULES) {
      if (additionalAccess[module]) {
        permissions.push({
          module,
          accessLevel: additionalAccess[module]!,
        });
      }
    }

    createMutation.mutate({
      input: {
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
        password: form.password,
      },
      templateIds: [...selectedTemplateIds],
      permissions,
    });
  };

  const handleEdit = (user: UserRecord) => {
    setEditingUser(user);
    setFormMessage(null);
  };

  const handleDelete = (user: UserRecord) => {
    const confirmed = window.confirm(
      `Delete user "${user.firstName} ${user.lastName}"?\n\nThis may fail if the user is linked to appraisals or other records. Consider deactivating instead.`,
    );

    if (!confirmed) {
      return;
    }

    setFormMessage(null);
    deleteMutation.mutate(user.id);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setFormMessage(null);
  };

  const inputClassName =
    "w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15";

  const handleSwitchTab = (tab: UserSectionTab) => {
    setActiveTab(tab);
    setFormMessage(null);
    if (tab === "add") {
      resetForm();
    }
  };

  const renderFormCard = () => (
    <div className="rounded-md border border-slate-300/80 p-6 dark:border-white/15">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Add User</h2>
          <p className="mt-1 text-sm text-foreground/70">
            Create employee accounts with the same fields available when editing.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {formMessage && !editingUser ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-4 overflow-hidden rounded-md border px-4 py-3 text-sm font-medium ${
              formMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300"
            }`}
          >
            {formMessage.text}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="SAP Code" htmlFor="user-employee-id">
            <input
              id="user-employee-id"
              type="text"
              value={form.employeeId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  employeeId: event.target.value,
                }))
              }
              maxLength={30}
              required
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="First Name" htmlFor="user-first-name">
            <input
              id="user-first-name"
              type="text"
              value={form.firstName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  firstName: event.target.value,
                }))
              }
              maxLength={50}
              required
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Last Name" htmlFor="user-last-name">
            <input
              id="user-last-name"
              type="text"
              value={form.lastName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lastName: event.target.value,
                }))
              }
              maxLength={50}
              required
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Email" htmlFor="user-email">
            <input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              maxLength={150}
              required
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Designation" htmlFor="user-designation">
            <input
              id="user-designation"
              type="text"
              value={form.designation}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  designation: event.target.value,
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Role Category" htmlFor="user-role-category">
            <input
              id="user-role-category"
              type="text"
              value={form.roleCategory}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  roleCategory: event.target.value,
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Entity" htmlFor="user-entity">
            <SearchableSelect
              id="user-entity"
              value={form.entityId}
              options={entityOptions}
              onChange={(next) =>
                setForm((current) => ({ ...current, entityId: next }))
              }
              disabled={isSubmitting}
              placeholder="None"
              emptyOptionLabel="None"
            />
          </Field>

          <Field label="ORG Level 1" htmlFor="user-org-1">
            <input
              id="user-org-1"
              type="text"
              readOnly
              value={getUserOrgLevel1(orgPreviewUser)}
              className={cn(inputClassName, "bg-slate-50 dark:bg-slate-900")}
            />
          </Field>

          <Field label="ORG Level 2" htmlFor="user-org-2">
            <input
              id="user-org-2"
              type="text"
              readOnly
              value={getUserOrgLevel2(orgPreviewUser)}
              className={cn(inputClassName, "bg-slate-50 dark:bg-slate-900")}
            />
          </Field>

          <Field label="DOJ" htmlFor="user-doj">
            <input
              id="user-doj"
              type="date"
              value={form.dateOfJoining}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dateOfJoining: event.target.value,
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="System Role" htmlFor="user-system-role">
            <select
              id="user-system-role"
              value={form.systemRole}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  systemRole: event.target.value as UserRole,
                }))
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

          <Field label="Manager Role" htmlFor="user-manager-role">
            <select
              id="user-manager-role"
              value={form.isManagerEligible ? "yes" : "no"}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isManagerEligible: event.target.value === "yes",
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>

          <Field label="Manager 1" htmlFor="user-head">
            <SearchableManagerSelect
              id="user-head"
              value={form.headId}
              options={headOptions}
              onChange={(next) =>
                setForm((current) => ({
                  ...current,
                  headId: next,
                  manager2Id:
                    current.manager2Id === next ? "" : current.manager2Id,
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Manager 2" htmlFor="user-manager-2">
            <SearchableManagerSelect
              id="user-manager-2"
              value={form.manager2Id}
              options={manager2Options}
              onChange={(next) =>
                setForm((current) => ({
                  ...current,
                  manager2Id: next,
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Qualification" htmlFor="user-qualification">
            <input
              id="user-qualification"
              type="text"
              value={form.qualification}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  qualification: event.target.value,
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Year" htmlFor="user-qualification-year">
            <input
              id="user-qualification-year"
              type="number"
              min={1900}
              max={2100}
              value={form.qualificationYear}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  qualificationYear: event.target.value,
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Subject" htmlFor="user-qualification-subject">
            <input
              id="user-qualification-subject"
              type="text"
              value={form.qualificationSubject}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  qualificationSubject: event.target.value,
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Institute" htmlFor="user-qualification-institute">
            <input
              id="user-qualification-institute"
              type="text"
              value={form.qualificationInstitute}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  qualificationInstitute: event.target.value,
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Country" htmlFor="user-qualification-country">
            <input
              id="user-qualification-country"
              type="text"
              value={form.qualificationCountry}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  qualificationCountry: event.target.value,
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <Field label="Password" htmlFor="user-password">
            <input
              id="user-password"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              required
              minLength={8}
              disabled={isSubmitting}
              className={inputClassName}
            />
          </Field>

          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-text-primary">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                disabled={isSubmitting}
                className="size-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-white/15"
              />
              Active account
            </label>
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
            Additional Access
          </span>
          <p className="mt-0.5 text-xs text-foreground/50">
            Grant module-level permissions supplementary to the user&rsquo;s role.
          </p>
          <div className="mt-1.5 rounded-lg border border-slate-300/80 bg-background p-3 dark:border-white/15">
            <div className="space-y-2">
              {ADDITIONAL_ACCESS_MODULES.map((module) => {
                const currentLevel = additionalAccess[module];
                return (
                  <div
                    key={module}
                    className="flex items-center gap-3 text-sm"
                  >
                    <label className="inline-flex items-center gap-2 text-text-primary">
                      <input
                        type="checkbox"
                        checked={currentLevel !== null}
                        onChange={(e) =>
                          setAdditionalAccess((prev) => ({
                            ...prev,
                            [module]: e.target.checked ? "VIEW_ONLY" : null,
                          }))
                        }
                        disabled={isSubmitting}
                        className="size-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-white/15"
                      />
                      <span className="font-medium">
                        {ADDITIONAL_ACCESS_MODULE_LABELS[module]}
                      </span>
                    </label>
                    {currentLevel !== null ? (
                      <select
                        value={currentLevel}
                        onChange={(e) =>
                          setAdditionalAccess((prev) => ({
                            ...prev,
                            [module]: e.target.value as AdditionalAccessLevel,
                          }))
                        }
                        disabled={isSubmitting}
                        className="rounded border border-slate-300 bg-background px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                      >
                        {(["VIEW_ONLY", "EDIT"] as AdditionalAccessLevel[]).map(
                          (level) => (
                            <option key={level} value={level}>
                              {ADDITIONAL_ACCESS_LEVEL_LABELS[level]}
                            </option>
                          ),
                        )}
                      </select>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
            Form Assignment
          </span>
          <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-300/80 bg-background p-2 dark:border-white/15">
            {formTemplates && formTemplates.length > 0 ? (
              <div className="space-y-1">
                {formTemplates.map((t: FormTemplateListItem) => {
                  const checked = selectedTemplateIds.has(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 text-sm text-text-primary"
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
                        className="size-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-white/15"
                      />
                      <span className="truncate">{t.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-foreground/50">
                        FY {t.fiscalYear}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="py-2 text-center text-sm text-foreground/50">
                No form templates available.
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          <Plus className="size-4" />
          {isSubmitting ? "Creating..." : "Add User"}
        </button>
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-300/80 dark:border-white/15">
        <nav aria-label="User section tabs" className="-mb-px flex gap-1">
          {(
            [
              { id: "list" as const, label: "Users", icon: Table2 },
              { id: "add" as const, label: "Add User", icon: Plus },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSwitchTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground/70 hover:border-primary/40 hover:text-text-primary"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === "add" ? renderFormCard() : null}

      {activeTab === "list" && overviewLoading ? (
        <div className="rounded-md border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
          <Users className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">
            Loading users…
          </p>
        </div>
      ) : null}

      {activeTab === "list" && error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300">
          Failed to load users.
        </div>
      ) : null}

      {activeTab === "list" &&
      filtersReady &&
      !error &&
      users.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
          <Users className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">
            No users yet
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            Add your first user from the Add User tab.
          </p>
        </div>
      ) : null}

      {activeTab === "list" && filtersReady && !error && users.length > 0 ? (
        <div className="space-y-4">
          <DashboardFilterBar
            selectedCategory0EntityIds={selectedCategory0EntityIds}
            onCategory0EntityChange={handleCategory0EntityChange}
            selectedCategory1EntityIds={selectedCategory1EntityIds}
            onCategory1EntityChange={handleCategory1EntityChange}
            selectedCategory2EntityIds={selectedCategory2EntityIds}
            onCategory2EntityChange={handleCategory2EntityChange}
            category0Options={category0Options}
            category0DistributionOptions={category0DistributionOptions}
            onCategory0DistributionSelect={handleCategory0DistributionSelect}
            category1Options={category1Options}
            category2Options={category2Options}
            selectedRoleCategories={selectedRoleCategories}
            onRoleCategoryChange={handleRoleCategoryChange}
            roleCategoryOptions={roleCategoryOptions}
            selectedDesignations={selectedDesignations}
            onDesignationChange={handleDesignationChange}
            designationOptions={designationOptions}
            designationsLoading={designationsLoading || overviewLoading}
            entitiesLoading={entitiesLoading || overviewLoading}
            activeFilters={activeFilters}
            onClearAllFilters={clearAllFilters}
            showFormStatus={false}
          />

          <UsersListingTable
            users={filteredUsers}
            allUsers={users}
            onEdit={handleEdit}
            onDelete={handleDelete}
            deletePending={deleteMutation.isPending}
            onClearAllFilters={clearAllFilters}
          />

          <EditUserModal
            open={editingUser != null}
            user={editingUser}
            users={users}
            entities={entities}
            isSubmitting={updateMutation.isPending}
            errorMessage={
              editingUser && formMessage?.tone === "error"
                ? formMessage.text
                : null
            }
            onClose={handleCancelEdit}
            onSubmit={(input, templateIds) => {
              if (!editingUser) return;
              setFormMessage(null);
              updateMutation.mutate({
                id: editingUser.id,
                input,
                templateIds,
                employeeId: editingUser.employeeId,
              });
            }}
          />
        </div>
      ) : null}
    </div>
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
      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
        {label}
      </span>
      {children}
    </label>
  );
}
