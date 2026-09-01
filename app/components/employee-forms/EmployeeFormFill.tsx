"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Paperclip, Trash2, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/app/components/auth/Button";
import { RatingScoreField } from "@/app/components/forms/RatingScoreField";
import {
  getQuestionRatingScale,
  usesRatingScore,
} from "@/app/helpers/form-rating-scoring";
import {
  deleteEmployeeFormAttachment,
  fetchEmployeeForm,
  getEmployeeFormAttachmentDownloadUrl,
  MAX_FORM_ATTACHMENT_BYTES,
  saveEmployeeForm,
  uploadEmployeeFormAttachment,
} from "@/lib/queries/employee-forms-client";
import { fetchFormTemplate } from "@/lib/queries/forms-client";
import type {
  EmployeeFormAnswerAttachment,
  EmployeeFormAnswerInput,
  EmployeeFormDetail,
} from "@/types/employee-forms";
import {
  flattenAllQuestions,
  type FormTemplateRecord,
} from "@/types/forms";
import { cn } from "@/lib/utils";
import {
  buildFormTableRows,
  formatSectionLabel,
  formatSubsectionLabel,
} from "@/app/helpers/form-table-rows";
import AssessmentSummaryFooter from "@/app/components/forms/AssessmentSummaryFooter";
import { FormDescription } from "@/app/components/forms/FormDescription";
import { QuestionRequiredIndicator } from "@/app/components/forms/QuestionRequiredIndicator";
import IneligibilityBanner from "@/app/components/forms/EligibilityStatusBanner";
import ReturnHistoryBanner from "@/app/components/forms/ReturnHistoryBanner";
import PrintButton from "@/app/components/forms/PrintButton";
import PrintDocumentHeader from "@/app/components/print/PrintDocumentHeader";
import PrintFooter from "@/app/components/print/PrintFooter";

interface EmployeeFormFillProps {
  templateId: number;
  /** Admin/employee-layout preview: view only, no save/submit or assignment required. */
  mode?: "fill" | "preview";
}

function buildPreviewDetail(template: FormTemplateRecord): EmployeeFormDetail {
  // Match the backend's calculateMaxRawScore: sum ALL scored questions
  // regardless of selfAssessmentEnabled or isRequired status. This ensures
  // the preview shows the same total as the live assessment flow.
  const maxRawScore = flattenAllQuestions(template)
    .filter((question) => Number(question.totalMarks) > 0)
    .reduce((sum, question) => sum + Number(question.totalMarks), 0);

  return {
    template,
    appraisalId: null,
    status: "NOT_STARTED",
    submittedAt: null,
    answers: [],
    rawScore: 0,
    maxRawScore,
    selfAssessmentEnabled: template.selfAssessmentEnabled,
    assessmentEligibility: true,
    eligibilityStatus: "Fully Eligible",
    canFillAssessment: true,
    ineligibilityReason: null,
    headName: null,
    manager2Name: null,
    employeeName: null,
    employeeId: null,
  };
}

type AnswerState = Record<
  number,
  {
    pointsEarned: string;
    ratingValue: string;
    remarks: string;
    attachments: EmployeeFormAnswerAttachment[];
  }
>;

function buildInitialAnswers(
  questions: Array<{ id: number }>,
  existingAnswers: Array<{
    questionId: number;
    pointsEarned: number;
    ratingValue?: number | null;
    remarks: string | null;
    attachments: EmployeeFormAnswerAttachment[];
  }>,
): AnswerState {
  const map: AnswerState = {};

  for (const question of questions) {
    map[question.id] = {
      pointsEarned: "",
      ratingValue: "",
      remarks: "",
      attachments: [],
    };
  }

  for (const answer of existingAnswers) {
    map[answer.questionId] = {
      pointsEarned: String(answer.pointsEarned ?? ""),
      ratingValue:
        answer.ratingValue == null ? "" : String(answer.ratingValue),
      remarks: answer.remarks ?? "",
      attachments: answer.attachments ?? [],
    };
  }

  return map;
}

function toPayload(answers: AnswerState): EmployeeFormAnswerInput[] {
  return Object.entries(answers)
    .map(([questionId, value]) => ({
      questionId: Number(questionId),
      pointsEarned:
        value.pointsEarned !== "" ? Number(value.pointsEarned) : undefined,
      ratingValue:
        value.ratingValue !== "" ? Number(value.ratingValue) : undefined,
      remarks: (value.remarks ?? "").trim() || null,
    }))
    .filter(
      (answer) =>
        answer.pointsEarned !== undefined ||
        answer.ratingValue !== undefined ||
        Boolean(answer.remarks),
    );
}

function clampScore(value: string, maxMarks: number): string {
  if (value === "") {
    return "";
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return value;
  }

  if (numeric < 0) {
    return "0";
  }

  if (numeric > maxMarks) {
    return String(maxMarks);
  }

  return value;
}

function isScoredQuestion(question: {
  inputType: string;
  totalMarks: number;
}): boolean {
  return Number(question.totalMarks) > 0;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EmployeeFormFill({
  templateId,
  mode = "fill",
}: EmployeeFormFillProps) {
  const isPreview = mode === "preview";
  const queryClient = useQueryClient();
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [answers, setAnswers] = useState<AnswerState>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submittedScore, setSubmittedScore] = useState<{
    rawScore: number;
    maxRawScore: number;
  } | null>(null);
  const [uploadingQuestionId, setUploadingQuestionId] = useState<number | null>(
    null,
  );
  const [uploadErrorByQuestion, setUploadErrorByQuestion] = useState<
    Record<number, string>
  >({});

  // Auto-dismiss the global toast notifications after a few seconds so the
  // user is not forced to hunt for them or manually dismiss them.
  useEffect(() => {
    if (!formError) {
      return;
    }
    const timer = setTimeout(() => setFormError(null), 6000);
    return () => clearTimeout(timer);
  }, [formError]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const { data, isLoading, error } = useQuery({
    queryKey: isPreview
      ? ["form-employee-preview", templateId]
      : ["my-form", templateId],
    queryFn: async () => {
      if (isPreview) {
        const template = await fetchFormTemplate(templateId);
        return buildPreviewDetail(template);
      }
      return fetchEmployeeForm(templateId);
    },
  });

  const [prevFormData, setPrevFormData] = useState(data);
  if (data !== prevFormData) {
    setPrevFormData(data);
    if (data) {
      setAnswers(
        buildInitialAnswers(flattenAllQuestions(data.template), data.answers),
      );
    }
  }

  const isReadOnly =
    isPreview ||
    data?.status === "SUBMITTED" ||
    (data != null && !data.selfAssessmentEnabled) ||
    (data != null && !data.canFillAssessment);
  const maxRawScore = useMemo(() => {
    if (!data) {
      return 0;
    }

    // Match the backend's calculateMaxRawScore: sum ALL scored questions
    // regardless of selfAssessmentEnabled or isRequired status. This ensures
    // the displayed total matches the form's configured max marks.
    const fromTemplate = flattenAllQuestions(data.template)
      .filter(isScoredQuestion)
      .reduce((sum, question) => sum + Number(question.totalMarks), 0);

    return fromTemplate > 0 ? fromTemplate : (data.maxRawScore ?? 0);
  }, [data]);

  const liveRawScore = useMemo(() => {
    if (!data) {
      return 0;
    }

    return flattenAllQuestions(data.template)
      .filter(
        (question) =>
          isScoredQuestion(question) &&
          data.selfAssessmentEnabled &&
          question.selfAssessmentEnabled,
      )
      .reduce((sum, question) => {
        const answer = answers[question.id];
        if (!answer || answer.pointsEarned === "") {
          return sum;
        }

        const score = Number(answer.pointsEarned);
        return sum + (Number.isNaN(score) ? 0 : score);
      }, 0);
  }, [answers, data]);

  const displayedRawScore = isReadOnly ? (data?.rawScore ?? 0) : liveRawScore;

  const saveMutation = useMutation({
    mutationFn: (submit: boolean) =>
      saveEmployeeForm(templateId, {
        answers: toPayload(answers),
        submit,
      }),
    onSuccess: (result, submit) => {
      setFormError(null);
      queryClient.setQueryData(["my-form", templateId], result);
      queryClient.invalidateQueries({ queryKey: ["my-forms"] });

      if (submit) {
        setSubmittedScore({
          rawScore: result.rawScore,
          maxRawScore: result.maxRawScore,
        });
        setThankYouOpen(true);
        setSuccessMessage(null);
        return;
      }

      setSuccessMessage("Draft saved successfully.");
    },
    onError: (mutationError: Error) => {
      setSuccessMessage(null);
      setFormError(mutationError.message);
    },
  });

  const closeThankYouDialog = () => {
    setThankYouOpen(false);
  };
  const updateAnswer = (
    questionId: number,
    field: "pointsEarned" | "ratingValue" | "remarks",
    value: string,
  ) => {
    setAnswers((current) => {
      const existing = current[questionId] ?? {
        pointsEarned: "",
        ratingValue: "",
        remarks: "",
        attachments: [],
      };
      return {
        ...current,
        [questionId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const updateScore = (questionId: number, maxMarks: number, value: string) => {
    updateAnswer(questionId, "pointsEarned", clampScore(value, maxMarks));
  };

  const validateBeforeSubmit = (): string | null => {
    if (!data) {
      return null;
    }

    for (const question of flattenAllQuestions(data.template)) {
      if (!isScoredQuestion(question)) {
        continue;
      }

      // Skip HOD-only questions — employee cannot fill them
      if (!question.selfAssessmentEnabled) {
        continue;
      }

      const answer = answers[question.id];
      const ratingQuestion = usesRatingScore(
        question,
        data.template.ratingBased,
        data.template.ratingScales,
      );
      const hasScore = ratingQuestion
        ? Boolean(answer && answer.ratingValue !== "")
        : Boolean(answer && answer.pointsEarned !== "");

      // Optional questions can be left blank
      if (!question.isRequired && !hasScore) {
        continue;
      }

      if (!hasScore) {
        return ratingQuestion
          ? `Select a rating for "${question.questionText.slice(0, 60)}..."`
          : `Enter a score for question ${question.questionText.slice(0, 60)}...`;
      }

      if (ratingQuestion) {
        const scale = getQuestionRatingScale(
          question,
          data.template.ratingScales,
        );
        const rating = Number(answer!.ratingValue);
        if (
          !scale ||
          Number.isNaN(rating) ||
          !scale.options.some((option) => Number(option.ratingValue) === rating)
        ) {
          return `Select a valid rating for "${question.questionText.slice(0, 60)}..."`;
        }
      } else {
        const score = Number(answer!.pointsEarned);
        if (Number.isNaN(score) || score < 0 || score > question.totalMarks) {
          return `Score must be between 0 and ${question.totalMarks} for "${question.questionText.slice(0, 60)}..."`;
        }
      }

      // Remarks are required when the employee filled in a score — whether
      // the question is mandatory or optional. If an optional question is
      // skipped (no score), remarks are also optional.
      if (hasScore && !(answer!.remarks ?? "").trim()) {
        return `Remarks are required for "${question.questionText.slice(0, 60)}..."`;
      }
    }

    return null;
  };

  const handleSave = (submit: boolean) => {
    if (isPreview) {
      return;
    }

    setFormError(null);
    setSuccessMessage(null);

    if (submit) {
      const validationError = validateBeforeSubmit();
      if (validationError) {
        setFormError(validationError);
        return;
      }
      // Open confirmation modal before submitting.
      setSubmitConfirmOpen(true);
      return;
    }

    saveMutation.mutate(submit);
  };

  const confirmSubmit = () => {
    setSubmitConfirmOpen(false);
    saveMutation.mutate(true);
  };

  const handleUpload = async (questionId: number, file: File | null) => {
    if (!file || isReadOnly) {
      return;
    }

    if (file.size > MAX_FORM_ATTACHMENT_BYTES) {
      setUploadErrorByQuestion((current) => ({
        ...current,
        [questionId]: `Attachment "${file.name}" is ${formatBytes(file.size)} and exceeds the 2 MB limit.`,
      }));
      const input = fileInputRefs.current[questionId];
      if (input) {
        input.value = "";
      }
      return;
    }

    setFormError(null);
    setUploadErrorByQuestion((current) => {
      if (!current[questionId]) {
        return current;
      }
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    setSuccessMessage(null);
    setUploadingQuestionId(questionId);

    try {
      // Persist current scores/remarks first so attachment stays tied to draft answers.
      await saveEmployeeForm(templateId, {
        answers: toPayload(answers),
        submit: false,
      });

      const attachment = await uploadEmployeeFormAttachment(
        templateId,
        questionId,
        file,
      );

      setAnswers((current) => ({
        ...current,
        [questionId]: {
          ...current[questionId],
          attachments: [...(current[questionId]?.attachments ?? []), attachment],
        },
      }));

      await queryClient.invalidateQueries({ queryKey: ["my-form", templateId] });
      setSuccessMessage("Attachment uploaded.");
    } catch (uploadError) {
      setUploadErrorByQuestion((current) => ({
        ...current,
        [questionId]:
          uploadError instanceof Error
            ? uploadError.message
            : "Failed to upload attachment.",
      }));
    } finally {
      setUploadingQuestionId(null);
      const input = fileInputRefs.current[questionId];
      if (input) {
        input.value = "";
      }
    }
  };

  const handleDeleteAttachment = async (
    questionId: number,
    attachmentId: number,
  ) => {
    if (isReadOnly) {
      return;
    }

    setFormError(null);
    setSuccessMessage(null);

    try {
      await deleteEmployeeFormAttachment(templateId, attachmentId);
      setAnswers((current) => ({
        ...current,
        [questionId]: {
          ...current[questionId],
          attachments: (current[questionId]?.attachments ?? []).filter(
            (item) => item.id !== attachmentId,
          ),
        },
      }));
      setSuccessMessage("Attachment removed.");
    } catch (deleteError) {
      setFormError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to remove attachment.",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-md border border-slate-300/80 p-6 text-sm text-foreground/70 shadow-sm dark:border-white/15">
        Loading form...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load this form.
      </div>
    );
  }

  const { template } = data;
  const rows = buildFormTableRows(template.sections, template.questions);

  const statusLabel = isPreview
    ? "Preview · view only"
    : data.status === "SUBMITTED"
      ? `Submitted${data.submittedAt ? ` ${new Date(data.submittedAt).toLocaleString()}` : ""}`
      : data.status === "DRAFT"
        ? "Draft"
        : "Not started";

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <PrintDocumentHeader
        title={template.title}
        description={template.description}
        metaItems={[
          { label: "Employee", value: data.employeeName ?? "N/A" },
          { label: "SAP ID", value: data.employeeId ?? "N/A" },
          { label: "Status", value: statusLabel },
          { label: "Score", value: `${displayedRawScore} / ${maxRawScore}` },
          { label: "Manager 1", value: data.headName ?? "N/A" },
          { label: "Manager 2", value: data.manager2Name ?? "N/A" },
        ]}
      />
      {formError || successMessage ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "no-print fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-md border bg-white px-4 py-3 shadow-lg dark:bg-slate-900",
            formError
              ? "border-red-200 dark:border-red-900"
              : "border-emerald-200 dark:border-emerald-900",
          )}
        >
          {formError ? (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
          )}
          <p
            className={cn(
              "min-w-0 flex-1 text-sm",
              formError
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {formError ?? successMessage}
          </p>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setSuccessMessage(null);
            }}
            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Dismiss notification"
          >
            <X className="size-4 text-slate-400" />
          </button>
        </div>
      ) : null}

      {isPreview ? (
        <div className="no-print rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          Employee form preview — layout matches what staff see on My Forms.
          Scores and submissions are disabled.
        </div>
      ) : null}

      <div className="no-print flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            {template.title}
          </h2>
          <FormDescription description={template.description} className="mt-2" />
        </div>
        <PrintButton
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
        />
      </div>

      {!isPreview && data != null && !data.canFillAssessment ? (
        <IneligibilityBanner
          role="self"
          status={
            data.eligibilityStatus === "Not Eligible"
              ? "Not Eligible"
              : "Ineligible"
          }
          reason={data.ineligibilityReason}
        />
      ) : null}

      {!isPreview && data?.returnHistory && data.returnHistory.length > 0 ? (
        <ReturnHistoryBanner
          returnHistory={data.returnHistory}
          view="employee"
        />
      ) : null}

      <div className="no-print grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {statusLabel}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Score</p>
          <p className="mt-1 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            {displayedRawScore} / {maxRawScore}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Manager 1</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {data?.headName ?? "N/A"}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Manager 2</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {data?.manager2Name ?? "N/A"}
          </p>
        </div>
      </div>

      <div className="min-w-0 max-w-full overflow-x-hidden rounded-md border border-slate-300 shadow-md shadow-slate-200/50 dark:border-slate-700 dark:shadow-slate-900/30 bg-white dark:bg-slate-900">
        <div className="no-print flex items-center gap-2 border-b border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-500">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          Scroll horizontally to view all columns
        </div>
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800 dark:bg-slate-950/80">
                <th className="print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 dark:border-slate-700/50 dark:text-slate-300">
                  Sr. No.
                </th>
                <th className="min-w-[260px] print-col-large border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 dark:border-slate-700/50 dark:text-slate-300">
                  Key Performance Indicators (KPIs)
                </th>
                <th className="print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 dark:border-slate-700/50 dark:text-slate-300">
                  Weight
                </th>
                <th className="print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-teal-300 dark:border-slate-700/50 dark:text-teal-400">
                  Self Score
                </th>
                <th className="min-w-[220px] print-col-largest border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 dark:border-slate-700/50 dark:text-slate-300">
                  Remarks
                </th>
                <th className="no-print min-w-[200px] px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 dark:text-slate-300">
                  Attachments
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30"
                  >
                    No questions were found for this form.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIdx) => {
                  const { question } = row;
                  const isEvenRow = rowIdx % 2 === 0;

                  return (
                    <Fragment key={row.isHeaderOnly ? `header-${row.sr}` : question!.id}>
                      {row.isFirstInSection && row.sectionTitle ? (
                        <tr className="bg-amber-50/80 dark:bg-amber-950/20">
                          <td colSpan={6} className="form-section-header-cell text-sm font-bold text-amber-800 dark:text-amber-200">
                            {formatSectionLabel(row)}
                          </td>
                        </tr>
                      ) : null}
                      {row.isFirstInSubsection && row.subsectionTitle ? (
                        <tr className="bg-teal-50/60 dark:bg-teal-950/20">
                          <td colSpan={6} className="form-section-header-cell pl-8 text-xs font-bold text-teal-700 dark:text-teal-300">
                            {formatSubsectionLabel(row)}
                          </td>
                        </tr>
                      ) : null}
                      {row.isHeaderOnly ? (
                        <tr className="bg-teal-50/40 dark:bg-teal-950/10">
                          <td colSpan={6} className="px-3 py-2 pl-10 text-xs italic text-amber-400 dark:text-amber-400/70">
                            No questions in this subsection
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          const answer = answers[question!.id] ?? {
                            pointsEarned: "",
                            remarks: "",
                            attachments: [],
                          };
                          const scored = isScoredQuestion(question!);
                          const isHodOnly = !question!.selfAssessmentEnabled || !data.selfAssessmentEnabled;
                          return (
                            <tr className={cn(
                              "align-top border-b border-slate-100 dark:border-slate-700/40",
                              isEvenRow
                                ? "bg-white dark:bg-slate-900/40"
                                : "bg-slate-50/60 dark:bg-slate-800/20",
                            )}>
                              <td className="border-r border-slate-100 px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-slate-700/40 dark:text-slate-400">
                                {row.sr}
                              </td>
                              <td className="border-r border-slate-100 px-3 py-2.5 dark:border-slate-700/40">
                                <p className="max-w-[420px] break-words whitespace-pre-wrap text-xs leading-snug text-slate-800 dark:text-slate-200">
                                  {question!.questionText}
                                  <QuestionRequiredIndicator isRequired={question!.isRequired} />
                                </p>
                                {question!.options.length > 0 ? (
                                  <ul className="mt-1.5 space-y-0.5">
                                    {question!.options.map((option) => (
                                      <li
                                        key={option.id}
                                        className="max-w-[400px] break-words text-[11px] text-slate-500 dark:text-slate-400"
                                      >
                                        • {option.optionLabel}
                                        {option.pointsAssigned > 0
                                          ? ` (${option.pointsAssigned} pts)`
                                          : ""}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </td>
                              <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:border-slate-700/40 dark:text-slate-300">
                                {question!.totalMarks}
                              </td>
                              <td className="whitespace-nowrap border-r border-slate-100 px-2 py-2.5 text-right dark:border-slate-700/40">
                                {scored && !isHodOnly ? (
                                  usesRatingScore(
                                    question!,
                                    data.template.ratingBased,
                                    data.template.ratingScales,
                                  ) ? (
                                    <RatingScoreField
                                      scale={
                                        getQuestionRatingScale(
                                          question!,
                                          data.template.ratingScales,
                                        )!
                                      }
                                      weight={question!.totalMarks}
                                      ratingValue={answer.ratingValue}
                                      disabled={isReadOnly}
                                      onRatingChange={(nextRating, nextPoints) =>
                                        setAnswers((current) => {
                                          const existing = current[question!.id] ?? {
                                            pointsEarned: "",
                                            ratingValue: "",
                                            remarks: "",
                                            attachments: [],
                                          };
                                          return {
                                            ...current,
                                            [question!.id]: {
                                              ...existing,
                                              ratingValue: nextRating,
                                              pointsEarned: nextPoints,
                                            },
                                          };
                                        })
                                      }
                                    />
                                  ) : (
                                  <input
                                    type="number"
                                    min={0}
                                    max={question!.totalMarks}
                                    step="0.5"
                                    value={answer.pointsEarned}
                                    disabled={isReadOnly}
                                    onChange={(e) =>
                                      updateScore(
                                        question!.id,
                                        question!.totalMarks,
                                        e.target.value,
                                      )
                                    }
                                    onBlur={(e) =>
                                      updateScore(
                                        question!.id,
                                        question!.totalMarks,
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs tabular-nums text-teal-700 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-60 dark:border-white/15 dark:bg-slate-800 dark:text-teal-300"
                                    placeholder={`0–${question!.totalMarks}`}
                                  />
                                  )
                                ) : scored && isHodOnly ? (
                                  <span className="text-xs text-slate-400" title="To be filled by HOD">N/A</span>
                                ) : (
                                  <span className="tabular-nums text-slate-400">—</span>
                                )}
                              </td>
                              <td className="border-r border-slate-100 px-2 py-2.5 dark:border-slate-700/40">
                                {(() => {
                                  const hasScore =
                                    answer.pointsEarned !== "" ||
                                    answer.ratingValue !== "";
                                  const remarksRequired = !isHodOnly && (question!.isRequired || hasScore);
                                  return (
                                    <textarea
                                      value={answer.remarks}
                                      disabled={isReadOnly || isHodOnly}
                                      rows={2}
                                      onChange={(e) =>
                                        updateAnswer(question!.id, "remarks", e.target.value)
                                      }
                                      className={cn(
                                        "w-full rounded border bg-white px-2 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:bg-slate-800 dark:text-slate-300",
                                        remarksRequired
                                          ? "border-amber-400 dark:border-amber-600/50"
                                          : "border-slate-300 dark:border-white/15",
                                      )}
                                      placeholder={
                                        isHodOnly
                                          ? "HOD only"
                                          : remarksRequired
                                            ? "Required remarks *"
                                            : "Optional remarks"
                                      }
                                    />
                                  );
                                })()}
                              </td>
                              <td className="px-2 py-2.5">
                                <div className="space-y-2">
                                  {(answer.attachments ?? []).map((attachment) => (
                                    <div
                                      key={attachment.id}
                                      className="flex items-start justify-between gap-2 rounded border border-slate-200 px-2 py-1.5 dark:border-white/10"
                                    >
                                      <a
                                        href={getEmployeeFormAttachmentDownloadUrl(
                                          templateId,
                                          attachment.id,
                                        )}
                                        className="min-w-0 flex-1 truncate text-[11px] font-medium text-primary hover:underline"
                                        title={attachment.originalFilename}
                                      >
                                        {attachment.originalFilename}
                                        <span className="ml-1 text-slate-400">
                                          ({formatBytes(attachment.sizeBytes)})
                                        </span>
                                      </a>
                                      {!isReadOnly ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleDeleteAttachment(
                                              question!.id,
                                              attachment.id,
                                            )
                                          }
                                          className="inline-flex size-6 items-center justify-center rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                          aria-label={`Remove ${attachment.originalFilename}`}
                                        >
                                          <Trash2 className="size-3.5" />
                                        </button>
                                      ) : null}
                                    </div>
                                  ))}

                                  {!isReadOnly ? (
                                    <>
                                      <input
                                        ref={(element) => {
                                          fileInputRefs.current[question!.id] = element;
                                        }}
                                        type="file"
                                        className="hidden"
                                        onChange={(event) =>
                                          void handleUpload(
                                            question!.id,
                                            event.target.files?.[0] ?? null,
                                          )
                                        }
                                      />
                                      <button
                                        type="button"
                                        disabled={uploadingQuestionId === question!.id}
                                        onClick={() =>
                                          fileInputRefs.current[question!.id]?.click()
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-primary/10 disabled:opacity-60 dark:border-white/15 dark:text-slate-300"
                                      >
                                        <Paperclip className="size-3.5" />
                                        {uploadingQuestionId === question!.id
                                          ? "Uploading..."
                                          : "Attach file"}
                                      </button>
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                        Max 2 MB
                                      </span>
                                      {uploadErrorByQuestion[question!.id] ? (
                                        <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
                                          {uploadErrorByQuestion[question!.id]}
                                        </p>
                                      ) : null}
                                    </>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })()
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="bg-slate-800 dark:bg-slate-950/80">
                  <td
                    colSpan={2}
                    className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-200 dark:text-slate-300"
                  >
                    Overall Score
                  </td>
                  <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-100 dark:border-slate-700/50 dark:text-slate-200">
                    {maxRawScore}
                  </td>
                  <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right tabular-nums text-sm font-bold text-teal-300 dark:border-slate-700/50 dark:text-teal-400">
                    {displayedRawScore}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      {rows.length > 0 ? (
        <AssessmentSummaryFooter
          entries={[
            {
              label: "Self Assessment",
              awardedMarks: displayedRawScore,
              totalMarks: maxRawScore,
              accentClass:
                "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
            },
          ]}
        />
      ) : null}

      {!isReadOnly ? (
        <div className="no-print flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="!w-auto px-5"
            isLoading={saveMutation.isPending}
            onClick={() => handleSave(false)}
          >
            Save Draft
          </Button>
          <Button
            type="button"
            className="!w-auto px-5"
            isLoading={saveMutation.isPending}
            onClick={() => handleSave(true)}
          >
            Submit Form
          </Button>
        </div>
      ) : (
        <p className="no-print text-xs text-emerald-700 dark:text-emerald-300">
          {isPreview
            ? "Preview mode — submissions are disabled."
            : data && !data.selfAssessmentEnabled
              ? "Self-assessment is not enabled for this form. It will be reviewed directly by your reporting head."
              : data?.status === "SUBMITTED"
                ? `Submitted${data.submittedAt ? ` on ${new Date(data.submittedAt).toLocaleString()}` : ""} · read-only · score ${data.rawScore}/${data.maxRawScore}`
                : "Read-only"}
        </p>
      )}

      <PrintFooter />

      <AnimatePresence>
        {submitConfirmOpen ? (
          <motion.div
            key="employee-form-submit-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-form-submit-confirm-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-100 flex items-center justify-center p-4"
          >
            <motion.button
              type="button"
              aria-label="Close submit confirmation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSubmitConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    <AlertTriangle className="size-6" />
                  </span>
                  <div>
                    <h2
                      id="employee-form-submit-confirm-title"
                      className="text-lg font-semibold text-slate-900 dark:text-white"
                    >
                      Submit Assessment?
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Once submitted, you will not be able to edit your answers.
                      Please review your scores and remarks before confirming.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSubmitConfirmOpen(false)}
                  aria-label="Close"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-white/15 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Current score
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {displayedRawScore}
                  <span className="text-base font-semibold text-slate-500 dark:text-slate-400">
                    {" "}
                    / {maxRawScore}
                  </span>
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="!w-auto px-5"
                  onClick={() => setSubmitConfirmOpen(false)}
                >
                  Go Back
                </Button>
                <Button
                  type="button"
                  className="!w-auto px-5"
                  isLoading={saveMutation.isPending}
                  onClick={confirmSubmit}
                >
                  Confirm Submit
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {thankYouOpen && submittedScore ? (
          <motion.div
            key="employee-form-thank-you"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-form-thank-you-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-100 flex items-center justify-center p-4"
          >
            <motion.button
              type="button"
              aria-label="Close thank you dialog"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeThankYouDialog}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 className="size-6" />
                  </span>
                  <div>
                    <h2
                      id="employee-form-thank-you-title"
                      className="text-lg font-semibold text-slate-900 dark:text-white"
                    >
                      Thank you
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Your form has been submitted successfully.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeThankYouDialog}
                  aria-label="Close"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-white/15 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Your score
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {submittedScore.rawScore}
                  <span className="text-base font-semibold text-slate-500 dark:text-slate-400">
                    {" "}
                    / {submittedScore.maxRawScore}
                  </span>
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  type="button"
                  className="!w-auto px-5"
                  onClick={closeThankYouDialog}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
