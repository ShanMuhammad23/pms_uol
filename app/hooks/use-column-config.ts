"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchColumnConfig,
  saveColumnConfig,
  type ColumnConfig,
} from "@/lib/queries/column-widths-client";

export const MIN_COLUMN_WIDTH = 80;
export const MAX_COLUMN_WIDTH = 600;
export const SELECT_COLUMN_WIDTH = 48;

export interface ColumnDef {
  id: string;
  label: string;
  pinned?: boolean;
  width?: number;
}

export interface UseColumnConfigOptions {
  allColumns: readonly ColumnDef[];
  allowedColumnIds?: readonly string[];
  /**
   * Whether the table renders the sticky selection-checkbox column at
   * left-0. When true, frozen-column offsets start at SELECT_COLUMN_WIDTH.
   * When false (e.g. non-HR roles in the Staff Listing), offsets start at 0
   * so frozen columns are not pushed past a non-existent checkbox column.
   * Defaults to true for backward compatibility.
   */
  hasSelectColumn?: boolean;
  /**
   * When provided, the hook ignores saved server preferences and always
   * returns this fixed configuration. Used for roles that do not get column
   * management (e.g. Manager 1 / Manager 2 in the Staff Listing).
   *
   * The fixed config is derived from a role-based column layout — see
   * `getStaffListingColumns` / `MANAGER_FIXED_COLUMNS` in
   * dashboard-table-columns.ts. No reads or writes to the column-preferences
   * API occur while this is set.
   */
  fixedConfig?: ColumnConfig;
}

function buildDefaultConfig(
  allColumns: readonly ColumnDef[],
  allowedColumnIds?: readonly string[],
): ColumnConfig {
  const allowed = allowedColumnIds
    ? new Set(allowedColumnIds)
    : null;
  const columns = allColumns.filter(
    (col) => !allowed || allowed.has(col.id),
  );
  return {
    order: columns.map((col) => col.id),
    visible: columns.map((col) => col.id),
    frozen: [],
    widths: {},
  };
}

function mergeWithDefaults(
  saved: ColumnConfig,
  allColumns: readonly ColumnDef[],
  allowedColumnIds?: readonly string[],
): ColumnConfig {
  const defaults = buildDefaultConfig(allColumns, allowedColumnIds);

  // First-time user: no saved preferences (API returns empty arrays).
  // Use defaults so all RBAC-permitted columns are visible.
  if (saved.order.length === 0 && saved.visible.length === 0) {
    return defaults;
  }

  const allowed = allowedColumnIds
    ? new Set(allowedColumnIds)
    : null;
  const allIds = new Set(allColumns.map((col) => col.id));

  // Normalize order: saved order first, then append any new columns
  const seen = new Set<string>();
  const order: string[] = [];
  for (const id of [...saved.order, ...defaults.order]) {
    if (seen.has(id)) continue;
    if (allIds.has(id) && (!allowed || allowed.has(id))) {
      seen.add(id);
      order.push(id);
    }
  }

  // Normalize visible: filter to allowed columns. Empty saved visible means
  // "use defaults" (API returns [] when no preference row exists yet).
  // Additionally, any columns that are truly new (not present in the saved
  // config's order at all — e.g. added to the codebase or newly allowed via
  // additional-access permissions) are automatically made visible so they
  // surface without requiring a manual toggle.
  //
  // IMPORTANT: columns that are in saved.order but NOT in saved.visible were
  // intentionally hidden by the user. They must NOT be re-shown here — only
  // genuinely new columns (absent from saved.order entirely) are auto-shown.
  const savedOrderSet = new Set(saved.order);
  const visibleFiltered = saved.visible.filter(
    (id) =>
      allIds.has(id) &&
      (!allowed || allowed.has(id)),
  );
  const newlyAllowed = defaults.visible.filter(
    (id) => !savedOrderSet.has(id),
  );
  const visible =
    visibleFiltered.length > 0
      ? [...visibleFiltered, ...newlyAllowed]
      : defaults.visible;

  // Normalize frozen: must be subset of visible
  const visibleSet = new Set(visible);
  const frozen = saved.frozen.filter((id) => visibleSet.has(id));

  // Normalize widths: filter to known columns
  const widths: Record<string, number> = {};
  for (const [key, value] of Object.entries(saved.widths)) {
    if (allIds.has(key)) {
      widths[key] = Math.max(
        MIN_COLUMN_WIDTH,
        Math.min(MAX_COLUMN_WIDTH, Math.round(value)),
      );
    }
  }

  return { order, visible, frozen, widths };
}

export function useColumnConfig(
  tableKey: string,
  options: UseColumnConfigOptions,
) {
  const { allColumns, allowedColumnIds, hasSelectColumn = true, fixedConfig } = options;
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ["column-config", tableKey] as const,
    [tableKey],
  );

  // When fixedConfig is provided, skip the server query entirely — the role
  // does not get column management and saved preferences are ignored.
  const isFixed = fixedConfig != null;

  const { data: savedConfig } = useQuery<ColumnConfig>({
    queryKey,
    queryFn: () => fetchColumnConfig(tableKey),
    staleTime: Infinity,
    enabled: !isFixed,
  });

  const defaults = useMemo(
    () => buildDefaultConfig(allColumns, allowedColumnIds),
    [allColumns, allowedColumnIds],
  );

  const [config, setConfig] = useState<ColumnConfig>(
    fixedConfig ?? defaults,
  );
  const [hydrated, setHydrated] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [prevFixedConfig, setPrevFixedConfig] = useState(fixedConfig);
  if (isFixed) {
    if (fixedConfig !== prevFixedConfig) {
      setPrevFixedConfig(fixedConfig);
      if (fixedConfig) {
        setConfig(fixedConfig);
      }
    }
    if (!hydrated) {
      setHydrated(true);
    }
    if (!initialized) {
      setInitialized(true);
    }
  } else if (!initialized && savedConfig) {
    setInitialized(true);
    const merged = mergeWithDefaults(savedConfig, allColumns, allowedColumnIds);
    setConfig(merged);
    setHydrated(true);
  }

  useEffect(() => {
    if (isFixed || !savedConfig) {
      return;
    }
    const isFirstTime =
      savedConfig.order.length === 0 && savedConfig.visible.length === 0;
    if (!isFirstTime) {
      return;
    }
    const merged = mergeWithDefaults(savedConfig, allColumns, allowedColumnIds);
    void saveColumnConfig(tableKey, merged);
    void queryClient.setQueryData(queryKey, merged);
  }, [savedConfig, allColumns, allowedColumnIds, tableKey, queryKey, queryClient, isFixed]);

  const columnsKey = `${allColumns.map((column) => column.id).join(",")}:${allowedColumnIds?.join(",") ?? ""}`;
  const [prevColumnsKey, setPrevColumnsKey] = useState(columnsKey);
  if (!isFixed && initialized && columnsKey !== prevColumnsKey) {
    setPrevColumnsKey(columnsKey);
    setConfig((current) =>
      mergeWithDefaults(current, allColumns, allowedColumnIds),
    );
  }

  const persist = useCallback(
    (next: ColumnConfig) => {
      // Never persist when using a fixed config (managers have no prefs).
      if (isFixed) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        void saveColumnConfig(tableKey, next);
      }, 500);
    },
    [tableKey, isFixed],
  );

  const updateConfig = useCallback(
    (next: ColumnConfig) => {
      setConfig(next);
      persist(next);
      if (!isFixed) {
        void queryClient.setQueryData(queryKey, next);
      }
    },
    [persist, queryClient, queryKey, isFixed],
  );

  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      const clamped = Math.max(
        MIN_COLUMN_WIDTH,
        Math.min(MAX_COLUMN_WIDTH, Math.round(width)),
      );
      setConfig((current) => {
        const next = {
          ...current,
          widths: { ...current.widths, [columnId]: clamped },
        };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const getColumnWidth = useCallback(
    (columnId: string, defaultWidth?: number): number | undefined => {
      if (config.widths[columnId] != null) return config.widths[columnId];
      return defaultWidth;
    },
    [config.widths],
  );

  const resetConfig = useCallback(() => {
    updateConfig(defaults);
  }, [defaults, updateConfig]);

  // Compute visible ordered columns
  const visibleOrderedColumns = useMemo(() => {
    const byId = new Map(allColumns.map((col) => [col.id, col]));
    const visibleSet = new Set(config.visible);
    const result: ColumnDef[] = [];
    const seen = new Set<string>();

    // Frozen columns first (in their order)
    for (const id of config.frozen) {
      if (visibleSet.has(id) && !seen.has(id)) {
        const col = byId.get(id);
        if (col) {
          result.push(col);
          seen.add(id);
        }
      }
    }

    // Non-frozen visible columns in order
    for (const id of config.order) {
      if (visibleSet.has(id) && !seen.has(id)) {
        const col = byId.get(id);
        if (col) {
          result.push(col);
          seen.add(id);
        }
      }
    }

    // Append any visible columns not in order (new columns)
    for (const col of allColumns) {
      if (visibleSet.has(col.id) && !seen.has(col.id)) {
        result.push(col);
        seen.add(col.id);
      }
    }

    return result;
  }, [allColumns, config.visible, config.frozen, config.order]);

  // Compute frozen columns
  const frozenColumnIds = useMemo(
    () => {
      const visibleSet = new Set(config.visible);
      return config.frozen.filter((id) => visibleSet.has(id));
    },
    [config.frozen, config.visible],
  );

  // Compute sticky left offsets for frozen columns.
  // The starting offset accounts for the checkbox column only when it is
  // actually rendered (hasSelectColumn). Each frozen column's left offset
  // equals the cumulative width of all preceding sticky columns.
  const stickyOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = hasSelectColumn ? SELECT_COLUMN_WIDTH : 0;
    const byId = new Map(allColumns.map((col) => [col.id, col]));
    for (const id of frozenColumnIds) {
      offsets[id] = left;
      const col = byId.get(id);
      // Use the same width resolution as getColumnWidth to stay in sync with
      // the actual cell width. Fall back to MIN_COLUMN_WIDTH (not an
      // arbitrary 120) so the offset never underestimates a column that has
      // no explicit width and hasn't been resized yet.
      const w = config.widths[id] ?? col?.width ?? MIN_COLUMN_WIDTH;
      left += w;
    }
    return offsets;
  }, [allColumns, config.widths, frozenColumnIds, hasSelectColumn]);

  return {
    config,
    defaults,
    hydrated,
    visibleOrderedColumns,
    frozenColumnIds,
    lastFrozenColumnId: frozenColumnIds.length > 0 ? frozenColumnIds[frozenColumnIds.length - 1] : null,
    stickyOffsets,
    getColumnWidth,
    setColumnWidth,
    updateConfig,
    resetConfig,
  };
}
