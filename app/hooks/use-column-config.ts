"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchColumnConfig,
  saveColumnConfig,
  EMPTY_COLUMN_CONFIG,
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

  // Normalize visible: filter to allowed columns
  const visible = saved.visible.filter(
    (id) =>
      allIds.has(id) &&
      (!allowed || allowed.has(id)),
  );

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
  const { allColumns, allowedColumnIds } = options;
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ["column-config", tableKey] as const,
    [tableKey],
  );

  const { data: savedConfig } = useQuery<ColumnConfig>({
    queryKey,
    queryFn: () => fetchColumnConfig(tableKey),
    staleTime: Infinity,
  });

  const defaults = useMemo(
    () => buildDefaultConfig(allColumns, allowedColumnIds),
    [allColumns, allowedColumnIds],
  );

  const [config, setConfig] = useState<ColumnConfig>(defaults);
  const [hydrated, setHydrated] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Sync from server only once (on initial load). After that, local config
  // is the single source of truth — updated only by updateConfig/setColumnWidth.
  useEffect(() => {
    if (initializedRef.current) return;
    if (savedConfig) {
      const isFirstTime =
        savedConfig.order.length === 0 && savedConfig.visible.length === 0;
      const merged = mergeWithDefaults(savedConfig, allColumns, allowedColumnIds);
      setConfig(merged);
      setHydrated(true);
      initializedRef.current = true;

      // Persist defaults for first-time users so the server has a baseline.
      if (isFirstTime) {
        void saveColumnConfig(tableKey, merged);
        void queryClient.setQueryData(queryKey, merged);
      }
    }
  }, [savedConfig, allColumns, allowedColumnIds, tableKey, queryKey, queryClient]);

  // If allColumns or allowedColumnIds change after initialization, re-merge
  // the CURRENT config (not from server) to filter out disallowed columns.
  useEffect(() => {
    if (!initializedRef.current) return;
    setConfig((current) => mergeWithDefaults(current, allColumns, allowedColumnIds));
  }, [allColumns, allowedColumnIds]);

  const persist = useCallback(
    (next: ColumnConfig) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        void saveColumnConfig(tableKey, next);
      }, 500);
    },
    [tableKey],
  );

  const updateConfig = useCallback(
    (next: ColumnConfig) => {
      setConfig(next);
      persist(next);
      void queryClient.setQueryData(queryKey, next);
    },
    [persist, queryClient, queryKey],
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

  // Compute sticky left offsets for frozen columns
  const stickyOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = SELECT_COLUMN_WIDTH;
    const byId = new Map(allColumns.map((col) => [col.id, col]));
    for (const id of frozenColumnIds) {
      offsets[id] = left;
      const col = byId.get(id);
      const w = config.widths[id] ?? col?.width ?? 120;
      left += w;
    }
    return offsets;
  }, [allColumns, config.widths, frozenColumnIds]);

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
