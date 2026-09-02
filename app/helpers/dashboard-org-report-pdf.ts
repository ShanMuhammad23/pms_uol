import type { jsPDF } from "jspdf";
import { canonicalPerformanceLevelName } from "@/app/helpers/dashboard-helpers";
import {
  orgReportFileName,
  type OrgReportCompletion,
  type OrgReportStaffRow,
  type OrgReportStatus,
} from "@/app/helpers/dashboard-org-report";
import type { RatingQuartileMatrixData } from "@/app/helpers/dashboard-types";

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
  orgTitle: string;
  filterSummary: string;
  generatedAt: Date;
  includeSalary: boolean;
  completion: OrgReportCompletion;
  calibrationData: Array<{ rating: string; quota: number; actual: number }>;
  ratingQuartileMatrix: RatingQuartileMatrixData;
  staffRows: OrgReportStaffRow[];
};

export type BuiltOrgCalibrationReport = {
  blob: Blob;
  fileName: string;
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

function drawPmsWatermark(pdf: jsPDF, pageWidth: number, pageHeight: number) {
  pdf.saveGraphicsState();
  pdf.setGState(pdf.GState({ opacity: 0.03 }));
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(120);
  setText(pdf, NAVY);
  pdf.text("PMS", pageWidth / 2, pageHeight / 2 + 12, {
    align: "center",
    angle: 32,
  });
  pdf.restoreGraphicsState();
}

function stampPmsWatermarkOnAllPages(pdf: jsPDF) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    drawPmsWatermark(pdf, pageWidth, pageHeight);
  }
}

function formatPrintDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatSalary(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
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

function drawStatusChip(
  pdf: jsPDF,
  pageWidth: number,
  y: number,
  status: OrgReportStatus,
) {
  const isComplete = status === "Completed";
  const statusColor = isComplete ? COMPLETED : IN_PROGRESS;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  const chipW = pdf.getTextWidth(status) + 8;
  const chipX = pageWidth - 12 - chipW;
  const chipY = y - 4.4;
  setFill(pdf, statusColor);
  pdf.roundedRect(chipX, chipY, chipW, 6.5, 1.2, 1.2, "F");
  setText(pdf, WHITE);
  pdf.text(status, chipX + chipW / 2, chipY + 4.4, { align: "center" });
  return chipX;
}

/** Cover header. Returns the Y position below the title block. */
function drawCoverHeader(
  pdf: jsPDF,
  pageWidth: number,
  orgTitle: string,
  filterSummary: string,
  generatedAt: Date,
  status: OrgReportStatus,
): number {
  setFill(pdf, NAVY);
  pdf.rect(0, 0, pageWidth, 14, "F");

  setText(pdf, WHITE);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(
    "University of Lahore  ·  Performance Management System",
    12,
    8.5,
  );

  let y = 22;
  setText(pdf, MUTED);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("PERFORMANCE REPORT", 12, y);

  y += 8;
  setText(pdf, NAVY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  const orgLines = pdf.splitTextToSize(orgTitle, pageWidth - 24);
  pdf.text(orgLines, 12, y);
  y += orgLines.length * 7.2;

  if (filterSummary) {
    y += 2;
    setText(pdf, MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    const summaryLines = pdf.splitTextToSize(filterSummary, pageWidth - 24);
    pdf.text(summaryLines, 12, y);
    y += summaryLines.length * 3.6 + 2;
  }

  y += 6;
  setText(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(`Print date  ${formatPrintDate(generatedAt)}`, 12, y);

  const chipX = drawStatusChip(pdf, pageWidth, y, status);
  setText(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Performance Status", chipX - 2.5, y, { align: "right" });

  return y + 6;
}

function drawListingPageHeader(
  pdf: jsPDF,
  pageWidth: number,
  orgTitle: string,
  generatedAt: Date,
  status: OrgReportStatus,
) {
  setFill(pdf, NAVY);
  pdf.rect(0, 0, pageWidth, 14, "F");
  setText(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Performance Report  ·  Staff Listing", 12, 6.5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  const orgLine = pdf.splitTextToSize(orgTitle, pageWidth - 90)[0];
  pdf.text(orgLine, 12, 11.2);
  pdf.text(formatPrintDate(generatedAt), pageWidth - 12, 6.5, { align: "right" });
  pdf.text(status, pageWidth - 12, 11.2, { align: "right" });
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

/** Draw wrapped text as a vertically and horizontally centered block inside a cell. */
function drawCenteredCellText(
  pdf: jsPDF,
  text: string,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  fontSize: number,
  maxLines = 3,
) {
  const padding = 1.8;
  const trimmed = text.trim();
  if (!trimmed) return;

  pdf.setFontSize(fontSize);
  const lines = (pdf.splitTextToSize(trimmed, Math.max(4, cellW - padding * 2)) as string[])
    .slice(0, maxLines);
  if (lines.length === 0) return;

  const lineH = fontSize * 0.42;
  const blockH = lines.length * lineH;
  let cursorY = cellY + (cellH - blockH) / 2 + lineH * 0.72;
  const centerX = cellX + cellW / 2;

  lines.forEach((line) => {
    pdf.text(line, centerX, cursorY, { align: "center" });
    cursorY += lineH;
  });
}

function drawStackedCellLines(
  pdf: jsPDF,
  lines: Array<{ text: string; fontSize: number; style: "bold" | "normal" }>,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
) {
  const prepared: Array<{ text: string; fontSize: number; style: "bold" | "normal"; lineH: number }> = [];
  const padding = 1.6;

  lines.forEach((line) => {
    pdf.setFont("helvetica", line.style);
    pdf.setFontSize(line.fontSize);
    const wrapped = (
      pdf.splitTextToSize(line.text, Math.max(4, cellW - padding * 2)) as string[]
    ).slice(0, 2);
    wrapped.forEach((text) => {
      if (!text.trim()) return;
      prepared.push({
        text,
        fontSize: line.fontSize,
        style: line.style,
        lineH: line.fontSize * 0.42,
      });
    });
  });

  if (prepared.length === 0) return;

  const blockH = prepared.reduce((sum, line) => sum + line.lineH, 0);
  let cursorY = cellY + (cellH - blockH) / 2;
  const centerX = cellX + cellW / 2;

  prepared.forEach((line) => {
    pdf.setFont("helvetica", line.style);
    pdf.setFontSize(line.fontSize);
    pdf.text(line.text, centerX, cursorY + line.lineH * 0.72, { align: "center" });
    cursorY += line.lineH;
  });
}

function drawTableGrid(
  pdf: jsPDF,
  tableX: number,
  tableY: number,
  colWidths: number[],
  rowHeights: number[],
  lineColor: Rgb,
  lineWidth: number,
) {
  const tableW = colWidths.reduce((sum, width) => sum + width, 0);
  const tableH = rowHeights.reduce((sum, height) => sum + height, 0);

  setDraw(pdf, lineColor);
  pdf.setLineWidth(lineWidth);
  pdf.rect(tableX, tableY, tableW, tableH);

  let lineX = tableX;
  for (let index = 0; index < colWidths.length - 1; index += 1) {
    lineX += colWidths[index];
    pdf.line(lineX, tableY, lineX, tableY + tableH);
  }

  let lineY = tableY;
  for (let index = 0; index < rowHeights.length - 1; index += 1) {
    lineY += rowHeights[index];
    pdf.line(tableX, lineY, tableX + tableW, lineY);
  }
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
  const tableY = y + 17;
  const tableW = width - 10;
  const tableH = height - 24;
  const dataColCount = columns.length + 1;
  const levelColW = Math.min(46, Math.max(32, tableW * 0.3));
  const dataColW = (tableW - levelColW) / dataColCount;
  const colWidths = [
    levelColW,
    ...columns.map(() => dataColW),
    dataColW,
  ];
  const headerH = Math.max(9, Math.min(12, tableH * 0.14));
  const rowH = (tableH - headerH) / rows.length;
  const rowHeights = [headerH, ...rows.map(() => rowH)];
  const usedTableH = headerH + rows.length * rowH;

  const headerLabels = [
    "Performance Level",
    ...columns.map((col) => col.label),
    "Total",
  ];

  setFill(pdf, NAVY);
  pdf.rect(tableX, tableY, tableW, headerH, "F");
  setText(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  let headerX = tableX;
  headerLabels.forEach((label, index) => {
    drawCenteredCellText(
      pdf,
      label,
      headerX,
      tableY,
      colWidths[index],
      headerH,
      index === 0 ? 7 : 6.5,
      2,
    );
    headerX += colWidths[index];
  });

  rows.forEach((row, rowIndex) => {
    const rowY = tableY + headerH + rowIndex * rowH;
    const fill = rgbForLevel(row.rating, rowIndex);
    let cellX = tableX;

    setFill(pdf, fill);
    pdf.rect(cellX, rowY, levelColW, rowH, "F");
    setText(pdf, WHITE);
    pdf.setFont("helvetica", "bold");
    drawCenteredCellText(pdf, row.rating, cellX, rowY, levelColW, rowH, 7.5, 3);
    cellX += levelColW;

    row.quartiles.forEach((cell) => {
      setFill(pdf, fill);
      pdf.rect(cellX, rowY, dataColW, rowH, "F");
      setText(pdf, WHITE);
      const countLabel =
        cell.count == null || cell.count === 0 ? "" : String(cell.count);
      const sublabel = cell.sublabel?.trim() ?? "";
      if (countLabel && sublabel) {
        drawStackedCellLines(
          pdf,
          [
            { text: countLabel, fontSize: 10, style: "bold" },
            { text: sublabel, fontSize: 5.5, style: "normal" },
          ],
          cellX,
          rowY,
          dataColW,
          rowH,
        );
      } else if (countLabel) {
        pdf.setFont("helvetica", "bold");
        drawCenteredCellText(pdf, countLabel, cellX, rowY, dataColW, rowH, 10, 1);
      }
      cellX += dataColW;
    });

    setFill(pdf, NAVY);
    pdf.rect(cellX, rowY, dataColW, rowH, "F");
    setText(pdf, WHITE);
    pdf.setFont("helvetica", "bold");
    const totalLabel = row.rowTotal === 0 ? "" : String(row.rowTotal);
    if (totalLabel) {
      drawCenteredCellText(pdf, totalLabel, cellX, rowY, dataColW, rowH, 10, 1);
    }
  });

  drawTableGrid(pdf, tableX, tableY, colWidths, rowHeights, WHITE, 0.35);
  setDraw(pdf, NAVY);
  pdf.setLineWidth(0.45);
  pdf.rect(tableX, tableY, tableW, usedTableH);
}

type StaffColumn = {
  key: keyof OrgReportStaffRow | "revisedSalaryLabel";
  label: string;
  width: number;
  align: "left" | "center" | "right";
};

function staffColumns(includeSalary: boolean): StaffColumn[] {
  if (includeSalary) {
    return [
      { key: "sapCode", label: "SAP Code", width: 28, align: "left" },
      { key: "name", label: "Name", width: 52, align: "left" },
      { key: "designation", label: "Designation", width: 50, align: "left" },
      { key: "rating", label: "Rating", width: 36, align: "center" },
      { key: "quartile", label: "Quartile", width: 32, align: "center" },
      { key: "revisedSalaryLabel", label: "Revised Salary", width: 36, align: "right" },
      { key: "status", label: "Status", width: 32, align: "center" },
    ];
  }

  return [
    { key: "sapCode", label: "SAP Code", width: 32, align: "left" },
    { key: "name", label: "Name", width: 62, align: "left" },
    { key: "designation", label: "Designation", width: 58, align: "left" },
    { key: "rating", label: "Rating", width: 42, align: "center" },
    { key: "quartile", label: "Quartile", width: 38, align: "center" },
    { key: "status", label: "Status", width: 36, align: "center" },
  ];
}

function cellValue(row: OrgReportStaffRow, column: StaffColumn): string {
  if (column.key === "revisedSalaryLabel") {
    return formatSalary(row.revisedSalary);
  }
  return String(row[column.key] ?? "—");
}

function drawStaffTableHeader(
  pdf: jsPDF,
  columns: StaffColumn[],
  tableX: number,
  tableY: number,
  tableW: number,
  headerH: number,
) {
  setFill(pdf, NAVY);
  pdf.rect(tableX, tableY, tableW, headerH, "F");
  setText(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);

  let x = tableX;
  columns.forEach((column) => {
    const textX =
      column.align === "center"
        ? x + column.width / 2
        : column.align === "right"
          ? x + column.width - 2
          : x + 2;
    pdf.text(column.label, textX, tableY + headerH / 2 + 1, {
      align: column.align,
      baseline: "middle",
    });
    x += column.width;
  });
}

function drawStaffListingPages(
  pdf: jsPDF,
  input: OrgCalibrationReportInput,
  pageWidth: number,
  pageHeight: number,
) {
  const columns = staffColumns(input.includeSalary);
  const tableW = columns.reduce((sum, column) => sum + column.width, 0);
  const tableX = (pageWidth - tableW) / 2;
  const headerH = 8;
  const rowH = 7;
  const topY = 18;
  const bottomY = pageHeight - 8;
  const rowsPerPage = Math.max(1, Math.floor((bottomY - topY - headerH) / rowH));
  const rows = input.staffRows;
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    pdf.addPage();
    drawListingPageHeader(
      pdf,
      pageWidth,
      input.orgTitle,
      input.generatedAt,
      input.completion.status,
    );

    const tableY = topY;
    drawStaffTableHeader(pdf, columns, tableX, tableY, tableW, headerH);

    const pageRows = rows.slice(
      pageIndex * rowsPerPage,
      (pageIndex + 1) * rowsPerPage,
    );

    if (pageRows.length === 0) {
      setText(pdf, MUTED);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(
        "No staff match the selected filters.",
        pageWidth / 2,
        tableY + headerH + 16,
        { align: "center" },
      );
    }

    pageRows.forEach((row, rowIndex) => {
      const rowY = tableY + headerH + rowIndex * rowH;
      if (rowIndex % 2 === 0) {
        setFill(pdf, [248, 250, 252]);
        pdf.rect(tableX, rowY, tableW, rowH, "F");
      }

      setDraw(pdf, LINE);
      pdf.setLineWidth(0.15);
      pdf.line(tableX, rowY + rowH, tableX + tableW, rowY + rowH);

      let x = tableX;
      columns.forEach((column) => {
        const raw = cellValue(row, column);
        const wrapped = pdf.splitTextToSize(raw, column.width - 3);
        const display = Array.isArray(wrapped) ? wrapped[0] : wrapped;
        const isStatus = column.key === "status";
        if (isStatus) {
          setText(pdf, row.status === "Completed" ? COMPLETED : IN_PROGRESS);
          pdf.setFont("helvetica", "bold");
        } else {
          setText(pdf, INK);
          pdf.setFont("helvetica", "normal");
        }
        pdf.setFontSize(7);
        const textX =
          column.align === "center"
            ? x + column.width / 2
            : column.align === "right"
              ? x + column.width - 2
              : x + 2;
        pdf.text(display, textX, rowY + rowH / 2 + 0.6, {
          align: column.align,
          baseline: "middle",
        });
        x += column.width;
      });
    });

    setDraw(pdf, LINE);
    pdf.setLineWidth(0.25);
    pdf.rect(tableX, tableY, tableW, headerH + pageRows.length * rowH);

    const listingPage = pageIndex + 2;
    const totalPages = pageCount + 1;
    setText(pdf, SLATE);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.text(
      `Page ${listingPage} of ${totalPages}  ·  ${rows.length.toLocaleString("en-US")} staff`,
      pageWidth / 2,
      pageHeight - 4,
      { align: "center" },
    );
  }
}

export async function buildOrgCalibrationReport(
  input: OrgCalibrationReportInput,
): Promise<BuiltOrgCalibrationReport> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const {
    orgTitle,
    filterSummary,
    generatedAt,
    completion,
    calibrationData,
    ratingQuartileMatrix,
  } = input;

  pdf.setProperties({
    title: `Performance Report — ${orgTitle}`,
    subject: "Performance Report with rating curve, distribution matrix, and staff listing",
    author: "University of Lahore PMS",
  });

  const afterHeaderY = drawCoverHeader(
    pdf,
    pageWidth,
    orgTitle,
    filterSummary,
    generatedAt,
    completion.status,
  );

  const kpiY = afterHeaderY;
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

  const chartsY = kpiY + 20;
  const chartsH = pageHeight - chartsY - 10;
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
    "Performance Status is Completed when every eligible employee has reached HR Alignment (Board Approval or later). Ineligible / N/A staff are excluded from that status.",
    12,
    pageHeight - 4.5,
  );
  pdf.text("Page 1", pageWidth - 12, pageHeight - 4.5, { align: "right" });

  drawStaffListingPages(pdf, input, pageWidth, pageHeight);
  stampPmsWatermarkOnAllPages(pdf);

  const fileName = orgReportFileName(orgTitle, generatedAt);
  const blob = pdf.output("blob");
  return { blob, fileName };
}

export async function downloadOrgCalibrationReport(
  input: OrgCalibrationReportInput,
): Promise<void> {
  const { blob, fileName } = await buildOrgCalibrationReport(input);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadReportBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
