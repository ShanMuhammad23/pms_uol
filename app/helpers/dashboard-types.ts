import type { MatrixQuartileColumn } from "@/lib/performance-matrix";

export type EmployeeCategory =
  | "Academic"
  | "Administrative"
  | "Support Staff"
  | "Blue-Collar"
  | "Management";

export type FormState =
  | "PENDING_SELF_ASSESSMENT"
  | "PENDING_DIRECT_ASSESSMENT"
  | "PENDING_MANAGER_1_REVIEW"
  | "PENDING_MANAGER_2_REVIEW"
  | "PENDING_HR_CALIBRATION"
  | "PENDING_BOARD_APPROVAL"
  | "APPROVED"


export type EligibilityStatus =
  | "Fully Eligible"
  | "Partially Eligible"
  | "Not Eligible"
  | "Ineligible";

/**
 * Identifies which dashboard card number was clicked, so the staff listing
 * can be filtered using the exact same predicate that produced the count.
 *
 * Format: "{cardId}:{numberId}" — e.g. "selfAssessment:submitted".
 * The `eligibility:` variant carries the raw EligibilityStatus value
 * (e.g. "eligibility:Fully Eligible").
 */
export type CardFilterId =
  | `eligibility:${EligibilityStatus}`
  | "selfAssessment:eligible"
  | "selfAssessment:submitted"
  | "manager1:submitted"
  | "manager1:reviewed"
  | "manager2:submitted"
  | "manager2:reviewed"
  | "hrAlignment:submitted"
  | "hrAlignment:aligned"
  | "boardApproval:pending"
  | "boardApproval:approved";

export type RatingQuartileMatrixCell = {
  id: number | null;
  label: string;
  sortOrder: number;
  sublabel: string;
  count: number | null;
};

export type RatingQuartileMatrixRow = {
  levelId: number;
  rating: string;
  sortOrder: number;
  quartiles: RatingQuartileMatrixCell[];
  rowTotal: number;
};

export type RatingQuartileMatrixData = {
  rows: RatingQuartileMatrixRow[];
  columns: MatrixQuartileColumn[];
};
