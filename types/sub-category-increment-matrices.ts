export interface SubCategoryIncrementMatrixRecord {
  id: number;
  financialYearId: number;
  matrixLabel: string;
  performanceMatrixLabel: string;
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
  performanceLevelId: number;
  performanceQuartileId: number;
  incrementPercentage: number;
}

export interface UpdateSubCategoryIncrementMatrixInput {
  matrixLabel: string;
  performanceLevelId: number;
  performanceQuartileId: number;
  incrementPercentage: number;
}

export interface IncrementMatrixAssignmentRecord {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  matrixLabel: string;
  financialYearId: number;
}

export interface IncrementMatrixSummary {
  financialYearId: number;
  financialYearLabel: string;
  isActiveYear: boolean;
  matrixLabel: string;
  title: string;
  cellCount: number;
  assignedEmployeeCount: number;
  updatedAt: string;
}

export interface CreateIncrementMatrixInput {
  financialYearId: number;
  matrixLabel: string;
  title: string;
}

export interface UpdateIncrementMatrixIdentityInput {
  financialYearId: number;
  matrixLabel: string;
  newMatrixLabel: string;
  title: string;
}

export interface CopyIncrementMatrixInput {
  sourceFinancialYearId: number;
  sourceMatrixLabel: string;
  targetFinancialYearId: number;
  newMatrixLabel: string;
  title: string;
}
