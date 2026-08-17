import {
  buildRootLayoutOrderFromRecord,
  buildSectionLayoutOrderFromRecord,
  type FormSectionRecord,
  type FormSubsectionRecord,
  type QuestionRecord,
} from "@/types/forms";

export interface FormTableRow {
  sr: number;
  sectionTitle: string | null;
  sectionNumber: number | null;
  subsectionTitle: string | null;
  subsectionNumber: string | null;
  question: QuestionRecord | null;
  isFirstInSection: boolean;
  isFirstInSubsection: boolean;
  sectionRowCount: number;
  isHeaderOnly: boolean;
  /** Sum of totalMarks for all questions in this section (0 for root questions). */
  sectionTotalMarks: number;
  /** Sum of totalMarks for all questions in this subsection (0 if no subsection). */
  subsectionTotalMarks: number;
}

/**
 * Builds a flat list of table rows from form sections and root-level questions,
 * preserving display order and tracking section and subsection boundaries.
 *
 * Each row that begins a new section gets `isFirstInSection: true` and a
 * 1-based `sectionNumber` (sequential, no gaps from hidden/removed sections).
 * Subsection rows get `isFirstInSubsection: true` and a dotted number such
 * as "1.1" to support subsection-level numbering in the UI.
 *
 * `sectionTotalMarks` and `subsectionTotalMarks` are computed for every row
 * in a section/subsection so that the header row (which is the first row)
 * can display the aggregate marks alongside the title.
 */
export function buildFormTableRows(
  sections: FormSectionRecord[],
  rootQuestions: QuestionRecord[],
): FormTableRow[] {
  const rootLayout = buildRootLayoutOrderFromRecord(sections, rootQuestions);
  const rows: FormTableRow[] = [];
  let sr = 0;
  let sectionNumber = 0;

  const collectSubsectionQuestions = (
    section: FormSectionRecord,
    subsection: FormSubsectionRecord,
    currentSectionNumber: number,
    subIndex: number,
  ) => {
    const startIdx = rows.length;
    const subsectionNumber = `${currentSectionNumber}.${subIndex + 1}`;
    const subsectionTotalMarks = subsection.questions.reduce(
      (sum, q) => sum + (q.totalMarks || 0),
      0,
    );

    if (subsection.questions.length === 0) {
      sr += 1;
      rows.push({
        sr,
        sectionTitle: section.title,
        sectionNumber: currentSectionNumber,
        subsectionTitle: subsection.title,
        subsectionNumber,
        question: null,
        isFirstInSection: false,
        isFirstInSubsection: true,
        sectionRowCount: 0,
        isHeaderOnly: true,
        sectionTotalMarks: 0,
        subsectionTotalMarks,
      });
      return;
    }

    subsection.questions.forEach((question) => {
      sr += 1;
      rows.push({
        sr,
        sectionTitle: section.title,
        sectionNumber: currentSectionNumber,
        subsectionTitle: subsection.title,
        subsectionNumber,
        question,
        isFirstInSection: false,
        isFirstInSubsection: false,
        sectionRowCount: 0,
        isHeaderOnly: false,
        sectionTotalMarks: 0,
        subsectionTotalMarks,
      });
    });

    if (rows.length > startIdx) {
      rows[startIdx].isFirstInSubsection = true;
    }
  };

  const collectSectionQuestion = (
    section: FormSectionRecord,
    currentSectionNumber: number,
    question: QuestionRecord,
  ) => {
    sr += 1;
    rows.push({
      sr,
      sectionTitle: section.title,
      sectionNumber: currentSectionNumber,
      subsectionTitle: null,
      subsectionNumber: null,
      question,
      isFirstInSection: false,
      isFirstInSubsection: false,
      sectionRowCount: 0,
      isHeaderOnly: false,
      sectionTotalMarks: 0,
      subsectionTotalMarks: 0,
    });
  };

  rootLayout.forEach((item) => {
    if (item.kind === "section") {
      const section = sections.find((s) => s.id === item.id);
      if (!section) return;

      sectionNumber += 1;
      const sectionStartIdx = rows.length;

      // Use the section layout to interleave subsections and direct questions
      // in their creation order, instead of grouping subsections first.
      const sectionLayout = buildSectionLayoutOrderFromRecord(
        section.subsections,
        section.questions,
        section.layout,
      );

      let subCounter = 0;

      for (const layoutItem of sectionLayout) {
        if (layoutItem.kind === "subsection") {
          const sub = section.subsections.find((s) => s.id === layoutItem.id);
          if (!sub) continue;
          collectSubsectionQuestions(section, sub, sectionNumber, subCounter);
          subCounter += 1;
        } else {
          const question = section.questions.find((q) => q.id === layoutItem.id);
          if (!question) continue;
          collectSectionQuestion(section, sectionNumber, question);
        }
      }

      if (rows.length > sectionStartIdx) {
        rows[sectionStartIdx].isFirstInSection = true;
        // Compute the total marks for this section by summing all questions
        // (both direct and within subsections) that belong to it.
        const sectionTotalMarks = rows
          .slice(sectionStartIdx, rows.length)
          .reduce((sum, r) => sum + (r.question?.totalMarks || 0), 0);
        for (let i = sectionStartIdx; i < rows.length; i++) {
          rows[i].sectionRowCount = rows.length - sectionStartIdx;
          rows[i].sectionTotalMarks = sectionTotalMarks;
        }
      }
    } else {
      const question = rootQuestions.find((q) => q.id === item.id);
      if (question) {
        sr += 1;
        rows.push({
          sr,
          sectionTitle: null,
          sectionNumber: null,
          subsectionTitle: null,
          subsectionNumber: null,
          question,
          isFirstInSection: true,
          isFirstInSubsection: false,
          sectionRowCount: 1,
          isHeaderOnly: false,
          sectionTotalMarks: 0,
          subsectionTotalMarks: 0,
        });
      }
    }
  });

  return rows;
}

/**
 * Formats a section label as "Section {number}: {title}  (Total: {marks})".
 * Returns just the title if no section number is available.
 * The total marks suffix is only shown when sectionTotalMarks > 0.
 */
export function formatSectionLabel(row: FormTableRow): string {
  const base =
    row.sectionNumber != null && row.sectionTitle
      ? `Section ${row.sectionNumber}: ${row.sectionTitle}`
      : (row.sectionTitle ?? "");

  if (row.sectionTotalMarks > 0) {
    return `${base}  (Total: ${row.sectionTotalMarks})`;
  }

  return base;
}

/**
 * Formats a subsection label as "{number} {title}  (Total: {marks})".
 * Returns just the title if no subsection number is available.
 * The total marks suffix is only shown when subsectionTotalMarks > 0.
 */
export function formatSubsectionLabel(row: FormTableRow): string {
  const base =
    row.subsectionNumber && row.subsectionTitle
      ? `${row.subsectionNumber} ${row.subsectionTitle}`
      : (row.subsectionTitle ?? "");

  if (row.subsectionTotalMarks > 0) {
    return `${base}  (Total: ${row.subsectionTotalMarks})`;
  }

  return base;
}
