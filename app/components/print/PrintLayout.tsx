"use client";

import { useEffect, type ReactNode } from "react";

export type PrintOrientation = "portrait" | "landscape";

interface PrintLayoutProps {
  orientation?: PrintOrientation;
  children: ReactNode;
}

export default function PrintLayout({
  orientation = "portrait",
  children,
}: PrintLayoutProps) {
  useEffect(() => {
    const html = document.documentElement;
    if (orientation === "landscape") {
      html.classList.add("print-landscape");
    } else {
      html.classList.remove("print-landscape");
    }
    return () => {
      html.classList.remove("print-landscape");
    };
  }, [orientation]);

  return (
    <div className="print-content print-full-width">{children}</div>
  );
}
