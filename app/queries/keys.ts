export const queryKeys = {
  financialYears: ["financial-years"] as const,
  performanceMatrix: (financialYearId: number | null) =>
    ["performance-matrix", financialYearId] as const,
  institutionalQuotas: (financialYearId: number | null) =>
    ["institutional-quotas", financialYearId] as const,
  institutionalQuotaChart: (financialYearId: number | null) =>
    ["institutional-quota-chart", financialYearId] as const,
  entities: ["entities"] as const,
  designations: ["designations"] as const,
  formSubmissions: ["form-submissions"] as const,
  dashboardOverview: ["dashboard-overview"] as const,
  users: ["users"] as const,
  usersOverview: ["users", "overview"] as const,
  usersByEmployeeIds: (employeeIds: string[]) =>
    ["users", "by-ids", employeeIds] as const,
};
