"use client";

import { useState, useCallback } from "react";
import { Printer, FileText, FileSpreadsheet } from "lucide-react";
import type { PrintOrientation } from "@/app/components/print/PrintLayout";

interface PrintDialogProps {
  open: boolean;
  onClose: () => void;
  onPrint: (orientation: PrintOrientation) => void;
  recommendedOrientation?: PrintOrientation;
  documentTitle?: string;
}

export default function PrintDialog({
  open,
  onClose,
  onPrint,
  recommendedOrientation = "portrait",
  documentTitle,
}: PrintDialogProps) {
  const [selected, setSelected] = useState<PrintOrientation>(recommendedOrientation);

  const handlePrint = useCallback(() => {
    onPrint(selected);
  }, [onPrint, selected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Printer className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Print Document
            </h2>
            {documentTitle ? (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {documentTitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            Select page orientation
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelected("portrait")}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                selected === "portrait"
                  ? "border-primary bg-primary/5"
                  : "border-slate-200 hover:border-slate-300 dark:border-white/15 dark:hover:border-white/25"
              }`}
            >
              <FileText
                className={`size-8 ${
                  selected === "portrait"
                    ? "text-primary"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Portrait
                </p>
                {recommendedOrientation === "portrait" ? (
                  <p className="mt-0.5 text-[10px] font-medium text-primary">
                    Recommended
                  </p>
                ) : null}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSelected("landscape")}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                selected === "landscape"
                  ? "border-primary bg-primary/5"
                  : "border-slate-200 hover:border-slate-300 dark:border-white/15 dark:hover:border-white/25"
              }`}
            >
              <FileSpreadsheet
                className={`size-8 ${
                  selected === "landscape"
                    ? "text-primary"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Landscape
                </p>
                {recommendedOrientation === "landscape" ? (
                  <p className="mt-0.5 text-[10px] font-medium text-primary">
                    Recommended
                  </p>
                ) : null}
              </div>
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          A4 paper size · Standard margins · 100% scale
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Printer className="size-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
