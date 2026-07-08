export const getPerformanceLevelColor = (performanceLevel: string) => {
  switch (performanceLevel) {
    case "Outstanding":
      return "bg-violet-500";
    case "Excellent":
      return "bg-emerald-500";
    case "Strong":
      return "bg-blue-500";
    case "Improvement Needed":
      return "bg-orange-500";
    case "Unsatisfactory":
      return "bg-rose-500";
  }
};