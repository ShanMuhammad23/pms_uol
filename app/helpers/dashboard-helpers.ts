const PERFORMANCE_LEVEL_COLORS = [
  "bg-violet-500",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-teal-500",
] as const;

const PERFORMANCE_LEVEL_TINTS = [
  "bg-violet-500/15 text-violet-800 border-violet-300 dark:text-violet-200 dark:border-violet-500/40",
  "bg-emerald-500/15 text-emerald-800 border-emerald-300 dark:text-emerald-200 dark:border-emerald-500/40",
  "bg-blue-500/15 text-blue-800 border-blue-300 dark:text-blue-200 dark:border-blue-500/40",
  "bg-sky-500/15 text-sky-800 border-sky-300 dark:text-sky-200 dark:border-sky-500/40",
  "bg-amber-500/15 text-amber-800 border-amber-300 dark:text-amber-200 dark:border-amber-500/40",
  "bg-orange-500/15 text-orange-800 border-orange-300 dark:text-orange-200 dark:border-orange-500/40",
  "bg-rose-500/15 text-rose-800 border-rose-300 dark:text-rose-200 dark:border-rose-500/40",
  "bg-teal-500/15 text-teal-800 border-teal-300 dark:text-teal-200 dark:border-teal-500/40",
] as const;

const NAMED_LEVEL_COLORS: Record<string, string> = {
  Outstanding: "bg-violet-500",
  Excellent: "bg-emerald-500",
  Strong: "bg-blue-500",
  "Improvement Needed": "bg-orange-500",
  Unsatisfactory: "bg-rose-500",
};

/** Staff-listing Rating (O) abbreviations → canonical performance level names. */
const RATING_CODE_TO_LEVEL: Record<string, string> = {
  OS: "Outstanding",
  EX: "Excellent",
  ST: "Strong",
  IN: "Improvement Needed",
  UN: "Unsatisfactory",
};

export function canonicalPerformanceLevelName(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  if (trimmed.length <= 3) {
    const fromCode = RATING_CODE_TO_LEVEL[trimmed.toUpperCase()];
    if (fromCode) return fromCode;
  }
  const named = Object.keys(NAMED_LEVEL_COLORS).find(
    (key) => key.toLowerCase() === trimmed.toLowerCase(),
  );
  return named ?? trimmed;
}

const NAMED_LEVEL_TINTS: Record<string, string> = {
  Outstanding:
    "bg-violet-500/15 text-violet-800 border-violet-300 dark:text-violet-200 dark:border-violet-500/40",
  Excellent:
    "bg-emerald-500/15 text-emerald-800 border-emerald-300 dark:text-emerald-200 dark:border-emerald-500/40",
  Strong:
    "bg-blue-500/15 text-blue-800 border-blue-300 dark:text-blue-200 dark:border-blue-500/40",
  "Improvement Needed":
    "bg-orange-500/15 text-orange-800 border-orange-300 dark:text-orange-200 dark:border-orange-500/40",
  Unsatisfactory:
    "bg-rose-500/15 text-rose-800 border-rose-300 dark:text-rose-200 dark:border-rose-500/40",
};

const QUARTILE_SHADES = [
  "bg-white/15",
  "bg-white/25",
  "bg-white/35",
  "bg-white/45",
  "bg-white/55",
] as const;

export const getPerformanceLevelColor = (
  performanceLevel: string,
  index = 0,
) => {
  const key = canonicalPerformanceLevelName(performanceLevel);
  return (
    NAMED_LEVEL_COLORS[key] ??
    PERFORMANCE_LEVEL_COLORS[index % PERFORMANCE_LEVEL_COLORS.length]
  );
};

export const getPerformanceLevelTint = (
  performanceLevel: string,
  index = 0,
) => {
  const key = canonicalPerformanceLevelName(performanceLevel);
  return (
    NAMED_LEVEL_TINTS[key] ??
    PERFORMANCE_LEVEL_TINTS[index % PERFORMANCE_LEVEL_TINTS.length]
  );
};

export const getQuartileShade = (quartileIndex: number) => {
  return QUARTILE_SHADES[Math.min(quartileIndex, QUARTILE_SHADES.length - 1)];
};
