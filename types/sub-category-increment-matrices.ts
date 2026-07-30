export interface SubCategoryIncrementMatrixRecord {
  id: number;
  financialYearId: number;
  matrixLabel: string;
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
