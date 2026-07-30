"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Table2, Users } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { DashboardFilterBar } from "@/app/components/dashboard/DashboardFilterBar";
import { EditUserModal } from "@/app/components/users/EditUserModal";
import { SearchableManagerSelect } from "@/app/components/users/SearchableManagerSelect";
import { UsersListingTable } from "@/app/components/users/UsersListingTable";
import { invalidateStaffListingQueries } from "@/app/helpers/dashboard-listing-cache";
import { queryKeys } from "@/app/queries/keys";
import {
  useEntitiesQuery,
  useUniqueDesignationsQuery,
} from "@/app/queries/organization";
import { useUsersOverviewQuery } from "@/app/queries/users";
import { useUsersPageFilters } from "@/app/queries/users-filters";
import {
  createUser,
  deleteUser,
  updateUser,
} from "@/lib/queries/users-client";
import {
  assignFormTemplateToEmployees,
  unassignFormTemplateFromEmployees,
} from "@/lib/queries/forms-client";
import { fetchEmployeeAssignedForms } from "@/lib/queries/form-submissions-client";
import {
  USER_ROLE_LABELS,
  USER_ROLES,
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
  systemRole: UserRole;
  empCategory: string;
  empSubCategory: string;
  entityId: string;
  headId: string;
  manager2Id: string;
  isActive: boolean;
}

const emptyForm: UserFormState = {
  employeeId: "",
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  systemRole: "EMPLOYEE",
  empCategory: "ADMINISTRATION",
  empSubCategory: "SYSTEM_ADMIN",
  entityId: "",
  headId: "",
  manager2Id: "",
  isActive: true,
};

export default function UsersManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [activeTab, setActiveTab] = useState<UserSectionTab>("list");

  const { data: entities = [], isLoading: entitiesLoading } = useEntitiesQuery();
  const { data: designations = [], isLoading: designationsLoading } =
    useUniqueDesignationsQuery();

  const {
    data: users = [],
    isLoading: overviewLoading,
    error,
  } = useUsersOverviewQuery();

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
    return users;
  }, [users]);

  const manager2Options = useMemo(() => {
    if (!form.headId) return headOptions;
    return headOptions.filter((user) => String(user.id) !== form.headId);
  }, [headOptions, form.headId]);

  const resetForm = () => {
    setForm(emptyForm);
  };

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users });
  };

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      setFormMessage({
        tone: "success",
        text: `User "${user.firstName} ${user.lastName}" created successfully.`,
      });
      resetForm();
      invalidateList();
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

    createMutation.mutate({
      employeeId: form.employeeId.trim(),
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      systemRole: form.systemRole,
      empCategory: "ADMINISTRATION",
      empSubCategory: "SYSTEM_ADMIN",
      entityId: form.entityId ? Number(form.entityId) : null,
      headId: form.headId ? Number(form.headId) : null,
      manager2Id: form.manager2Id ? Number(form.manager2Id) : null,
      isActive: form.isActive,
      password: form.password,
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
            Create employee accounts with roles, categories, and reporting lines.
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

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label htmlFor="user-employee-id" className="mb-1.5 block text-sm font-medium text-text-primary">
              Employee ID
            </label>
            <input
              id="user-employee-id"
              type="text"
              value={form.employeeId}
              onChange={(event) =>
                setForm((current) => ({ ...current, employeeId: event.target.value }))
              }
              maxLength={30}
              required
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="user-email" className="mb-1.5 block text-sm font-medium text-text-primary">
              Email
            </label>
            <input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              maxLength={150}
              required
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="user-password" className="mb-1.5 block text-sm font-medium text-text-primary">
              Password
            </label>
            <input
              id="user-password"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              required
              minLength={8}
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="user-first-name" className="mb-1.5 block text-sm font-medium text-text-primary">
              First Name
            </label>
            <input
              id="user-first-name"
              type="text"
              value={form.firstName}
              onChange={(event) =>
                setForm((current) => ({ ...current, firstName: event.target.value }))
              }
              maxLength={50}
              required
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="user-last-name" className="mb-1.5 block text-sm font-medium text-text-primary">
              Last Name
            </label>
            <input
              id="user-last-name"
              type="text"
              value={form.lastName}
              onChange={(event) =>
                setForm((current) => ({ ...current, lastName: event.target.value }))
              }
              maxLength={50}
              required
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="user-system-role" className="mb-1.5 block text-sm font-medium text-text-primary">
              System Role
            </label>
            <select
              id="user-system-role"
              value={form.systemRole}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  systemRole: event.target.value as UserRole,
                }))
              }
              className={inputClassName}
            >
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {USER_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="user-entity" className="mb-1.5 block text-sm font-medium text-text-primary">
              Entity
            </label>
            <select
              id="user-entity"
              value={form.entityId}
              onChange={(event) =>
                setForm((current) => ({ ...current, entityId: event.target.value }))
              }
              className={inputClassName}
            >
              <option value="">None</option>
              {entities?.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="user-head" className="mb-1.5 block text-sm font-medium text-text-primary">
              Manager 1
            </label>
            <SearchableManagerSelect
              id="user-head"
              value={form.headId}
              options={headOptions}
              onChange={(next) =>
                setForm((current) => ({
                  ...current,
                  headId: next,
                  manager2Id:
                    current.manager2Id === next
                      ? ""
                      : current.manager2Id,
                }))
              }
              disabled={isSubmitting}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="user-manager-2"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Manager 2
            </label>
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
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-text-primary">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isActive: event.target.checked }))
                }
                className="size-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-white/15"
              />
              Active account
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          <Plus className="size-4" />
          Add User
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
              { id: "list", label: "Users", icon: Table2 },
              { id: "add", label: "Add User", icon: Plus },
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

      {activeTab === "list" && formMessage?.tone === "success" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300">
          {formMessage.text}
        </div>
      ) : null}

      {activeTab === "list" && !filtersReady ? (
        <div className="rounded-md border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
          Loading users...
        </div>
      ) : null}

      {activeTab === "list" && error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load users.
        </div>
      ) : null}

      {activeTab === "list" && filtersReady && !error && users.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
          <Users className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">No users yet</p>
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
