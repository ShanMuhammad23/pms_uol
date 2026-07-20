"use client";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import { toCanvas } from "html-to-image";

interface PdfDownloadTriggerProps {
  templateTitle: string;
}

export default function PdfDownloadTrigger({
  templateTitle,
}: PdfDownloadTriggerProps) {
  const [status, setStatus] = useState<"generating" | "done" | "error">(
    "generating",
  );

  useEffect(() => {
    let cancelled = false;

    const generatePdf = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 800));

        const element = document.getElementById("pdf-content");
        if (!element || cancelled) return;

        const canvas = await toCanvas(element, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          cacheBust: true,
        });

        const JPEG_QUALITY = 0.92;

        if (cancelled) return;

        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        const pdf = new jsPDF({
          orientation: imgWidth > imgHeight ? "landscape" : "portrait",
          unit: "pt",
          format: "a4",
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 28;
        const usableWidth = pageWidth - margin * 2;

        const scale = usableWidth / imgWidth;
        const scaledHeight = imgHeight * scale;
        const usableHeight = pageHeight - margin * 2;

        if (scaledHeight <= usableHeight) {
          const imgData = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
          pdf.addImage(
            imgData,
            "JPEG",
            margin,
            margin,
            usableWidth,
            scaledHeight,
          );
        } else {
          let remainingHeight = scaledHeight;
          let srcY = 0;

          while (remainingHeight > 0 && !cancelled) {
            const sliceHeight = Math.min(usableHeight, remainingHeight);
            const srcSliceHeight = sliceHeight / scale;

            const sliceCanvas = document.createElement("canvas");
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = Math.ceil(srcSliceHeight);
            const ctx = sliceCanvas.getContext("2d");
            if (!ctx) break;

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(
              canvas,
              0,
              srcY,
              canvas.width,
              srcSliceHeight,
              0,
              0,
              canvas.width,
              srcSliceHeight,
            );

            const imgData = sliceCanvas.toDataURL("image/jpeg", JPEG_QUALITY);
            if (srcY > 0) pdf.addPage();
            pdf.addImage(imgData, "JPEG", margin, margin, usableWidth, sliceHeight);

            remainingHeight -= sliceHeight;
            srcY += srcSliceHeight;
          }
        }

        if (cancelled) return;

        const safeTitle = templateTitle.replace(/[^\w\s-]/g, "").trim() || "form";
        pdf.save(`${safeTitle}.pdf`);
        setStatus("done");

        setTimeout(() => {
          if (!cancelled) window.close();
        }, 1000);
      } catch (error) {
        console.error("PDF generation failed:", error);
        if (!cancelled) setStatus("error");
      }
    };

    generatePdf();

    return () => {
      cancelled = true;
    };
  }, [templateTitle]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      {status === "generating" ? (
        <div className="text-center">
          <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
          <p className="text-sm text-slate-600">Generating PDF...</p>
        </div>
      ) : status === "done" ? (
        <div className="text-center">
          <p className="text-sm font-medium text-emerald-600">
            PDF downloaded. You can close this tab.
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-medium text-red-600">
            Failed to generate PDF. Please try the Print option instead.
          </p>
        </div>
      )}
    </div>
  );
}
