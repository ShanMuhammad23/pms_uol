"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import {
  createUser,
  deleteUser,
  fetchDepartments,
  fetchUsers,
  updateUser,
} from "@/lib/queries/users-client";
import {
  CATEGORY_LABELS,
  SUB_CATEGORY_LABELS,
  type EmployeeCategory,
  type SubCategory,
} from "@/types/forms";
import {
  EMPLOYEE_CATEGORIES,
  getSubCategoriesForCategory,
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

interface UserFormState {
  employeeId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  systemRole: UserRole;
  empCategory: EmployeeCategory;
  empSubCategory: SubCategory;
  departmentId: string;
  headId: string;
  isActive: boolean;
}

const defaultCategory: EmployeeCategory = "ACADEMIC";
const defaultSubCategory = getSubCategoriesForCategory(defaultCategory)[0];

const emptyForm: UserFormState = {
  employeeId: "",
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  systemRole: "EMPLOYEE",
  empCategory: defaultCategory,
  empSubCategory: defaultSubCategory,
  departmentId: "",
  headId: "",
  isActive: true,
};

export default function UsersManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);

  const { data: departments, isLoading: departmentsLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
  });

  const {
    data: users,
    isLoading: usersLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const subCategoryOptions = useMemo(
    () => getSubCategoriesForCategory(form.empCategory),
    [form.empCategory],
  );

  const headOptions = useMemo(() => {
    if (!users) {
      return [];
    }

    return users.filter((user) => !editingUser || user.id !== editingUser.id);
  }, [users, editingUser]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingUser(null);
  };

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
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
  const isLoading = departmentsLoading || usersLoading;

  const handleCategoryChange = (empCategory: EmployeeCategory) => {
    const nextSubCategories = getSubCategoriesForCategory(empCategory);

    setForm((current) => ({
      ...current,
      empCategory,
      empSubCategory: nextSubCategories.includes(current.empSubCategory)
        ? current.empSubCategory
        : nextSubCategories[0],
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);

    const payload = {
      employeeId: form.employeeId.trim(),
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      systemRole: form.systemRole,
      empCategory: form.empCategory,
      empSubCategory: form.empSubCategory,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
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
      departmentId: user.departmentId ? String(user.departmentId) : "",
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

  return (
    <div className="space-y-6">
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
              <label htmlFor="user-emp-category" className="mb-1.5 block text-sm font-medium text-text-primary">
                Employee Category
              </label>
              <select
                id="user-emp-category"
                value={form.empCategory}
                onChange={(event) =>
                  handleCategoryChange(event.target.value as EmployeeCategory)
                }
                className={inputClassName}
              >
                {EMPLOYEE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="user-emp-sub-category" className="mb-1.5 block text-sm font-medium text-text-primary">
                Sub-Category
              </label>
              <select
                id="user-emp-sub-category"
                value={form.empSubCategory}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    empSubCategory: event.target.value as SubCategory,
                  }))
                }
                className={inputClassName}
              >
                {subCategoryOptions.map((subCategory) => (
                  <option key={subCategory} value={subCategory}>
                    {SUB_CATEGORY_LABELS[subCategory]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="user-department" className="mb-1.5 block text-sm font-medium text-text-primary">
                Department
              </label>
              <select
                id="user-department"
                value={form.departmentId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, departmentId: event.target.value }))
                }
                className={inputClassName}
              >
                <option value="">None</option>
                {departments?.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
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

      {isLoading ? (
        <div className="rounded-xl border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
          Loading users...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load users.
        </div>
      ) : null}

      {!isLoading && !error && (!users || users.length === 0) ? (
        <div className="rounded-xl border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
          <Users className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">No users yet</p>
          <p className="mt-1 text-sm text-foreground/70">
            Add your first user using the form above.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && users && users.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-300/80 dark:border-white/15">
          <table className="min-w-full text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">Category</th>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">Department</th>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">Head</th>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-text-primary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-slate-300/80 dark:border-white/15"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/70">{user.employeeId}</p>
                    <p className="text-xs text-foreground/70">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {USER_ROLE_LABELS[user.systemRole]}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {CATEGORY_LABELS[user.empCategory]}
                    <span className="block text-xs text-foreground/70">
                      {SUB_CATEGORY_LABELS[user.empSubCategory]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {user.departmentName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {user.headName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        user.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-foreground/70"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(user)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:border-red-900"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
