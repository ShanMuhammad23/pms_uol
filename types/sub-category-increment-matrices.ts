import type { EmployeeCategory, SubCategory } from "@/types/forms";

export interface SubCategoryIncrementMatrixRecord {
  id: number;
  financialYearId: number;
  matrixLabel: string;
  targetCategory: EmployeeCategory;
  targetSubCategory: SubCategory;
  performanceLevelId: number;
  performanceLevelName: string;
  performanceQuartileId: number;
  performanceQuartileName: string;
  incrementPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubCategoryIncrementMatrixInput {
  financialYearId: number;
  matrixLabel: string;
  targetCategory: EmployeeCategory;
  targetSubCategory: SubCategory;
  performanceLevelId: number;
  performanceQuartileId: number;
  incrementPercentage: number;
}

export interface UpdateSubCategoryIncrementMatrixInput {
  matrixLabel: string;
  targetCategory: EmployeeCategory;
  targetSubCategory: SubCategory;
  performanceLevelId: number;
  performanceQuartileId: number;
  incrementPercentage: number;
}
