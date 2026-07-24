"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  fetchFormSubmission,
  approveManagerReview,
  saveManagerReview,
} from "@/lib/queries/form-submissions-client";
import { invalidateStaffListingQueries } from "@/app/helpers/dashboard-listing-cache";
import { isScoredQuestion } from "@/app/helpers/form-questions";
import {
  APPRAISAL_STATUS_LABELS,
  buildRootLayoutOrderFromRecord,
  type AppraisalStatus,
  type FormSectionRecord,
  type FormSubsectionRecord,
  type QuestionRecord,
} from "@/types/forms";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";
import { cn } from "@/lib/utils";

interface SubmissionDetailViewProps {
  submissionId: number;
}

type ManagerDraft = {
  pointsEarned: string;
  remarks: string;
};

function clampScore(value: string, maxMarks: number): string {
  if (value === "") return "";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "";
  if (parsed < 0) return "0";
  if (parsed > maxMarks) return String(maxMarks);
  return value;
}

function buildManagerDraftMap(
  questions: QuestionRecord[],
  managerAnswers: EmployeeFormAnswerRecord[],
  employeeAnswers: EmployeeFormAnswerRecord[],
  manager1Answers?: EmployeeFormAnswerRecord[],
  managerLevel?: number,
): Map<number, ManagerDraft> {
  const employeeMap = new Map(
    employeeAnswers.map((answer) => [answer.questionId, answer]),
  );
  const managerMap = new Map(
    managerAnswers.map((answer) => [answer.questionId, answer]),
  );
  const manager1Map = new Map(
    (manager1Answers ?? []).map((answer) => [answer.questionId, answer]),
  );
  const drafts = new Map<number, ManagerDraft>();

  for (const question of questions) {
    if (!isScoredQuestion(question)) continue;

    const manager = managerMap.get(question.id);
    const employee = employeeMap.get(question.id);
    const manager1 = manager1Map.get(question.id);

    // For Manager 2 review, fall back to Manager 1's answers, then self-assessment
    const fallbackSource =
      managerLevel === 2 ? (manager1 ?? employee) : employee;
    const points =
      manager?.pointsEarned ?? fallbackSource?.pointsEarned ?? undefined;
    const remarks = manager?.remarks ?? fallbackSource?.remarks ?? "";

    drafts.set(question.id, {
      pointsEarned: points === undefined ? "" : String(points),
      remarks: remarks ?? "",
    });
  }

  return drafts;
}

export default function SubmissionDetailView({
  submissionId,
}: SubmissionDetailViewProps) {
  const queryClient = useQueryClient();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [managerDrafts, setManagerDrafts] = useState<Map<number, ManagerDraft>>(
    new Map(),
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["form-submission", submissionId],
    queryFn: () => fetchFormSubmission(submissionId),
  });

  useEffect(() => {
    if (!data) return;

    setManagerDrafts(
      buildManagerDraftMap(
        data.questions,
        data.managerAnswers,
        data.answers,
        data.manager1Answers,
        data.managerLevel ?? undefined,
      ),
    );
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) {
        throw new Error("Submission not loaded.");
      }

      const answers = data.questions
        .filter(isScoredQuestion)
        .map((question) => {
          const draft = managerDrafts.get(question.id);
          return {
            questionId: question.id,
            pointsEarned:
              draft?.pointsEarned === "" ? 0 : Number(draft?.pointsEarned ?? 0),
            remarks: draft?.remarks?.trim() || null,
          };
        });

      return saveManagerReview(submissionId, answers);
    },
    onSuccess: (result) => {
      setSaveMessage("Manager review saved.");
      queryClient.setQueryData(["form-submission", submissionId], (current) => {
        if (!current || typeof current !== "object") return current;
        return {
          ...current,
          managerAnswers: result.managerAnswers,
        };
      });
    },
    onError: (mutationError: Error) => {
      setSaveMessage(mutationError.message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (data?.canEditManagerReview) {
        const answers = data.questions
          .filter(isScoredQuestion)
          .map((question) => {
            const draft = managerDrafts.get(question.id);
            return {
              questionId: question.id,
              pointsEarned:
                draft?.pointsEarned === "" ? 0 : Number(draft?.pointsEarned ?? 0),
              remarks: draft?.remarks?.trim() || null,
            };
          });
        await saveManagerReview(submissionId, answers);
      }

      return approveManagerReview(submissionId);
    },
    onSuccess: (result) => {
      setSaveMessage("Manager review approved.");
      queryClient.setQueryData(["form-submission", submissionId], (current) => {
        if (!current || typeof current !== "object") return current;
        return {
          ...current,
          status: result.status,
          managerLevel: result.managerLevel,
          canEditManagerReview: false,
        };
      });
      invalidateStaffListingQueries(queryClient);
    },
    onError: (mutationError: Error) => {
      setSaveMessage(mutationError.message);
    },
  });

  const answerMap = useMemo(
    () => new Map(data?.answers.map((answer) => [answer.questionId, answer])),
    [data?.answers],
  );

  const manager1AnswerMap = useMemo(
    () =>
      new Map(
        (data?.manager1Answers ?? []).map((answer) => [
          answer.questionId,
          answer,
        ]),
      ),
    [data?.manager1Answers],
  );

  const manager2AnswerMap = useMemo(
    () =>
      new Map(
        (data?.manager2Answers ?? []).map((answer) => [
          answer.questionId,
          answer,
        ]),
      ),
    [data?.manager2Answers],
  );

  const hasManager2 = data?.manager2UserId != null;
  const currentManagerLevel = data?.managerLevel ?? 1;
  const selfAssessmentEnabled = data?.selfAssessmentEnabled ?? true;
  const editingManager1 =
    data?.canEditManagerReview && currentManagerLevel === 1;
  const editingManager2 =
    data?.canEditManagerReview && currentManagerLevel === 2;

  if (isLoading) {
    return (
      <div className="rounded-md border border-slate-300/80 p-6 text-sm text-foreground/70 dark:border-white/15">
        Loading submission...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load submission.
      </div>
    );
  }

  const rootLayout = buildRootLayoutOrderFromRecord(
    data.sections,
    data.rootQuestions,
  );

  type TableRow = {
    sr: number;
    sectionTitle: string | null;
    subsectionTitle: string | null;
    question: QuestionRecord;
    isFirstInSection: boolean;
    sectionRowCount: number;
  };

  const rows: TableRow[] = [];
  let sr = 0;

  const collectQuestions = (
    section: FormSectionRecord,
    subsection: FormSubsectionRecord | null,
  ) => {
    const questions = subsection ? subsection.questions : section.questions;
    const startIdx = rows.length;
    questions.forEach((question) => {
      sr += 1;
      rows.push({
        sr,
        sectionTitle: section.title,
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
      const section = data.sections.find((s) => s.id === item.id);
      if (!section) return;
      const startIdx = rows.length;
      section.subsections.forEach((sub) => collectQuestions(section, sub));
      collectQuestions(section, null);
      if (rows.length > startIdx) {
        rows[startIdx].isFirstInSection = true;
        for (let i = startIdx; i < rows.length; i++) {
          rows[i].sectionRowCount = rows.length - startIdx;
        }
      }
    } else {
      const question = data.rootQuestions.find((q) => q.id === item.id);
      if (question) {
        sr += 1;
        rows.push({
          sr,
          sectionTitle: null,
          subsectionTitle: null,
          question,
          isFirstInSection: true,
          sectionRowCount: 1,
        });
      }
    }
  });

  const statusStyles: Record<AppraisalStatus, string> = {
    PENDING_SELF_ASSESSMENT:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    PENDING_HEAD_REVIEW:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    PENDING_HR_CALIBRATION:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    PENDING_BOARD_APPROVAL:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    APPROVED:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
    COMPLETED:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  };

  const selfTotal = data.answers.reduce((sum, a) => sum + a.pointsEarned, 0);
  const manager1Answers = data.manager1Answers ?? [];
  const manager2Answers = data.manager2Answers ?? [];
  const manager1Total = manager1Answers.reduce(
    (sum, a) => sum + a.pointsEarned,
    0,
  );
  const manager2SavedTotal = manager2Answers.reduce(
    (sum, a) => sum + a.pointsEarned,
    0,
  );
  // Manager 2 total falls back to Manager 1's total, then self total
  const manager2Total = hasManager2
    ? manager2Answers.length > 0
      ? manager2SavedTotal
      : manager1Answers.length > 0
        ? manager1Total
        : selfTotal
    : null;
  const managerDraftTotal = [...managerDrafts.values()].reduce((sum, draft) => {
    const value = Number(draft.pointsEarned);
    return sum + (Number.isNaN(value) ? 0 : value);
  }, 0);

  const updateManagerDraft = (
    questionId: number,
    patch: Partial<ManagerDraft>,
  ) => {
    setManagerDrafts((current) => {
      const next = new Map(current);
      const existing = next.get(questionId) ?? { pointsEarned: "", remarks: "" };
      next.set(questionId, { ...existing, ...patch });
      return next;
    });
    setSaveMessage(null);
  };

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden rounded-md border border-slate-300 bg-white shadow-md shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/30">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {data.employeeName}
          </span>
          {data.employeeId ? (
            <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              SAP {data.employeeId}
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-semibold",
              statusStyles[data.status],
            )}
          >
            {APPRAISAL_STATUS_LABELS[data.status]}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {data.templateTitle}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-indigo-700 dark:text-indigo-300">
            Score {data.rawScore}/{data.maxRawScore} ({data.scorePercent}%)
          </span>
          {data.performanceLevelName ? (
            <span className="font-medium text-teal-700 dark:text-teal-300">
              {data.performanceLevelName}
              {data.quartileName ? ` · ${data.quartileName}` : ""}
            </span>
          ) : null}
          {data.submittedAt ? (
            <span className="text-slate-500 dark:text-slate-400">
              {new Date(data.submittedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>

      {data.canEditManagerReview ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-violet-50/60 px-4 py-2 text-xs dark:border-slate-700 dark:bg-violet-950/20">
          <p className="text-violet-800 dark:text-violet-200">
            {selfAssessmentEnabled
              ? "Manager scores are pre-filled from self assessment. Edit any value and save your review."
              : "Enter scores directly for this employee. Edit any value and save your review."}
          </p>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || approveMutation.isPending}
            className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-700 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/40"
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => approveMutation.mutate()}
            disabled={saveMutation.isPending || approveMutation.isPending}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {approveMutation.isPending ? "Approving..." : "Approve Review"}
          </button>
        </div>
      ) : null}

      {saveMessage ? (
        <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {saveMessage}
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-500">
        Scroll horizontally to view all columns
      </div>

      <div className="overflow-auto max-h-[70vh]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800 dark:bg-slate-950/80">
              <th className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
                Sr. No.
              </th>
              <th className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
                Key Task / Function
              </th>
              <th className="min-w-[260px] border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
                Key Performance Indicators (KPIs)
              </th>
              <th className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
                Weight
              </th>
              {selfAssessmentEnabled ? (
                <>
              <th className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-teal-300">
                Self Score
              </th>
              <th className="min-w-[180px] border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-teal-300">
                Self Remarks
              </th>
                </>
              ) : null}
              <th className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-violet-300">
                Mgr 1 Score
              </th>
              <th className="min-w-[180px] border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-violet-300">
                Mgr 1 Remarks
              </th>
              {hasManager2 ? (
                <>
                  <th className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Mgr 2 Score
                  </th>
                  <th className="min-w-[180px] px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Mgr 2 Remarks
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={selfAssessmentEnabled ? (hasManager2 ? 10 : 8) : (hasManager2 ? 8 : 6)}
                  className="bg-slate-50 px-3 py-8 text-center text-sm text-slate-500 dark:bg-slate-800/30 dark:text-slate-400"
                >
                  No questions were found for this submission.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => {
                const { question } = row;
                const answer = answerMap.get(question.id);
                const scored = isScoredQuestion(question);
                const managerDraft = managerDrafts.get(question.id) ?? {
                  pointsEarned: "",
                  remarks: "",
                };
                const mgr1Answer = manager1AnswerMap.get(question.id);
                const mgr2Answer = manager2AnswerMap.get(question.id);
                const isEvenRow = rowIdx % 2 === 0;

                return (
                  <tr
                    key={question.id}
                    className={cn(
                      "align-top border-b border-slate-100 dark:border-slate-700/40",
                      isEvenRow
                        ? "bg-white dark:bg-slate-900/40"
                        : "bg-slate-50/60 dark:bg-slate-800/20",
                    )}
                  >
                    <td className="border-r border-slate-100 px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-slate-700/40">
                      {row.sr}
                    </td>
                    {row.isFirstInSection ? (
                      <td
                        className="max-w-[220px] border-r border-slate-100 bg-amber-50/80 px-3 py-2.5 align-top dark:border-slate-700/40 dark:bg-amber-950/20"
                        rowSpan={row.sectionRowCount}
                      >
                        {row.sectionTitle ? (
                          <span
                            className="line-clamp-3 font-semibold text-amber-800 dark:text-amber-200"
                            title={row.sectionTitle}
                          >
                            {row.sectionTitle}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="border-r border-slate-100 px-3 py-2.5 dark:border-slate-700/40">
                      {row.subsectionTitle ? (
                        <span className="mb-1 block text-xs font-medium text-amber-600 dark:text-amber-400/70">
                          {row.subsectionTitle}
                        </span>
                      ) : null}
                      <p className="max-w-[450px] break-words text-xs leading-snug text-slate-800 dark:text-slate-200">
                        {question.questionText}
                      </p>
                    </td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:border-slate-700/40 dark:text-slate-300">
                      {scored ? question.totalMarks : "—"}
                    </td>
                    {selfAssessmentEnabled ? (
                      <>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-bold text-teal-700 dark:border-slate-700/40 dark:text-teal-300">
                      {scored ? (answer?.pointsEarned ?? 0) : "—"}
                    </td>
                    <td className="border-r border-slate-100 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-700/40 dark:text-slate-300">
                      {scored ? (
                        answer?.remarks?.trim() ? (
                          <p className="whitespace-pre-wrap break-words">
                            {answer.remarks}
                          </p>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                      </>
                    ) : null}
                    {/* Manager 1 Score */}
                    <td className="whitespace-nowrap border-r border-slate-100 px-2 py-2.5 text-right dark:border-slate-700/40">
                      {scored ? (
                        editingManager1 ? (
                          <input
                            type="number"
                            min={0}
                            max={question.totalMarks}
                            step="0.5"
                            value={managerDraft.pointsEarned}
                            onChange={(event) =>
                              updateManagerDraft(question.id, {
                                pointsEarned: clampScore(
                                  event.target.value,
                                  question.totalMarks,
                                ),
                              })
                            }
                            className="h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs font-bold tabular-nums text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-white/15 dark:bg-slate-800 dark:text-violet-300"
                          />
                        ) : (
                          <span className="font-bold tabular-nums text-violet-700 dark:text-violet-300">
                            {mgr1Answer?.pointsEarned ?? 0}
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {/* Manager 1 Remarks */}
                    <td className="border-r border-slate-100 px-2 py-2.5 dark:border-slate-700/40">
                      {scored ? (
                        editingManager1 ? (
                          <textarea
                            value={managerDraft.remarks}
                            rows={2}
                            onChange={(event) =>
                              updateManagerDraft(question.id, {
                                remarks: event.target.value,
                              })
                            }
                            className="w-full min-w-[160px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300"
                            placeholder="Optional remarks"
                          />
                        ) : mgr1Answer?.remarks?.trim() ? (
                          <p className="whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                            {mgr1Answer.remarks}
                          </p>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {/* Manager 2 Score + Remarks */}
                    {hasManager2 ? (
                      <>
                        <td className="whitespace-nowrap border-r border-slate-100 px-2 py-2.5 text-right dark:border-slate-700/40">
                          {scored ? (
                            editingManager2 ? (
                              <input
                                type="number"
                                min={0}
                                max={question.totalMarks}
                                step="0.5"
                                value={managerDraft.pointsEarned}
                                onChange={(event) =>
                                  updateManagerDraft(question.id, {
                                    pointsEarned: clampScore(
                                      event.target.value,
                                      question.totalMarks,
                                    ),
                                  })
                                }
                                className="h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs font-bold tabular-nums text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-white/15 dark:bg-slate-800 dark:text-indigo-300"
                              />
                            ) : (
                              <span className="font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                                {mgr2Answer?.pointsEarned
                                  ?? mgr1Answer?.pointsEarned
                                  ?? answer?.pointsEarned
                                  ?? 0}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          {scored ? (
                            editingManager2 ? (
                              <textarea
                                value={managerDraft.remarks}
                                rows={2}
                                onChange={(event) =>
                                  updateManagerDraft(question.id, {
                                    remarks: event.target.value,
                                  })
                                }
                                className="w-full min-w-[160px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300"
                                placeholder="Optional remarks"
                              />
                            ) : (mgr2Answer?.remarks?.trim() || mgr1Answer?.remarks?.trim() || answer?.remarks?.trim()) ? (
                              <p className="whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                                {mgr2Answer?.remarks?.trim() || mgr1Answer?.remarks?.trim() || answer?.remarks}
                              </p>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="bg-slate-800 dark:bg-slate-950/80">
                <td
                  colSpan={selfAssessmentEnabled ? 3 : 2}
                  className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-200"
                >
                  Total
                </td>
                <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums text-slate-100">
                  {data.maxRawScore}
                </td>
                {selfAssessmentEnabled ? (
                  <>
                <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums text-teal-300">
                  {selfTotal}
                </td>
                <td className="border-r border-slate-700 px-3 py-2.5" />
                  </>
                ) : null}
                <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums text-violet-300">
                  {editingManager1 ? managerDraftTotal : manager1Total}
                </td>
                <td className="border-r border-slate-700 px-3 py-2.5" />
                {hasManager2 ? (
                  <>
                    <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums text-indigo-300">
                      {editingManager2 ? managerDraftTotal : (manager2Total ?? 0)}
                    </td>
                    <td className="px-3 py-2.5" />
                  </>
                ) : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
