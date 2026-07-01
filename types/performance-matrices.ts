export interface PerformanceLevelRecord {
  id: number;
  financialYearId: number;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceQuartileRecord {
  id: number;
  performanceLevelId: number;
  name: string;
  scoreMin: number;
  scoreMax: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceLevelWithQuartiles extends PerformanceLevelRecord {
  quartiles: PerformanceQuartileRecord[];
}

export interface CreatePerformanceLevelInput {
  financialYearId: number;
  name: string;
  sortOrder?: number;
}

export interface UpdatePerformanceLevelInput {
  name: string;
  sortOrder?: number;
}

export interface CreatePerformanceQuartileInput {
  performanceLevelId: number;
  name: string;
  scoreMin: number;
  scoreMax: number;
  sortOrder?: number;
}

export interface UpdatePerformanceQuartileInput {
  name: string;
  scoreMin: number;
  scoreMax: number;
  sortOrder?: number;
}
