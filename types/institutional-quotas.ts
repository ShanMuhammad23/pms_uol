import type { PerformanceRating } from "@/types/forms";

export interface InstitutionalQuotaRecord {
  id: number;
  financialYearId: number;
  rating: PerformanceRating;
  quotaPercent: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionalQuotaInput {
  rating: PerformanceRating;
  quotaPercent: number;
  sortOrder?: number;
}

export interface UpsertInstitutionalQuotasInput {
  financialYearId: number;
  quotas: InstitutionalQuotaInput[];
}

export type InstitutionalQuotaChartRow = {
  rating: string;
  quota: number;
};
