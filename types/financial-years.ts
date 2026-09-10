export interface FinancialYearRecord {
  id: number;
  year: number;
  label: string;
  isActive: boolean;
  /** ISO date YYYY-MM-DD — start of the appraisal cycle window. */
  cycleStartDate: string;
  /**
   * ISO date YYYY-MM-DD — employees whose date of joining is after this date
   * are Not Eligible for the cycle.
   */
  ineligibilityDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinancialYearInput {
  year: number;
  label: string;
  isActive?: boolean;
  cycleStartDate: string;
  ineligibilityDate: string;
}

export interface UpdateFinancialYearInput {
  year: number;
  label: string;
  isActive?: boolean;
  cycleStartDate: string;
  ineligibilityDate: string;
}
