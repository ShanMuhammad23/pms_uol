"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchColumnWidths,
  saveColumnWidths,
  type ColumnWidths,
} from "@/lib/queries/column-widths-client";

export const MIN_COLUMN_WIDTH = 80;
export const MAX_COLUMN_WIDTH = 600;

export function useColumnWidths(tableKey: string) {
  const { data: savedWidths = {} } = useQuery<ColumnWidths>({
    queryKey: ["column-widths", tableKey],
    queryFn: () => fetchColumnWidths(tableKey),
    staleTime: Infinity,
  });

  const [widths, setWidths] = useState<ColumnWidths>({});
  const [hydrated, setHydrated] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setWidths(savedWidths);
    setHydrated(true);
  }, [savedWidths]);

  const persist = useCallback(
    (next: ColumnWidths) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        void saveColumnWidths(tableKey, next);
      }, 500);
    },
    [tableKey],
  );

  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      const clamped = Math.max(
        MIN_COLUMN_WIDTH,
        Math.min(MAX_COLUMN_WIDTH, Math.round(width)),
      );
      setWidths((current) => {
        const next = { ...current, [columnId]: clamped };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const getColumnWidth = useCallback(
    (columnId: string, defaultWidth?: number): number | undefined => {
      if (widths[columnId] != null) return widths[columnId];
      return defaultWidth;
    },
    [widths],
  );

  return {
    widths,
    getColumnWidth,
    setColumnWidth,
    hydrated,
  };
}
