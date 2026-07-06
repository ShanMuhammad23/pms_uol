"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import type { FormTemplateRecord, QuestionRecord } from "@/types/forms";
import {
  CATEGORY_LABELS,
  FIELD_TYPE_LABELS,
  buildRootLayoutOrderFromRecord,
  flattenAllQuestions,
  SUB_CATEGORY_LABELS,
} from "@/types/forms";

interface FormTemplateViewProps {
  template: FormTemplateRecord;
}

function QuestionCard({
  question,
  label,
}: {
  question: QuestionRecord;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-primary">{label}</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {FIELD_TYPE_LABELS[question.inputType]}
        </span>
        {question.isRequired ? (
          <span className="text-[11px] text-foreground/60">Required</span>
        ) : null}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
          {question.totalMarks} marks
        </span>
        {question.selfAssessmentEnabled ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
            Self Assessment
          </span>
        ) : null}
        {question.hodAssessmentEnabled ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            HOD Assessment
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-medium text-text-primary">
        {question.questionText}
      </p>
      {question.options.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {question.options.map((option) => (
            <li
              key={option.id}
              className="flex items-center justify-between rounded-lg border border-slate-300/60 px-3 py-2 text-xs dark:border-white/10"
            >
              <span className="text-text-primary">{option.optionLabel}</span>
              <span className="text-foreground/70">
                {option.pointsAssigned} pts
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function FormTemplateView({ template }: FormTemplateViewProps) {
  const allQuestions = flattenAllQuestions(template);
  const rootLayout = buildRootLayoutOrderFromRecord(
    template.sections,
    template.questions,
  );
  let questionCounter = 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            {template.title}
          </h2>
          {template.description ? (
            <p className="mt-1 text-sm text-foreground/70">
              {template.description}
            </p>
          ) : null}
        </div>

        <Link
          href={`/dashboard/forms/${template.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
        >
          <Pencil className="size-3.5" />
          Edit Form
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
          <p className="text-xs font-medium text-foreground/70">Category</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {CATEGORY_LABELS[template.targetCategory]}
          </p>
          <p className="text-xs text-foreground/70">
            {SUB_CATEGORY_LABELS[template.targetSubCategory]}
          </p>
        </div>
        <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
          <p className="text-xs font-medium text-foreground/70">Appraisal Cycle</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            FY {template.fiscalYear}
          </p>
        </div>
        <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
          <p className="text-xs font-medium text-foreground/70">Questions</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {allQuestions.length}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-sm font-semibold text-text-primary">Form Structure</h3>

        {rootLayout.map((item) => {
          if (item.kind === "section") {
            const section = template.sections.find(
              (currentSection) => currentSection.id === item.id,
            );
            if (!section) {
              return null;
            }

            return (
              <div key={section.id} className="space-y-4">
                <h4 className="text-base font-semibold text-text-primary">
                  {section.title}
                </h4>

                {section.subsections.map((subsection) => (
                  <div key={subsection.id} className="space-y-3 pl-4">
                    <h5 className="text-sm font-medium text-foreground/80">
                      {subsection.title}
                    </h5>
                    {subsection.questions.map((question) => {
                      questionCounter += 1;
                      return (
                        <QuestionCard
                          key={question.id}
                          question={question}
                          label={`Q${questionCounter}`}
                        />
                      );
                    })}
                  </div>
                ))}

                {section.questions.map((question) => {
                  questionCounter += 1;
                  return (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      label={`Q${questionCounter}`}
                    />
                  );
                })}
              </div>
            );
          }

          const question = template.questions.find(
            (currentQuestion) => currentQuestion.id === item.id,
          );
          if (!question) {
            return null;
          }

          questionCounter += 1;
          return (
            <QuestionCard
              key={question.id}
              question={question}
              label={`Q${questionCounter}`}
            />
          );
        })}

        {allQuestions.length === 0 ? (
          <p className="text-sm text-foreground/70">No questions defined.</p>
        ) : null}
      </div>
    </div>
  );
}
