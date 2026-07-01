export interface FinancialYearRecord {
  id: number;
  year: number;
  label: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinancialYearInput {
  year: number;
  label: string;
  isActive?: boolean;
}

export interface UpdateFinancialYearInput {
  year: number;
  label: string;
  isActive?: boolean;
}
