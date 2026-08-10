export type AdditionalAccessModule =
  | "FORMS"
  | "CREDIT_HOURS"
  | "ORIC_ADJUSTMENTS"
  | "QEC_ADJUSTMENTS"
  | "USERS"
  | "MATRICES_AND_CYCLES"
  | "ORGANIZATION_LEVELS";

export type AdditionalAccessLevel = "VIEW_ONLY" | "EDIT";

export interface AdditionalAccessPermission {
  module: AdditionalAccessModule;
  accessLevel: AdditionalAccessLevel;
}

export const ADDITIONAL_ACCESS_MODULES: AdditionalAccessModule[] = [
  "FORMS",
  "CREDIT_HOURS",
  "ORIC_ADJUSTMENTS",
  "QEC_ADJUSTMENTS",
  "USERS",
  "MATRICES_AND_CYCLES",
  "ORGANIZATION_LEVELS",
];

export const ADDITIONAL_ACCESS_MODULE_LABELS: Record<
  AdditionalAccessModule,
  string
> = {
  FORMS: "Forms",
  CREDIT_HOURS: "Credit Hours",
  ORIC_ADJUSTMENTS: "ORIC Adjustments",
  QEC_ADJUSTMENTS: "QEC Adjustments",
  USERS: "Users",
  MATRICES_AND_CYCLES: "Matrices and Cycles",
  ORGANIZATION_LEVELS: "Organization Levels",
};

export const ADDITIONAL_ACCESS_LEVELS: AdditionalAccessLevel[] = [
  "VIEW_ONLY",
  "EDIT",
];

export const ADDITIONAL_ACCESS_LEVEL_LABELS: Record<
  AdditionalAccessLevel,
  string
> = {
  VIEW_ONLY: "View Only",
  EDIT: "Edit",
};

export function isAdditionalAccessModule(
  value: unknown,
): value is AdditionalAccessModule {
  return (
    typeof value === "string" &&
    ADDITIONAL_ACCESS_MODULES.includes(value as AdditionalAccessModule)
  );
}

export function isAdditionalAccessLevel(
  value: unknown,
): value is AdditionalAccessLevel {
  return (
    typeof value === "string" &&
    ADDITIONAL_ACCESS_LEVELS.includes(value as AdditionalAccessLevel)
  );
}
