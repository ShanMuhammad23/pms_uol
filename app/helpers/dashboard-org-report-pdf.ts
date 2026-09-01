import type { jsPDF } from "jspdf";
import { canonicalPerformanceLevelName } from "@/app/helpers/dashboard-helpers";
import {
  orgLevelLabel,
  orgReportFileName,
  type OrgReportCompletion,
} from "@/app/helpers/dashboard-org-report";
import type { RatingQuartileMatrixData } from "@/app/helpers/dashboard-types";
import type { EntityRecord } from "@/types/entities";

type Rgb = [number, number, number];

const NAVY: Rgb = [15, 44, 89];
const SLATE: Rgb = [100, 116, 139];
const AMBER: Rgb = [217, 119, 6];
const INK: Rgb = [15, 23, 42];
const MUTED: Rgb = [71, 85, 105];
const LINE: Rgb = [226, 232, 240];
const WHITE: Rgb = [255, 255, 255];
const COMPLETED: Rgb = [5, 150, 105];
const IN_PROGRESS: Rgb = [217, 119, 6];

const LEVEL_RGB: Record<string, Rgb> = {
  Outstanding: [139, 92, 246],
  Excellent: [16, 185, 129],
  Strong: [59, 130, 246],
  "Improvement Needed": [249, 115, 22],
  Unsatisfactory: [244, 63, 94],
};

const FALLBACK_LEVEL_RGB: Rgb[] = [
  [139, 92, 246],
  [16, 185, 129],
  [59, 130, 246],
  [14, 165, 233],
  [245, 158, 11],
  [249, 115, 22],
  [244, 63, 94],
  [20, 184, 166],
];

export type OrgCalibrationReportInput = {
  entity: EntityRecord;
  generatedAt: Date;
  completion: OrgReportCompletion;
  calibrationData: Array<{ rating: string; quota: number; actual: number }>;
  ratingQuartileMatrix: RatingQuartileMatrixData;
};

function rgbForLevel(rating: string, index: number): Rgb {
  const key = canonicalPerformanceLevelName(rating);
  return LEVEL_RGB[key] ?? FALLBACK_LEVEL_RGB[index % FALLBACK_LEVEL_RGB.length];
}

function setFill(pdf: jsPDF, color: Rgb) {
  pdf.setFillColor(color[0], color[1], color[2]);
}

function setDraw(pdf: jsPDF, color: Rgb) {
  pdf.setDrawColor(color[0], color[1], color[2]);
}

function setText(pdf: jsPDF, color: Rgb) {
  pdf.setTextColor(color[0], color[1], color[2]);
}

function formatGeneratedAt(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function niceMax(value: number): number {
  if (value <= 0) return 5;
  const padded = value * 1.18;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function catmullRomToBezier(
  points: Array<{ x: number; y: number }>,
): number[][] {
  const segments: number[][] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    segments.push([
      cp1x - p1.x,
      cp1y - p1.y,
      cp2x - p1.x,
      cp2y - p1.y,
      p2.x - p1.x,
      p2.y - p1.y,
    ]);
  }
  return segments;
}

function drawPanel(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  setFill(pdf, WHITE);
  setDraw(pdf, LINE);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(x, y, width, height, 2, 2, "FD");
}

function drawHeader(pdf: jsPDF, pageWidth: number, entity: EntityRecord) {
  setFill(pdf, NAVY);
  pdf.rect(0, 0, pageWidth, 22, "F");

  setText(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("Performance Calibration Report", 12, 9);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(
    "University of Lahore  ·  Performance Management System",
    12,
    15.5,
  );

  const level = orgLevelLabel(entity.categoryCode);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(level, pageWidth - 12, 9, { align: "right" });
  pdf.setFont("helvetica", "normal");
  const orgLines = pdf.splitTextToSize(entity.name, 90).slice(0, 2);
  pdf.text(orgLines, pageWidth - 12, 14.5, { align: "right" });
}

function drawKpiCard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
) {
  setFill(pdf, [248, 250, 252]);
  setDraw(pdf, LINE);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(x, y, width, 16, 1.5, 1.5, "FD");
  setText(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(label.toUpperCase(), x + 3.5, y + 5.2);
  setText(pdf, INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(value, x + 3.5, y + 12.5);
}

function drawRatingCurve(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  data: Array<{ rating: string; quota: number; actual: number }>,
) {
  drawPanel(pdf, x, y, width, height);

  setText(pdf, INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Performance Rating Curve", x + 5, y + 7);
  setText(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("Institutional quota vs actual HR-aligned distribution", x + 5, y + 12);

  pdf.setFontSize(7.5);
  const legendY = y + 7;
  const quotaLegendX = x + width - 62;
  const actualLegendX = x + width - 32;
  setFill(pdf, SLATE);
  pdf.circle(quotaLegendX, legendY - 0.6, 1.1, "F");
  setText(pdf, MUTED);
  pdf.text("Quota", quotaLegendX + 3, legendY);
  setFill(pdf, AMBER);
  pdf.circle(actualLegendX, legendY - 0.6, 1.1, "F");
  pdf.text("Actual", actualLegendX + 3, legendY);

  const plotX = x + 14;
  const plotY = y + 18;
  const plotW = width - 20;
  const plotH = height - 36;

  if (data.length === 0) {
    setText(pdf, MUTED);
    pdf.setFontSize(9);
    pdf.text("No quota configuration available.", x + width / 2, y + height / 2, {
      align: "center",
    });
    return;
  }

  const maxValue = niceMax(
    Math.max(...data.map((row) => Math.max(row.quota, row.actual)), 0),
  );
  const tickCount = 5;
  const tickStep = maxValue / tickCount;

  setDraw(pdf, LINE);
  pdf.setLineWidth(0.15);
  setText(pdf, SLATE);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);

  for (let i = 0; i <= tickCount; i += 1) {
    const tickValue = Math.round(tickStep * i);
    const tickY = plotY + plotH - (tickValue / maxValue) * plotH;
    pdf.line(plotX, tickY, plotX + plotW, tickY);
    pdf.text(String(tickValue), plotX - 2, tickY + 1.2, { align: "right" });
  }

  const stepX = data.length === 1 ? plotW / 2 : plotW / (data.length - 1);
  const pointsFor = (key: "quota" | "actual") =>
    data.map((row, index) => ({
      x: plotX + index * stepX,
      y: plotY + plotH - (row[key] / maxValue) * plotH,
    }));

  const quotaPoints = pointsFor("quota");
  const actualPoints = pointsFor("actual");

  const drawSeries = (
    points: Array<{ x: number; y: number }>,
    color: Rgb,
    values: number[],
  ) => {
    if (points.length === 1) {
      setFill(pdf, color);
      pdf.circle(points[0].x, points[0].y, 1.4, "F");
    } else {
      setDraw(pdf, color);
      pdf.setLineWidth(0.7);
      pdf.lines(catmullRomToBezier(points), points[0].x, points[0].y, [1, 1], "S");
    }

    setFill(pdf, color);
    setText(pdf, color);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    points.forEach((point, index) => {
      pdf.circle(point.x, point.y, 1.3, "F");
      pdf.text(String(values[index] ?? 0), point.x, point.y - 3, {
        align: "center",
      });
    });
  };

  drawSeries(
    quotaPoints,
    SLATE,
    data.map((row) => row.quota),
  );
  drawSeries(
    actualPoints,
    AMBER,
    data.map((row) => row.actual),
  );

  setText(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.2);
  data.forEach((row, index) => {
    const labelX = plotX + index * stepX;
    const lines = pdf.splitTextToSize(row.rating, Math.max(stepX - 1, 18));
    pdf.text(lines, labelX, plotY + plotH + 4.5, { align: "center" });
  });
}

function drawDistributionMatrix(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  matrix: RatingQuartileMatrixData,
) {
  drawPanel(pdf, x, y, width, height);

  setText(pdf, INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Rating × Quartile Matrix", x + 5, y + 7);
  setText(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("Employee headcount by performance level and quartile", x + 5, y + 12);

  const { rows, columns } = matrix;
  if (rows.length === 0 || columns.length === 0) {
    setText(pdf, MUTED);
    pdf.setFontSize(9);
    pdf.text(
      "No performance levels or quartiles configured yet.",
      x + width / 2,
      y + height / 2,
      { align: "center" },
    );
    return;
  }

  const tableX = x + 5;
  const tableY = y + 16;
  const tableW = width - 10;
  const tableH = height - 22;
  const colCount = columns.length + 2;
  const levelColW = Math.min(38, tableW * 0.28);
  const dataColW = (tableW - levelColW) / (colCount - 1);
  const rowH = Math.min(14, tableH / (rows.length + 1));
  const headerH = rowH;

  setFill(pdf, NAVY);
  pdf.rect(tableX, tableY, tableW, headerH, "F");
  setText(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);

  const headerLabels = ["Performance Level", ...columns.map((col) => col.label), "Total"];
  headerLabels.forEach((label, index) => {
    const cellX = tableX + (index === 0 ? 0 : levelColW + (index - 1) * dataColW);
    const cellW = index === 0 ? levelColW : dataColW;
    const wrapped = pdf.splitTextToSize(label, cellW - 2);
    pdf.text(wrapped, cellX + cellW / 2, tableY + 4.2, { align: "center" });
  });

  rows.forEach((row, rowIndex) => {
    const rowY = tableY + headerH + rowIndex * rowH;
    const fill = rgbForLevel(row.rating, rowIndex);
    setFill(pdf, fill);
    pdf.rect(tableX, rowY, tableW, rowH, "F");

    setDraw(pdf, WHITE);
    pdf.setLineWidth(0.15);
    pdf.line(tableX, rowY, tableX + tableW, rowY);

    setText(pdf, WHITE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    const nameLines = pdf.splitTextToSize(row.rating, levelColW - 3);
    pdf.text(nameLines, tableX + 2, rowY + rowH / 2 + 0.8, { baseline: "middle" });

    row.quartiles.forEach((cell, colIndex) => {
      const cellX = tableX + levelColW + colIndex * dataColW;
      const countLabel =
        cell.count == null || cell.count === 0 ? "" : String(cell.count);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(countLabel, cellX + dataColW / 2, rowY + (cell.sublabel ? rowH / 2 - 1.2 : rowH / 2 + 0.8), {
        align: "center",
        baseline: "middle",
      });
      if (cell.sublabel && countLabel) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(5.5);
        const sub = pdf.splitTextToSize(cell.sublabel, dataColW - 2);
        pdf.text(sub, cellX + dataColW / 2, rowY + rowH - 2.4, { align: "center" });
      }
    });

    setFill(pdf, NAVY);
    pdf.rect(tableX + levelColW + columns.length * dataColW, rowY, dataColW, rowH, "F");
    setText(pdf, WHITE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    const totalLabel = row.rowTotal === 0 ? "" : String(row.rowTotal);
    pdf.text(
      totalLabel,
      tableX + levelColW + columns.length * dataColW + dataColW / 2,
      rowY + rowH / 2 + 0.8,
      { align: "center", baseline: "middle" },
    );
  });
}

export async function downloadOrgCalibrationReport(
  input: OrgCalibrationReportInput,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const { entity, generatedAt, completion, calibrationData, ratingQuartileMatrix } =
    input;

  pdf.setProperties({
    title: `Calibration Report — ${entity.name}`,
    subject: "Performance Rating Curve and Distribution Matrix",
    author: "University of Lahore PMS",
  });

  drawHeader(pdf, pageWidth, entity);

  const metaY = 26;
  setText(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(`Generated: ${formatGeneratedAt(generatedAt)}`, 12, metaY);

  const isComplete = completion.status === "Completed";
  const statusColor = isComplete ? COMPLETED : IN_PROGRESS;
  const statusLabel = isComplete ? "Completed" : "In-progress";
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  const chipW = pdf.getTextWidth(statusLabel) + 8;
  const chipX = pageWidth - 12 - chipW;
  const chipY = metaY - 4.4;
  setFill(pdf, statusColor);
  pdf.roundedRect(chipX, chipY, chipW, 6.5, 1.2, 1.2, "F");
  setText(pdf, WHITE);
  pdf.text(statusLabel, chipX + chipW / 2, chipY + 4.4, { align: "center" });
  setText(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("HR Alignment", chipX - 2.5, metaY, { align: "right" });

  const kpiY = 31;
  const kpiGap = 3;
  const kpiW = (pageWidth - 24 - kpiGap * 3) / 4;
  drawKpiCard(pdf, 12, kpiY, kpiW, "Staff in listing", String(completion.totalStaff));
  drawKpiCard(
    pdf,
    12 + kpiW + kpiGap,
    kpiY,
    kpiW,
    "Eligible employees",
    String(completion.eligibleCount),
  );
  drawKpiCard(
    pdf,
    12 + (kpiW + kpiGap) * 2,
    kpiY,
    kpiW,
    "HR aligned",
    `${completion.alignedCount} of ${completion.eligibleCount}`,
  );
  drawKpiCard(
    pdf,
    12 + (kpiW + kpiGap) * 3,
    kpiY,
    kpiW,
    "Pending alignment",
    String(completion.pendingCount),
  );

  const chartsY = 51;
  const chartsH = pageHeight - chartsY - 12;
  const gap = 6;
  const chartW = (pageWidth - 24 - gap) / 2;
  drawRatingCurve(pdf, 12, chartsY, chartW, chartsH, calibrationData);
  drawDistributionMatrix(
    pdf,
    12 + chartW + gap,
    chartsY,
    chartW,
    chartsH,
    ratingQuartileMatrix,
  );

  setText(pdf, SLATE);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text(
    "Status is Completed when every eligible employee in this organization has reached HR Alignment (Board Approval or later). Ineligible / N/A staff are excluded.",
    12,
    pageHeight - 4.5,
  );

  pdf.save(orgReportFileName(entity.name, generatedAt));
}
