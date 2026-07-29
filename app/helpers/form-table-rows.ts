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
  question: QuestionRecord;
  isFirstInSection: boolean;
  sectionRowCount: number;
}

/**
 * Builds a flat list of table rows from form sections and root-level questions,
 * preserving display order and tracking section boundaries.
 *
 * Each row that begins a new section gets `isFirstInSection: true` and a
 * 1-based `sectionNumber` (sequential, no gaps from hidden/removed sections).
 */
export function buildFormTableRows(
  sections: FormSectionRecord[],
  rootQuestions: QuestionRecord[],
): FormTableRow[] {
  const rootLayout = buildRootLayoutOrderFromRecord(sections, rootQuestions);
  const rows: FormTableRow[] = [];
  let sr = 0;
  let sectionNumber = 0;

  const collectQuestions = (
    section: FormSectionRecord,
    subsection: FormSubsectionRecord | null,
    currentSectionNumber: number,
  ) => {
    const questions = subsection ? subsection.questions : section.questions;
    const startIdx = rows.length;
    questions.forEach((question) => {
      sr += 1;
      rows.push({
        sr,
        sectionTitle: section.title,
        sectionNumber: currentSectionNumber,
        subsectionTitle: subsection?.title ?? null,
        question,
        isFirstInSection: false,
        sectionRowCount: 0,
      });
    });
    if (rows.length > startIdx) {
      rows[startIdx].isFirstInSection = true;
      for (let i = startIdx; i < rows.length; i++) {
        rows[i].sectionRowCount = rows.length - startIdx;
      }
    }
  };

  rootLayout.forEach((item) => {
    if (item.kind === "section") {
      const section = sections.find((s) => s.id === item.id);
      if (!section) return;
      sectionNumber += 1;
      const startIdx = rows.length;
      section.subsections.forEach((sub) =>
        collectQuestions(section, sub, sectionNumber),
      );
      collectQuestions(section, null, sectionNumber);
      if (rows.length > startIdx) {
        rows[startIdx].isFirstInSection = true;
        for (let i = startIdx; i < rows.length; i++) {
          rows[i].sectionRowCount = rows.length - startIdx;
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
          question,
          isFirstInSection: true,
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
