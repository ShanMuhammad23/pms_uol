"use client";

import { useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResizableHeaderProps {
  columnId: string;
  width?: number;
  onResize: (columnId: string, width: number) => void;
  className?: string;
  style?: CSSProperties;
  frozen?: boolean;
  stickyLeft?: number;
  children: ReactNode;
}

export function ResizableHeader({
  columnId,
  width,
  onResize,
  className,
  style,
  frozen,
  stickyLeft,
  children,
}: ResizableHeaderProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      startXRef.current = event.clientX;
      startWidthRef.current = width ?? 120;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        const newWidth = startWidthRef.current + delta;
        onResize(columnId, newWidth);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [columnId, width, onResize],
  );

  const mergedStyle: CSSProperties = {
    ...style,
    ...(width != null ? { width, minWidth: width, maxWidth: width } : {}),
    ...(frozen && stickyLeft != null ? { left: stickyLeft } : {}),
    ...(frozen ? { zIndex: 40 } : {}),
  };

  return (
    <th
      className={cn(
        "relative",
        frozen && "sticky",
        className,
      )}
      style={mergedStyle}>
      {children}
      <div
        onMouseDown={handleMouseDown}
        className="absolute right-0 top-0 z-50 flex h-full w-1.5 cursor-col-resize items-center justify-center touch-none select-none"
        aria-label={`Resize column ${columnId}`}
        role="separator"
      >
        <div className="h-full w-px bg-white/20 transition-colors hover:bg-white/60 dark:bg-white/10 dark:hover:bg-white/40" />
      </div>
    </th>
  );
}
