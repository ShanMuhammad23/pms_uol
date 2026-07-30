"use client";

import { useEffect } from "react";
import type { PrintOrientation } from "@/app/components/print/PrintLayout";

interface PrintTriggerProps {
  orientation?: PrintOrientation;
}

export default function PrintTrigger({ orientation = "portrait" }: PrintTriggerProps) {
  useEffect(() => {
    const html = document.documentElement;
    if (orientation === "landscape") {
      html.classList.add("print-landscape");
    } else {
      html.classList.remove("print-landscape");
    }

    const timeout = setTimeout(() => {
      window.print();
    }, 600);

    return () => {
      clearTimeout(timeout);
      html.classList.remove("print-landscape");
    };
  }, [orientation]);

  return null;
}
