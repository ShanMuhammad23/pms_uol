import type { EmployeeCategory } from "@/app/helpers/dashboard-types";

export const CATEGORY_CONFIG: Record<
  EmployeeCategory,
  { color: string; bg: string; border: string }
> = {
  Academic: { color: "text-slate-800", bg: "bg-slate-100", border: "border-slate-200" },
  Administrative: { color: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200" },
  "Support Staff": { color: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200" },
  "Blue-Collar": { color: "text-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200" },
  Management: { color: "text-violet-800", bg: "bg-violet-50", border: "border-violet-200" },
};

const DEFAULT_CATEGORY_BADGE = {
  color: "text-slate-800",
  bg: "bg-slate-100",
  border: "border-slate-200",
};

export function getCategoryBadgeStyle(categoryName: string | null) {
  if (!categoryName) {
    return DEFAULT_CATEGORY_BADGE;
  }

  const configEntry = (Object.keys(CATEGORY_CONFIG) as EmployeeCategory[]).find(
    (key) => key.toLowerCase() === categoryName.toLowerCase(),
  );

  return configEntry ? CATEGORY_CONFIG[configEntry] : DEFAULT_CATEGORY_BADGE;
}
