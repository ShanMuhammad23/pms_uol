export const queryKeys = {
  financialYears: ["financial-years"] as const,
  performanceMatrix: (financialYearId: number | null) =>
    ["performance-matrix", financialYearId] as const,
  staffCategoriesWithSubCategories: ["staff-categories-with-subcategories"] as const,
  entities: ["entities"] as const,
  formSubmissions: ["form-submissions"] as const,
};
