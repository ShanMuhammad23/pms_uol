import type { PerformanceLevelWithQuartiles } from "@/types/performance-matrices";

function createMockPerformanceMatrix(): PerformanceLevelWithQuartiles[] {
  const levelDefs = [
    { name: "Unsatisfactory", sortOrder: 0, scoreMin: 0, scoreMax: 39 },
    { name: "Improvement Needed", sortOrder: 1, scoreMin: 40, scoreMax: 54 },
    { name: "Strong", sortOrder: 2, scoreMin: 55, scoreMax: 69 },
    { name: "Excellent", sortOrder: 3, scoreMin: 70, scoreMax: 84 },
    { name: "Outstanding", sortOrder: 4, scoreMin: 85, scoreMax: 100 },
  ];

  return levelDefs.map((levelDef, levelIndex) => {
    const levelId = levelIndex + 1;
    const bandSize = (levelDef.scoreMax - levelDef.scoreMin + 1) / 4;

    return {
      id: levelId,
      financialYearId: 1,
      name: levelDef.name,
      sortOrder: levelDef.sortOrder,
      createdAt: "",
      updatedAt: "",
      quartiles: Array.from({ length: 4 }, (_, quartileIndex) => {
        const scoreMin =
          quartileIndex === 0
            ? levelDef.scoreMin
            : Math.ceil(levelDef.scoreMin + quartileIndex * bandSize);
        const scoreMax =
          quartileIndex === 3
            ? levelDef.scoreMax
            : Math.floor(levelDef.scoreMin + (quartileIndex + 1) * bandSize - 1);

        return {
          id: levelId * 10 + quartileIndex + 1,
          performanceLevelId: levelId,
          name: `Q${quartileIndex + 1}`,
          scoreMin,
          scoreMax,
          sortOrder: quartileIndex,
          createdAt: "",
          updatedAt: "",
        };
      }),
    };
  });
}

export const MOCK_PERFORMANCE_MATRIX = createMockPerformanceMatrix();
