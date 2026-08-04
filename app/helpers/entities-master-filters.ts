import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  ENTITIES_TABLE_COLUMNS,
  type EntitiesTableColumnDef,
  type EntitiesTableColumnId,
} from "@/app/helpers/entities-table-columns";
import {
  hasNumericRange,
  matchesNumericRange,
  parseNumericCell,
  type NumericRangeFilter,
} from "@/app/helpers/numeric-range-filter";
import type { EntityRecord } from "@/types/entities";

/** Columns excluded from the master filter entirely. */
const MASTER_FILTER_EXCLUDED_IDS = new Set<EntitiesTableColumnId>(["actions"]);

/**
 * Free-text / high-cardinality fields use a search box instead of multi-select.
 */
export const ENTITIES_MASTER_FILTER_TEXT_COLUMN_IDS = [
  "name",
] as const satisfies readonly EntitiesTableColumnId[];

export type EntitiesMasterFilterTextColumnId =
  (typeof ENTITIES_MASTER_FILTER_TEXT_COLUMN_IDS)[number];

const MASTER_FILTER_TEXT_ID_SET = new Set<EntitiesTableColumnId>(
  ENTITIES_MASTER_FILTER_TEXT_COLUMN_IDS,
);

/** `null` = all selected (no filter). `[]` = none selected. */
export type EntitiesMasterFilterMultiSelection = string[] | null;

export type EntitiesMasterFilterState = {
  text: Partial<Record<EntitiesMasterFilterTextColumnId, string>>;
  multi: Partial<
    Record<EntitiesTableColumnId, EntitiesMasterFilterMultiSelection>
  >;
  numeric: Partial<Record<EntitiesTableColumnId, NumericRangeFilter>>;
};

export const EMPTY_ENTITIES_MASTER_FILTER_STATE: EntitiesMasterFilterState = {
  text: {},
  multi: {},
  numeric: {},
};

export const ENTITIES_MASTER_FILTER_TEXT_COLUMNS: EntitiesTableColumnDef[] =
  ENTITIES_TABLE_COLUMNS.filter((column) =>
    MASTER_FILTER_TEXT_ID_SET.has(column.id),
  );

export const ENTITIES_MASTER_FILTER_MULTI_COLUMNS: EntitiesTableColumnDef[] =
  ENTITIES_TABLE_COLUMNS.filter(
    (column) =>
      !MASTER_FILTER_EXCLUDED_IDS.has(column.id) &&
      !MASTER_FILTER_TEXT_ID_SET.has(column.id),
  );

export const ENTITIES_MASTER_FILTER_NUMERIC_COLUMNS: EntitiesTableColumnDef[] =
  ENTITIES_TABLE_COLUMNS.filter(
    (column) =>
      !MASTER_FILTER_EXCLUDED_IDS.has(column.id) && column.numeric === true,
  );

export function isEntitiesMasterFilterTextColumn(
  columnId: EntitiesTableColumnId,
): columnId is EntitiesMasterFilterTextColumnId {
  return MASTER_FILTER_TEXT_ID_SET.has(columnId);
}

export function isEntitiesMasterFilterableColumn(
  columnId: EntitiesTableColumnId,
): boolean {
  return !MASTER_FILTER_EXCLUDED_IDS.has(columnId);
}

function matchesTextQuery(cellValue: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  if (cellValue === "—") {
    return false;
  }

  return cellValue.toLowerCase().includes(normalizedQuery);
}

export function matchesEntitiesMasterFilters(
  entity: EntityRecord,
  filters: EntitiesMasterFilterState,
): boolean {
  return matchesEntitiesMasterFiltersExcluding(entity, filters, null);
}

export function matchesEntitiesMasterFiltersExcluding(
  entity: EntityRecord,
  filters: EntitiesMasterFilterState,
  excludeColumnId: EntitiesTableColumnId | null,
): boolean {
  for (const column of ENTITIES_MASTER_FILTER_TEXT_COLUMNS) {
    if (excludeColumnId === column.id) {
      continue;
    }

    const query = filters.text[column.id as EntitiesMasterFilterTextColumnId];
    if (!query?.trim()) {
      continue;
    }

    if (!matchesTextQuery(column.getValue(entity), query)) {
      return false;
    }
  }

  for (const column of ENTITIES_MASTER_FILTER_MULTI_COLUMNS) {
    if (excludeColumnId === column.id) {
      continue;
    }

    const selected = filters.multi[column.id];

    if (selected === undefined || selected === null) {
      continue;
    }

    if (selected.length === 0) {
      return false;
    }

    if (!selected.includes(column.getValue(entity))) {
      return false;
    }
  }

  for (const column of ENTITIES_MASTER_FILTER_NUMERIC_COLUMNS) {
    if (excludeColumnId === column.id) {
      continue;
    }

    const range = filters.numeric[column.id];
    if (!hasNumericRange(range)) {
      continue;
    }

    const cellValue = column.getValue(entity);
    const numValue = parseNumericCell(cellValue);
    if (numValue === null || !matchesNumericRange(numValue, range!)) {
      return false;
    }
  }

  return true;
}

export function buildEntitiesMasterFilterOptions(
  entities: EntityRecord[],
  column: EntitiesTableColumnDef,
  filters: EntitiesMasterFilterState = EMPTY_ENTITIES_MASTER_FILTER_STATE,
  selectedValues: EntitiesMasterFilterMultiSelection = null,
): MultiSelectOption[] {
  const counts = new Map<string, number>();

  for (const entity of entities) {
    if (!matchesEntitiesMasterFiltersExcluding(entity, filters, column.id)) {
      continue;
    }

    const value = column.getValue(entity);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  if (selectedValues) {
    for (const value of selectedValues) {
      if (!counts.has(value)) {
        counts.set(value, 0);
      }
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: value,
      count,
    }))
    .filter(
      (option) =>
        option.count > 0 || selectedValues?.includes(option.value) === true,
    )
    .sort((left, right) => {
      if (left.value === "—") return 1;
      if (right.value === "—") return -1;
      return left.label.localeCompare(right.label, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

export function applyEntitiesMasterFilters(
  entities: EntityRecord[],
  filters: EntitiesMasterFilterState,
): EntityRecord[] {
  if (!hasActiveEntitiesMasterFilters(filters)) {
    return entities;
  }

  return entities.filter((entity) =>
    matchesEntitiesMasterFilters(entity, filters),
  );
}

export function hasActiveEntitiesMasterFilters(
  filters: EntitiesMasterFilterState,
): boolean {
  return countActiveEntitiesMasterFilters(filters) > 0;
}

export function isEntitiesColumnFilterActive(
  filters: EntitiesMasterFilterState,
  columnId: EntitiesTableColumnId,
): boolean {
  if (isEntitiesMasterFilterTextColumn(columnId)) {
    return Boolean(filters.text[columnId]?.trim());
  }

  const selected = filters.multi[columnId];
  if (selected !== undefined && selected !== null) {
    return true;
  }

  if (hasNumericRange(filters.numeric[columnId])) {
    return true;
  }

  return false;
}

export function countActiveEntitiesMasterFilters(
  filters: EntitiesMasterFilterState,
): number {
  const textCount = ENTITIES_MASTER_FILTER_TEXT_COLUMNS.reduce(
    (count, column) => {
      const query = filters.text[column.id as EntitiesMasterFilterTextColumnId];
      return query?.trim() ? count + 1 : count;
    },
    0,
  );

  const multiCount = ENTITIES_MASTER_FILTER_MULTI_COLUMNS.reduce(
    (count, column) => {
      const selected = filters.multi[column.id];
      return selected !== undefined && selected !== null ? count + 1 : count;
    },
    0,
  );

  const numericCount = ENTITIES_MASTER_FILTER_NUMERIC_COLUMNS.reduce(
    (count, column) => {
      return hasNumericRange(filters.numeric[column.id]) ? count + 1 : count;
    },
    0,
  );

  return textCount + multiCount + numericCount;
}
