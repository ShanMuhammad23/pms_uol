import type { MatrixQuartileColumn } from "@/lib/performance-matrix";

export type EmployeeCategory =
  | "Academic"
  | "Administrative"
  | "Support Staff"
  | "Blue-Collar"
  | "Management";

export type FormState =
  | "PENDING_SELF_ASSESSMENT"
  | "PENDING_HEAD_REVIEW"
  | "PENDING_HR_CALIBRATION"
  | "PENDING_BOARD_APPROVAL"
  | "APPROVED"


export type EligibilityStatus =
  | "Fully Eligible"
  | "Partially Eligible"
  | "Not Eligible";

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
