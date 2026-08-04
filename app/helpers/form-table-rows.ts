import {
  buildRootLayoutOrderFromRecord,
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
  question: QuestionRecord;
  isFirstInSection: boolean;
  isFirstInSubsection: boolean;
  sectionRowCount: number;
}

/**
 * Builds a flat list of table rows from form sections and root-level questions,
 * preserving display order and tracking section and subsection boundaries.
 *
 * Each row that begins a new section gets `isFirstInSection: true` and a
 * 1-based `sectionNumber` (sequential, no gaps from hidden/removed sections).
 * Subsection rows get `isFirstInSubsection: true` and a dotted number such
 * as "1.1" to support subsection-level numbering in the UI.
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
      });
    });

    if (rows.length > startIdx) {
      rows[startIdx].isFirstInSubsection = true;
    }
  };

  const collectSectionQuestions = (
    section: FormSectionRecord,
    currentSectionNumber: number,
  ) => {
    const startIdx = rows.length;

    section.questions.forEach((question) => {
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
      });
    });

    return startIdx;
  };

  rootLayout.forEach((item) => {
    if (item.kind === "section") {
      const section = sections.find((s) => s.id === item.id);
      if (!section) return;

      sectionNumber += 1;
      const sectionStartIdx = rows.length;

      section.subsections.forEach((sub, subIndex) =>
        collectSubsectionQuestions(section, sub, sectionNumber, subIndex),
      );
      collectSectionQuestions(section, sectionNumber);

      if (rows.length > sectionStartIdx) {
        rows[sectionStartIdx].isFirstInSection = true;
        for (let i = sectionStartIdx; i < rows.length; i++) {
          rows[i].sectionRowCount = rows.length - sectionStartIdx;
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
        });
      }
    }
  });

  return rows;
}

/**
 * Formats a section label as "Section {number}: {title}".
 * Returns just the title if no section number is available.
 */
export function formatSectionLabel(row: FormTableRow): string {
  if (row.sectionNumber != null && row.sectionTitle) {
    return `Section ${row.sectionNumber}: ${row.sectionTitle}`;
  }

  return row.sectionTitle ?? "";
}

/**
 * Formats a subsection label as "{number} {title}" (e.g. "1.1 Classroom Activities").
 * Returns just the title if no subsection number is available.
 */
export function formatSubsectionLabel(row: FormTableRow): string {
  if (row.subsectionNumber && row.subsectionTitle) {
    return `${row.subsectionNumber} ${row.subsectionTitle}`;
  }

  return row.subsectionTitle ?? "";
}
