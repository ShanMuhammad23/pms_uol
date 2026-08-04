"use client";

import { Printer } from "lucide-react";

interface PrintButtonProps {
  className?: string;
  label?: string;
  printUrl?: string;
}

export default function PrintButton({
  className,
  label = "Print / Save as PDF",
  printUrl,
}: PrintButtonProps) {
  const handlePrint = () => {
    if (printUrl) {
      window.open(printUrl, "_blank");
    } else {
      window.print();
    }
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
      }
    >
      <Printer className="size-3.5" />
      {label}
    </button>
  );
}
