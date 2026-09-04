export type NumericRangeFilter = {
  gt?: number;
  lt?: number;
};

export function hasNumericRange(
  filter: NumericRangeFilter | undefined,
): boolean {
  if (!filter) return false;
  return filter.gt != null || filter.lt != null;
}

export function matchesNumericRange(
  value: number,
  filter: NumericRangeFilter,
): boolean {
  if (filter.gt != null && !(value >= filter.gt)) return false;
  if (filter.lt != null && !(value <= filter.lt)) return false;
  return true;
}

/** Serialize a range for URL search params (`gt:1|lt:5`). */
export function serializeNumericRange(
  filter: NumericRangeFilter | undefined,
): string | null {
  if (!hasNumericRange(filter)) return null;
  const parts: string[] = [];
  if (filter!.gt != null) parts.push(`gt:${filter!.gt}`);
  if (filter!.lt != null) parts.push(`lt:${filter!.lt}`);
  return parts.join("|");
}

/** Parse `gt:1|lt:5` (either part optional) back into a range filter. */
export function parseNumericRangeParam(
  raw: string | null,
): NumericRangeFilter | undefined {
  if (!raw?.trim()) return undefined;
  const next: NumericRangeFilter = {};
  for (const part of raw.split("|")) {
    const [key, value] = part.split(":");
    if (value == null || value.trim() === "") continue;
    const num = Number(value);
    if (!Number.isFinite(num)) continue;
    if (key === "gt") next.gt = num;
    if (key === "lt") next.lt = num;
  }
  return hasNumericRange(next) ? next : undefined;
}

export function parseNumericCell(cellValue: string): number | null {
  if (cellValue === "—" || !cellValue) return null;
  const num = Number(cellValue.replace(/,/g, ""));
  return Number.isNaN(num) ? null : num;
}

export function formatNumericRangeLabel(
  filter: NumericRangeFilter | undefined,
): string | null {
  if (!filter || !hasNumericRange(filter)) return null;
  const { gt, lt } = filter;
  if (gt != null && lt != null) return `${gt} - ${lt}`;
  if (gt != null) return `≥${gt}`;
  if (lt != null) return `≤${lt}`;
  return null;
}
