"use client";

import { Fragment, useMemo } from "react";
import type {
  FormTemplateRecord,
  QuestionRecord,
} from "@/types/forms";
import { flattenAllQuestions } from "@/types/forms";
import {
  buildFormTableRows,
  formatSectionLabel,
  formatSubsectionLabel,
  type FormTableRow,
} from "@/app/helpers/form-table-rows";
import { isScoredQuestion } from "@/app/helpers/form-questions";
import {
  getQuestionRatingScale,
  usesRatingScore,
} from "@/app/helpers/form-rating-scoring";
import { FormDescription } from "@/app/components/forms/FormDescription";
import { QuestionRequiredIndicator } from "@/app/components/forms/QuestionRequiredIndicator";
import { RatingScoreField } from "@/app/components/forms/RatingScoreField";
import { cn } from "@/lib/utils";
import OverallRemarksSection from "./OverallRemarksSection";
import AssessmentSummaryFooter, {
  type AssessmentSummaryEntry,
} from "./AssessmentSummaryFooter";

/**
 * Which live assessment screen the preview should mirror.
 *
 * - "employee"  -> mirrors EmployeeFormFill (Self Assessment)
 * - "manager1"  -> mirrors SubmissionDetailView at managerLevel = 1
 * - "manager2"  -> mirrors SubmissionDetailView at managerLevel = 2
 */
export type FormPreviewRole = "employee" | "manager1" | "manager2";

interface FormAssessmentPreviewProps {
  template: FormTemplateRecord;
  viewAs: FormPreviewRole;
}

/**
 * Empty answer shape — mirrors EmployeeFormAnswerRecord but is purely visual.
 * Never persisted; only used to populate the preview so the layout matches
 * the live assessment screens. All values are null/empty so the preview
 * shows a blank, unfilled form — not a completed assessment.
 */
interface MockAnswer {
  questionId: number;
  pointsEarned: number | null;
  remarks: string | null;
  selectedOptionLabel: string | null;
}

/**
 * Build empty answers for a given role. All scores, remarks, and selections
 * are null so the preview reflects an unfilled form. The purpose of the
 * preview is to verify layout, visibility, and role-based permissions —
 * not to show sample data.
 */
function buildEmptyAnswers(
  questions: QuestionRecord[],
): MockAnswer[] {
  return questions.map((q) => ({
    questionId: q.id,
    pointsEarned: null,
    remarks: null,
    selectedOptionLabel: null,
  }));
}

function answerFor(
  answers: MockAnswer[],
  questionId: number,
): MockAnswer | undefined {
  return answers.find((a) => a.questionId === questionId);
}

function sumPoints(answers: MockAnswer[]): number {
  return answers.reduce((acc, a) => acc + (a.pointsEarned ?? 0), 0);
}

/**
 * Read-only score cell mirroring the live assessment display.
 */
function ScoreCell({
  value,
  max,
  isHodOnly,
  scored,
  accent,
}: {
  value: number | null;
  max: number;
  isHodOnly: boolean;
  scored: boolean;
  accent: "self" | "manager1" | "manager2";
}) {
  if (!scored) {
    return <span className="tabular-nums text-slate-400">—</span>;
  }
  if (isHodOnly && accent === "self") {
    return (
      <span className="text-xs text-slate-400" title="To be filled by HOD">
        N/A
      </span>
    );
  }
  if (value == null) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const accentClass = {
    self: "text-sky-700 dark:text-sky-300",
    manager1: "text-violet-700 dark:text-violet-300",
    manager2: "text-indigo-700 dark:text-indigo-300",
  }[accent];
  return (
    <span className={cn("tabular-nums font-medium", accentClass)}>
      {value}
      <span className="text-xs font-normal text-slate-400"> / {max}</span>
    </span>
  );
}

function PreviewScoreCell({
  question,
  ratingBased,
  ratingScales,
  value,
  isHodOnly,
  scored,
  accent,
}: {
  question: QuestionRecord;
  ratingBased: boolean;
  ratingScales: FormTemplateRecord["ratingScales"];
  value: number | null;
  isHodOnly: boolean;
  scored: boolean;
  accent: "self" | "manager1" | "manager2";
}) {
  const scale = getQuestionRatingScale(question, ratingScales);
  if (usesRatingScore(question, ratingBased, ratingScales) && scale) {
    if (!scored) {
      return <span className="tabular-nums text-slate-400">—</span>;
    }
    if (isHodOnly && accent === "self") {
      return (
        <span className="text-xs text-slate-400" title="To be filled by HOD">
          N/A
        </span>
      );
    }
    return (
      <RatingScoreField
        scale={scale}
        weight={question.totalMarks}
        ratingValue=""
        disabled
        onRatingChange={() => {}}
      />
    );
  }

  return (
    <ScoreCell
      value={value}
      max={question.totalMarks}
      isHodOnly={isHodOnly}
      scored={scored}
      accent={accent}
    />
  );
}

function RemarksCell({
  value,
  accent,
}: {
  value: string | null;
  accent: "self" | "manager1" | "manager2";
}) {
  if (!value || !value.trim()) {
    return <span className="text-xs italic text-slate-400">—</span>;
  }
  const accentClass = {
    self: "text-slate-600 dark:text-slate-300",
    manager1: "text-violet-700 dark:text-violet-300",
    manager2: "text-indigo-700 dark:text-indigo-300",
  }[accent];
  return (
    <p className={cn("max-w-[220px] break-words text-xs leading-snug", accentClass)}>
      {value}
    </p>
  );
}

/**
 * Read-only attachment placeholder cell. Shows an empty state — the preview
 * is a blank form, not a completed assessment with attachments.
 */
function AttachmentPreviewCell() {
  return (
    <span className="text-xs italic text-slate-400">—</span>
  );
}

export default function FormAssessmentPreview({
  template,
  viewAs,
}: FormAssessmentPreviewProps) {
  const allQuestions = useMemo(() => flattenAllQuestions(template), [template]);
  const rows = useMemo(
    () => buildFormTableRows(template.sections, template.questions),
    [template],
  );

  const selfAssessmentEnabled = template.selfAssessmentEnabled;
  const additionalRemarksEnabled = template.additionalRemarksEnabled;

  // Manager 2 is "assigned" in the preview so the Mgr 2 columns are visible
  // in the Manager 2 view (mirrors live behavior when manager_2_id is set).
  const hasManager2 = viewAs === "manager2";

  // Empty answers per role — the preview shows a blank, unfilled form.
  const employeeAnswers = useMemo(
    () => buildEmptyAnswers(allQuestions),
    [allQuestions],
  );
  const manager1Answers = useMemo(
    () => buildEmptyAnswers(allQuestions),
    [allQuestions],
  );
  const manager2Answers = useMemo(
    () => buildEmptyAnswers(allQuestions),
    [allQuestions],
  );

  // Score totals for the summary footer.
  const maxScore = useMemo(
    () =>
      allQuestions.reduce((acc, q) => acc + (isScoredQuestion(q) ? q.totalMarks : 0), 0),
    [allQuestions],
  );
  const selfTotal = sumPoints(employeeAnswers);
  const manager1Total = sumPoints(manager1Answers);
  const manager2Total = sumPoints(manager2Answers);

  const summaryEntries: AssessmentSummaryEntry[] = useMemo(() => {
    if (viewAs === "employee") {
      return [
        {
          label: "Self Assessment",
          awardedMarks: selfTotal,
          totalMarks: maxScore,
          accentClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
        },
      ];
    }
    const entries: AssessmentSummaryEntry[] = [];
    if (selfAssessmentEnabled) {
      entries.push({
        label: "Self Assessment",
        awardedMarks: selfTotal,
        totalMarks: maxScore,
        accentClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
      });
    }
    entries.push({
      label: "Manager 1",
      awardedMarks: manager1Total,
      totalMarks: maxScore,
      accentClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
    });
    if (hasManager2) {
      entries.push({
        label: "Manager 2",
        awardedMarks: manager2Total,
        totalMarks: maxScore,
        accentClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200",
      });
    }
    return entries;
  }, [
    viewAs,
    selfAssessmentEnabled,
    hasManager2,
    selfTotal,
    manager1Total,
    manager2Total,
    maxScore,
  ]);

  // Overall remarks are empty in preview mode — the preview shows a blank,
  // unfilled form, not a completed assessment.
  const mockManager1Remarks: string | null = null;
  const mockManager2Remarks: string | null = null;

  // Column visibility — mirrors EmployeeFormFill / SubmissionDetailView logic.
  // Employees never see any manager columns. Managers always see Manager 1
  // columns; Manager 2 columns appear only in the Manager 2 view.
  const isEmployeeView = viewAs === "employee";
  const showSelfColumns = selfAssessmentEnabled;
  const showManager1Columns = !isEmployeeView;
  const showManager2Columns = hasManager2 && !isEmployeeView;

  // Colspan for section/subsection header rows.
  // Base columns: Sr, KPIs, Weight, Attachments = 4
  // +2 if showSelfColumns (Self Score, Self Remarks)
  // +2 if showManager1Columns (Mgr 1 Score, Mgr 1 Remarks)
  // +2 if showManager2Columns (Mgr 2 Score, Mgr 2 Remarks)
  const headerColSpan =
    4 +
    (showSelfColumns ? 2 : 0) +
    (showManager1Columns ? 2 : 0) +
    (showManager2Columns ? 2 : 0);

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      {/* Header — mirrors the live assessment header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold break-words text-text-primary">
            {template.title}
          </h2>
          <FormDescription description={template.description} className="mt-2" />
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Preview · {isEmployeeView ? "Employee View" : viewAs === "manager1" ? "Manager 1 View" : "Manager 2 View"}
          </p>
        </div>
      </div>

      {/* Assessment table — mirrors EmployeeFormFill / SubmissionDetailView layout */}
      <div className="my-6">
        <div className="overflow-auto rounded-lg border border-slate-200 shadow-sm dark:border-slate-700">
          <table className="w-full min-w-[1100px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-700 dark:bg-slate-800">
                <th className="border-r border-white/10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-50">
                  Sr
                </th>
                <th className="min-w-[280px] border-r border-white/10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-50">
                  Key Performance Indicators (KPIs)
                </th>
                <th className="whitespace-nowrap border-r border-white/10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-50">
                  Weight
                </th>
                {showSelfColumns ? (
                  <>
                    <th className="min-w-[10.5rem] whitespace-nowrap border-r border-white/10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-50">
                      Self Score
                    </th>
                    <th className="whitespace-nowrap border-r border-white/10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-50">
                      Self Remarks
                    </th>
                  </>
                ) : null}
                {showManager1Columns ? (
                  <>
                    <th className="min-w-[10.5rem] whitespace-nowrap border-r border-white/10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-50">
                      Mgr 1 Score
                    </th>
                    <th className="whitespace-nowrap border-r border-white/10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-50">
                      Mgr 1 Remarks
                    </th>
                  </>
                ) : null}
                {showManager2Columns ? (
                  <>
                    <th className="min-w-[10.5rem] whitespace-nowrap border-r border-white/10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-50">
                      Mgr 2 Score
                    </th>
                    <th className="whitespace-nowrap border-r border-white/10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-50">
                      Mgr 2 Remarks
                    </th>
                  </>
                ) : null}
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-50">
                  Attachments
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={headerColSpan}
                    className="px-3 py-8 text-center text-sm text-slate-400"
                  >
                    No questions defined.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIdx) => {
                  const { question } = row;
                  const isEvenRow = rowIdx % 2 === 0;
                  return (
                    <Fragment key={row.isHeaderOnly ? `header-${row.sr}` : question!.id}>
                      {row.isFirstInSection && row.sectionTitle ? (
                        <tr className="bg-slate-100 dark:bg-slate-800/60">
                          <td
                            colSpan={headerColSpan}
                            className="px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200"
                          >
                            {formatSectionLabel(row)}
                          </td>
                        </tr>
                      ) : null}
                      {row.isFirstInSubsection && row.subsectionTitle ? (
                        <tr className="bg-teal-50/60 dark:bg-teal-950/20">
                          <td
                            colSpan={headerColSpan}
                            className="px-3 py-2 pl-8 text-xs font-bold text-teal-700 dark:text-teal-300"
                          >
                            {formatSubsectionLabel(row)}
                          </td>
                        </tr>
                      ) : null}
                      {row.isHeaderOnly ? (
                        <tr className="bg-teal-50/40 dark:bg-teal-950/10">
                          <td
                            colSpan={headerColSpan}
                            className="px-3 py-2 pl-10 text-xs italic text-slate-400"
                          >
                            No questions in this subsection
                          </td>
                        </tr>
                      ) : (
                        <QuestionPreviewRow
                          row={row}
                          isEvenRow={isEvenRow}
                          showSelfColumns={showSelfColumns}
                          showManager1Columns={showManager1Columns}
                          showManager2Columns={showManager2Columns}
                          selfAssessmentEnabled={selfAssessmentEnabled}
                          ratingBased={template.ratingBased}
                          ratingScales={template.ratingScales}
                          employeeAnswer={answerFor(employeeAnswers, question!.id)}
                          manager1Answer={answerFor(manager1Answers, question!.id)}
                          manager2Answer={answerFor(manager2Answers, question!.id)}
                        />
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Score summary footer — mirrors AssessmentSummaryFooter usage in live views */}
      <AssessmentSummaryFooter entries={summaryEntries} showMarks={false} />

      {/* Additional Remarks — mirrors OverallRemarksSection usage.
          Employees never see this. Managers see it only when enabled. */}
      {!isEmployeeView && additionalRemarksEnabled ? (
        <OverallRemarksSection
          enabled={additionalRemarksEnabled}
          manager1Remarks={mockManager1Remarks}
          manager2Remarks={hasManager2 ? mockManager2Remarks : null}
          hasManager2={hasManager2}
          canEditManager1={false}
          canEditManager2={false}
        />
      ) : null}
    </div>
  );
}

interface QuestionPreviewRowProps {
  row: FormTableRow;
  isEvenRow: boolean;
  showSelfColumns: boolean;
  showManager1Columns: boolean;
  showManager2Columns: boolean;
  selfAssessmentEnabled: boolean;
  ratingBased: boolean;
  ratingScales: FormTemplateRecord["ratingScales"];
  employeeAnswer?: MockAnswer;
  manager1Answer?: MockAnswer;
  manager2Answer?: MockAnswer;
}

function QuestionPreviewRow({
  row,
  isEvenRow,
  showSelfColumns,
  showManager1Columns,
  showManager2Columns,
  selfAssessmentEnabled,
  ratingBased,
  ratingScales,
  employeeAnswer,
  manager1Answer,
  manager2Answer,
}: QuestionPreviewRowProps) {
  const question = row.question!;
  const scored = isScoredQuestion(question);
  const isHodOnly =
    !question.selfAssessmentEnabled || !selfAssessmentEnabled;

  const rowBg = isEvenRow
    ? "bg-white dark:bg-slate-900/40"
    : "bg-slate-50/40 dark:bg-slate-800/20";

  return (
    <tr className={cn("align-top border-b border-slate-100 dark:border-slate-700/40", rowBg)}>
      <td className="border-r border-slate-100 px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-slate-700/40 dark:text-slate-400">
        {row.sr}
      </td>
      <td className="border-r border-slate-100 px-3 py-2.5 dark:border-slate-700/40">
        <p className="max-w-[450px] break-words whitespace-pre-wrap text-xs leading-snug text-slate-800 dark:text-slate-200">
          {question.questionText}
          <QuestionRequiredIndicator isRequired={question.isRequired} />
        </p>
        {question.options.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {question.options.map((opt) => (
              <li
                key={opt.id}
                className="text-[11px] text-slate-500 dark:text-slate-400"
              >
                ○ {opt.optionLabel}{" "}
                <span className="text-slate-400">({opt.pointsAssigned} pts)</span>
              </li>
            ))}
          </ul>
        ) : null}
      </td>
      <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-center tabular-nums text-xs text-slate-600 dark:border-slate-700/40 dark:text-slate-300">
        {scored ? question.totalMarks : "—"}
      </td>

      {showSelfColumns ? (
        <>
          <td className="min-w-[10.5rem] overflow-hidden border-r border-slate-100 px-2 py-2.5 text-center dark:border-slate-700/40">
            <PreviewScoreCell
              question={question}
              ratingBased={ratingBased}
              ratingScales={ratingScales}
              value={employeeAnswer?.pointsEarned ?? null}
              isHodOnly={isHodOnly}
              scored={scored}
              accent="self"
            />
          </td>
          <td className="border-r border-slate-100 px-3 py-2.5 dark:border-slate-700/40">
            <RemarksCell value={employeeAnswer?.remarks ?? null} accent="self" />
          </td>
        </>
      ) : null}

      {/* Manager 1 — hidden in Employee view (employees never see manager columns) */}
      {showManager1Columns ? (
        <>
          <td className="min-w-[10.5rem] overflow-hidden border-r border-slate-100 px-2 py-2.5 text-center dark:border-slate-700/40">
            <PreviewScoreCell
              question={question}
              ratingBased={ratingBased}
              ratingScales={ratingScales}
              value={manager1Answer?.pointsEarned ?? null}
              isHodOnly={!question.hodAssessmentEnabled}
              scored={scored}
              accent="manager1"
            />
          </td>
          <td className="border-r border-slate-100 px-3 py-2.5 dark:border-slate-700/40">
            <RemarksCell value={manager1Answer?.remarks ?? null} accent="manager1" />
          </td>
        </>
      ) : null}

      {showManager2Columns ? (
        <>
          <td className="min-w-[10.5rem] overflow-hidden border-r border-slate-100 px-2 py-2.5 text-center dark:border-slate-700/40">
            <PreviewScoreCell
              question={question}
              ratingBased={ratingBased}
              ratingScales={ratingScales}
              value={manager2Answer?.pointsEarned ?? null}
              isHodOnly={!question.hodAssessmentEnabled}
              scored={scored}
              accent="manager2"
            />
          </td>
          <td className="border-r border-slate-100 px-3 py-2.5 dark:border-slate-700/40">
            <RemarksCell value={manager2Answer?.remarks ?? null} accent="manager2" />
          </td>
        </>
      ) : null}

      <td className="px-3 py-2.5">
        <AttachmentPreviewCell />
      </td>
    </tr>
  );
}
