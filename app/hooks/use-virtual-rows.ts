"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type RefObject } from "react";

interface UseVirtualRowsOptions {
  /** Total number of rows in the dataset. */
  count: number;
  /** Estimated row height in pixels. Must match the actual rendered row height. */
  estimateSize: number;
  /** Number of rows to render above/below the visible viewport as a buffer. */
  overscan?: number;
  /** Whether virtualization is active. When false, all rows are rendered. */
  enabled: boolean;
  /** Optional scroll container ref. When omitted, the hook owns the ref. */
  scrollRef?: RefObject<HTMLDivElement | null>;
}

interface UseVirtualRowsResult {
  /** Ref to attach to the scroll container element. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Total height of the virtualized content in pixels. */
  totalSize: number;
  /** Virtual items to render — each has `index`, `start`, and `size`. */
  virtualItems: ReadonlyArray<{
    index: number;
    start: number;
    size: number;
  }>;
  /** Whether virtualization is currently active. */
  enabled: boolean;
}

/**
 * Row virtualization hook for large tables. When `enabled` is true, only
 * the rows visible in the scroll viewport (plus an overscan buffer) are
 * rendered. When false, all rows are rendered normally (paginated mode).
 *
 * The hook returns a `scrollRef` that must be attached to the scrollable
 * container element (the div with `overflow-auto`), and `virtualItems`
 * describing which rows to render and their vertical positions.
 */
export function useVirtualRows({
  count,
  estimateSize,
  overscan = 8,
  enabled,
  scrollRef: scrollRefProp,
}: UseVirtualRowsOptions): UseVirtualRowsResult {
  const internalScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = scrollRefProp ?? internalScrollRef;

  // TanStack Virtual intentionally returns unstable function identities.
  // eslint-disable-next-line react-hooks/incompatible-library -- third-party virtualizer API
  const rowVirtualizer = useVirtualizer({
    count: enabled ? count : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    enabled,
  });

  if (!enabled) {
    return {
      scrollRef,
      totalSize: 0,
      virtualItems: [],
      enabled: false,
    };
  }

  return {
    scrollRef,
    totalSize: rowVirtualizer.getTotalSize(),
    virtualItems: rowVirtualizer.getVirtualItems().map((item) => ({
      index: item.index,
      start: item.start,
      size: item.size,
    })),
    enabled: true,
  };
}
