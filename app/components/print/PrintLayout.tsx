"use client";

import type { ReactNode } from "react";

export type PrintOrientation = "portrait" | "landscape";

interface PrintLayoutProps {
  children: ReactNode;
}

export default function PrintLayout({ children }: PrintLayoutProps) {
  return (
    <div className="print-content print-full-width">{children}</div>
  );
}
