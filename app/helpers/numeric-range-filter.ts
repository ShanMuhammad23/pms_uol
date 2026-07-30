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
  if (filter.gt != null && !(value > filter.gt)) return false;
  if (filter.lt != null && !(value < filter.lt)) return false;
  return true;
}

export function parseNumericCell(cellValue: string): number | null {
  if (cellValue === "—" || !cellValue) return null;
  const num = Number(cellValue);
  return Number.isNaN(num) ? null : num;
}

export function formatNumericRangeLabel(
  filter: NumericRangeFilter | undefined,
): string | null {
  if (!filter || !hasNumericRange(filter)) return null;
  const { gt, lt } = filter;
  if (gt != null && lt != null) return `${gt} - ${lt}`;
  if (gt != null) return `>${gt}`;
  if (lt != null) return `<${lt}`;
  return null;
}
