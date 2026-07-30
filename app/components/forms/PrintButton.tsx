"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import PrintDialog from "@/app/components/print/PrintDialog";
import type { PrintOrientation } from "@/app/components/print/PrintLayout";

interface PrintButtonProps {
  className?: string;
  label?: string;
  printUrl?: string;
  recommendedOrientation?: PrintOrientation;
  documentTitle?: string;
  showOrientationDialog?: boolean;
}

export default function PrintButton({
  className,
  label = "Print / Save as PDF",
  printUrl,
  recommendedOrientation = "portrait",
  documentTitle,
  showOrientationDialog = false,
}: PrintButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handlePrint = (orientation: PrintOrientation) => {
    setDialogOpen(false);
    if (printUrl) {
      const sep = printUrl.includes("?") ? "&" : "?";
      window.open(`${printUrl}${sep}orientation=${orientation}`, "_blank");
    } else {
      const html = document.documentElement;
      if (orientation === "landscape") {
        html.classList.add("print-landscape");
      } else {
        html.classList.remove("print-landscape");
      }
      setTimeout(() => {
        window.print();
        html.classList.remove("print-landscape");
      }, 100);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (showOrientationDialog) {
            setDialogOpen(true);
          } else {
            handlePrint(recommendedOrientation);
          }
        }}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
        }
      >
        <Printer className="size-3.5" />
        {label}
      </button>
      <PrintDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onPrint={handlePrint}
        recommendedOrientation={recommendedOrientation}
        documentTitle={documentTitle}
      />
    </>
  );
}
