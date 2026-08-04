import type { EligibilityStatus } from "@/app/helpers/dashboard-types";

export const INSTITUTIONAL_QUOTA = [
  { rating: "Unsatisfactory", quota: 5 },
  { rating: "Improvement Needed", quota: 10 },
  { rating: "Strong", quota: 25 },
  { rating: "Excellent", quota: 20 },
  { rating: "Outstanding", quota: 5 },
];

export const WORKFLOW_CHART_SERIES = [
  { dataKey: "draft", name: "Draft", fill: "#94a3b8", labelFill: "#fff" },
  { dataKey: "selfAssessment", name: "Self Assessment", fill: "#cbd5e1", labelFill: "#334155" },
  { dataKey: "headReview", name: "Manager Review", fill: "#d97706", labelFill: "#fff" },
  { dataKey: "hrCalibration", name: "HR Calibration", fill: "#ea580c", labelFill: "#fff" },
  { dataKey: "approved", name: "Approved", fill: "#059669", labelFill: "#fff" },
] as const;

export const ELIGIBILITY_CONFIG: Record<
  EligibilityStatus,
  { light: string; dark: string }
> = {
  "Fully Eligible": { light: "#059669", dark: "#34d399" },
  "Partially Eligible": { light: "#d97706", dark: "#fbbf24" },
  "Not Eligible": { light: "#dc2626", dark: "#f87171" },
  Ineligible: { light: "#64748b", dark: "#94a3b8" },
};

export const CATEGORY_DISTRIBUTION = [
  { name: "Academic", light: "#0f172a", dark: "#60a5fa" },
  { name: "Administrative", light: "#d97706", dark: "#fbbf24" },
  { name: "Support Staff", light: "#64748b", dark: "#94a3b8" },
  { name: "Blue-Collar", light: "#059669", dark: "#34d399" },
  { name: "Management", light: "#7c3aed", dark: "#a78bfa" },
] as const;

export const CATEGORY_COLOR_PALETTE = CATEGORY_DISTRIBUTION.map(({ light, dark }) => ({
  light,
  dark,
}));
