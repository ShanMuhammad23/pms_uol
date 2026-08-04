"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Props for {@link TopHorizontalScrollbar}.
 */
export interface TopHorizontalScrollbarProps {
  /**
   * Ref to the scrollable container whose horizontal scroll this component
   * mirrors. Typically the `overflow-auto` wrapper around a wide table.
   */
  targetRef: React.RefObject<HTMLDivElement | null>;
  /** Optional class name applied to the outer wrapper. */
  className?: string;
}

/**
 * Reusable top-mounted horizontal scrollbar that stays synchronized with a
 * target scroll container.
 *
 * - Renders a thin scrollable track above the target element.
 * - An invisible spacer inside the track matches the target's scrollWidth so
 *   the native scrollbar has the same range.
 * - Scroll position is mirrored bidirectionally (top → target and
 *   target → top) without feedback loops.
 * - The track is only visible when the target content overflows horizontally.
 * - Re-measures on resize, content changes (MutationObserver), and container
 *   size changes (ResizeObserver) so it stays accurate after column
 *   show/hide, resize, or data updates.
 */
export function TopHorizontalScrollbar({
  targetRef,
  className,
}: TopHorizontalScrollbarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  // Guard against feedback loops when programmatically setting scrollLeft.
  const syncingRef = useRef(false);

  const measure = useCallback(() => {
    const target = targetRef.current;
    if (!target) return;

    // Decide visibility from the target alone — the spacer/track refs are
    // only attached once `visible` flips true, so they cannot be relied on
    // here. Computing this first breaks the deadlock where `visible` stays
    // false because the spacer never mounts.
    const overflow = target.scrollWidth - target.clientWidth;
    const shouldShow = overflow > 2;
    setVisible(shouldShow);

    if (!shouldShow) return;

    // The spacer/track may not be mounted yet on the render that flips
    // `visible` to true; a subsequent measure (triggered by the observers
    // or the next paint) will populate them.
    const spacer = spacerRef.current;
    const track = trackRef.current;
    if (spacer) {
      // Match the spacer width to the full scrollable content width so the
      // track's scrollbar covers the same range as the target's.
      spacer.style.width = `${target.scrollWidth}px`;
    }
    if (track && track.scrollLeft !== target.scrollLeft) {
      // Keep the track scroll position in sync after re-measure.
      syncingRef.current = true;
      track.scrollLeft = target.scrollLeft;
      syncingRef.current = false;
    }
  }, [targetRef]);

  // Initial measure + observers for content/size changes.
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    measure();

    const resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(target);
    // Observe the table (or other wide child) so column add/remove/resize
    // triggers a re-measure.
    const mutationObserver = new MutationObserver(() => measure());
    mutationObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    // Re-measure on window resize (covers flex/grid layout shifts).
    const handleWindowResize = () => measure();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [measure, targetRef]);

  // Re-measure once the track/spacer mount after `visible` flips true.
  // The observers above watch the target, so they won't fire when the track
  // itself appears — this effect bridges that gap and also keeps the spacer
  // width / scroll position in sync whenever visibility changes.
  useEffect(() => {
    if (!visible) return;
    measure();
  }, [visible, measure]);

  // Bidirectional scroll synchronization.
  //
  // `visible` MUST be in the dependency array: the track div only mounts once
  // `visible` flips to true, so `trackRef.current` is null during the first
  // run. Without `visible` as a dep, this effect would bail at the guard and
  // never re-run — leaving the track with no scroll listeners (the scrollbar
  // would be visible but dragging it wouldn't move the table).
  useEffect(() => {
    if (!visible) return;

    const target = targetRef.current;
    const track = trackRef.current;
    if (!target || !track) return;

    const handleTargetScroll = () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      track.scrollLeft = target.scrollLeft;
      syncingRef.current = false;
    };

    const handleTrackScroll = () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      target.scrollLeft = track.scrollLeft;
      syncingRef.current = false;
    };

    target.addEventListener("scroll", handleTargetScroll);
    track.addEventListener("scroll", handleTrackScroll);

    // Sync the track's initial scroll position to the target's now that the
    // track is mounted and listeners are about to be attached.
    syncingRef.current = true;
    track.scrollLeft = target.scrollLeft;
    syncingRef.current = false;

    return () => {
      target.removeEventListener("scroll", handleTargetScroll);
      track.removeEventListener("scroll", handleTrackScroll);
    };
  }, [targetRef, visible]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "w-full overflow-x-auto overflow-y-hidden",
        // Thin native scrollbar styling; browsers that support it collapse
        // the track to a slim bar that sits flush above the table header.
        "[scrollbar-color:rgb(148_163_184)_transparent] dark:[scrollbar-color:rgb(100_116_139)_transparent]",
        className,
      )}
      ref={trackRef}
      aria-hidden="true"
      role="presentation"
    >
      {/* Invisible spacer that establishes the scrollable width. */}
      <div ref={spacerRef} className="h-px w-max" />
    </div>
  );
}
