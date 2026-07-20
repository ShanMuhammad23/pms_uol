"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Plus, Table2, Users, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { DashboardFilterBar } from "@/app/components/dashboard/DashboardFilterBar";
import { UsersListingTable } from "@/app/components/users/UsersListingTable";
import { queryKeys } from "@/app/queries/keys";
import {
  useEntitiesQuery,
  useUniqueDesignationsQuery,
} from "@/app/queries/organization";
import { useUsersPageFilters } from "@/app/queries/users-filters";
import {
  createUser,
  deleteUser,
  fetchStaffCategoriesForUsers,
  fetchUsers,
  updateUser,
} from "@/lib/queries/users-client";
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
  staffCategoryId: string;
  staffSubCategoryId: string;
  entityId: string;
  headId: string;
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
  staffCategoryId: "",
  staffSubCategoryId: "",
  entityId: "",
  headId: "",
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
  const { data: staffCategories = [], isLoading: staffCategoriesLoading } = useQuery({
    queryKey: ["staff-categories-for-users"],
    queryFn: fetchStaffCategoriesForUsers,
  });

  const {
    data: users = [],
    isLoading: usersLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.users,
    queryFn: fetchUsers,
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

  const selectedStaffCategory = useMemo(
    () =>
      staffCategories.find(
        (staffCategory) => String(staffCategory.id) === form.staffCategoryId,
      ),
    [staffCategories, form.staffCategoryId],
  );
  const subCategoryOptions = selectedStaffCategory?.subCategories ?? [];

  const headOptions = useMemo(() => {
    return users.filter((user) => !editingUser || user.id !== editingUser.id);
  }, [users, editingUser]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingUser(null);
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
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: Parameters<typeof updateUser>[1];
    }) => updateUser(id, input),
    onSuccess: (user) => {
      setFormMessage({
        tone: "success",
        text: `User "${user.firstName} ${user.lastName}" updated successfully.`,
      });
      resetForm();
      invalidateList();
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
        resetForm();
      }
      invalidateList();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isLoading = entitiesLoading || usersLoading || staffCategoriesLoading;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);
    const staffCategory = staffCategories.find(
      (item) => String(item.id) === form.staffCategoryId,
    );
    const staffSubCategory = staffCategory?.subCategories.find(
      (item) => String(item.id) === form.staffSubCategoryId,
    );

    if (!staffCategory || !staffSubCategory) {
      setFormMessage({
        tone: "error",
        text: "Please select a valid staff category and sub-category.",
      });
      return;
    }

    const payload = {
      employeeId: form.employeeId.trim(),
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      systemRole: form.systemRole,
      // Legacy enum fields retained for backward compatibility until DB enum migration is removed.
      empCategory: "ADMINISTRATION",
      empSubCategory: "SYSTEM_ADMIN",
      staffCategoryId: form.staffCategoryId ? Number(form.staffCategoryId) : null,
      staffSubCategoryId: form.staffSubCategoryId
        ? Number(form.staffSubCategoryId)
        : null,
      entityId: form.entityId ? Number(form.entityId) : null,
      headId: form.headId ? Number(form.headId) : null,
      isActive: form.isActive,
    };

    if (editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        input: {
          ...payload,
          ...(form.password ? { password: form.password } : {}),
        },
      });
      return;
    }

    createMutation.mutate({
      ...payload,
      password: form.password,
    });
  };

  const handleEdit = (user: UserRecord) => {
    setActiveTab("list");
    setEditingUser(user);
    setForm({
      employeeId: user.employeeId,
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      systemRole: user.systemRole,
      empCategory: user.empCategory,
      empSubCategory: user.empSubCategory,
      staffCategoryId: user.staffCategoryId ? String(user.staffCategoryId) : "",
      staffSubCategoryId: user.staffSubCategoryId
        ? String(user.staffSubCategoryId)
        : "",
      entityId: user.entityId ? String(user.entityId) : "",
      headId: user.headId ? String(user.headId) : "",
      isActive: user.isActive,
    });
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
    resetForm();
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
    <div className="rounded-xl border border-slate-300/80 p-6 dark:border-white/15">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {editingUser ? "Edit User" : "Add User"}
          </h2>
          <p className="mt-1 text-sm text-foreground/70">
            Manage employee accounts, roles, categories, and reporting lines.
          </p>
        </div>

        {editingUser ? (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            <X className="size-3.5" />
            Cancel
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {formMessage ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-4 overflow-hidden rounded-xl border px-4 py-3 text-sm font-medium ${
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
              required={!editingUser}
              minLength={editingUser ? undefined : 8}
              placeholder={editingUser ? "Leave blank to keep current password" : ""}
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
            <label htmlFor="user-staff-category" className="mb-1.5 block text-sm font-medium text-text-primary">
              Staff Category
            </label>
            <select
              id="user-staff-category"
              value={form.staffCategoryId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  staffCategoryId: event.target.value,
                  staffSubCategoryId: "",
                }))
              }
              required
              className={inputClassName}
            >
              <option value="" disabled>
                Select category
              </option>
              {staffCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="user-staff-sub-category" className="mb-1.5 block text-sm font-medium text-text-primary">
              Staff Sub-Category
            </label>
            <select
              id="user-staff-sub-category"
              value={form.staffSubCategoryId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  staffSubCategoryId: event.target.value,
                }))
              }
              required
              className={inputClassName}
            >
              <option value="" disabled>
                Select sub-category
              </option>
              {subCategoryOptions.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.name}
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
              Reporting Head
            </label>
            <select
              id="user-head"
              value={form.headId}
              onChange={(event) =>
                setForm((current) => ({ ...current, headId: event.target.value }))
              }
              className={inputClassName}
            >
              <option value="">None</option>
              {headOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.employeeId})
                </option>
              ))}
            </select>
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
          {editingUser ? (
            <>
              <Pencil className="size-4" />
              Update User
            </>
          ) : (
            <>
              <Plus className="size-4" />
              Add User
            </>
          )}
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

      {activeTab === "add" || editingUser ? renderFormCard() : null}

      {activeTab === "list" && isLoading ? (
        <div className="rounded-xl border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
          Loading users...
        </div>
      ) : null}

      {activeTab === "list" && error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load users.
        </div>
      ) : null}

      {activeTab === "list" && !isLoading && !error && users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
          <Users className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">No users yet</p>
          <p className="mt-1 text-sm text-foreground/70">
            Add your first user from the Add User tab.
          </p>
        </div>
      ) : null}

      {activeTab === "list" && !isLoading && !error && users.length > 0 ? (
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
            designationsLoading={designationsLoading}
            entitiesLoading={entitiesLoading}
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
        </div>
      ) : null}
    </div>
  );
}
