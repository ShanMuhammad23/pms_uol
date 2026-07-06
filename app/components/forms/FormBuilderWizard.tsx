"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/app/components/auth/Button";
import CategoryAssignmentStep from "./steps/CategoryAssignmentStep";
import {
  createFormTemplate,
  FormTemplateRequestError,
  updateFormTemplate,
} from "@/lib/queries/forms-client";
import type {
  AppraisalCycleRecord,
  EmployeeCategory,
  FormSectionInput,
  FormTemplateInput,
  FormTemplateRecord,
  QuestionInput,
  SubCategory,
} from "@/types/forms";
import {
  CATEGORY_SUB_MAP,
  countAllQuestions,
  createClientId,
  createEmptyQuestion,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  applyQuestionInputTypeChange,
  buildRootLayoutOrder,
  createEmptySection,
  getNextRootSortOrder,
  mapQuestionRecordToInput,
  normalizeRootFormStructure,
  pickDefaultAppraisalCycleId,
  questionNeedsOptions,
} from "@/types/forms";
import { cn } from "@/lib/utils";
import {
  LayoutTemplate,
  Users,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  GripVertical,
  Plus,
  Trash2,
  ChevronDown,
  Settings2,
  Eye,
  Save,
  ArrowLeft,
  FileText,
  Layers,
  HelpCircle,
  X
} from "lucide-react";

const STEPS = [
  { id: "design" as const, label: "Design", icon: LayoutTemplate, description: "Build your form structure" },
  { id: "category" as const, label: "Assign", icon: Users, description: "Set target audience" },
] as const;

interface FormBuilderWizardProps {
  templateId?: number;
  initialData?: FormTemplateRecord;
  appraisalCycles?: AppraisalCycleRecord[];
  appraisalCount?: number;
}

function mapRecordToState(record: FormTemplateRecord) {
  const mappedSections = record.sections.map((section) => ({
    clientId: createClientId(),
    id: section.id,
    title: section.title,
    sortOrder: section.sortOrder,
    questions: section.questions.map(mapQuestionRecordToInput),
    subsections: section.subsections.map((subsection) => ({
      clientId: createClientId(),
      id: subsection.id,
      title: subsection.title,
      sortOrder: subsection.sortOrder,
      questions: subsection.questions.map(mapQuestionRecordToInput),
    })),
  }));
  const mappedQuestions = record.questions.map(mapQuestionRecordToInput);
  const normalized = normalizeRootFormStructure(mappedSections, mappedQuestions);

  return {
    title: record.title,
    description: record.description ?? "",
    targetCategory: record.targetCategory,
    targetSubCategory: record.targetSubCategory,
    cycleId: record.cycleId,
    sections: normalized.sections,
    questions: normalized.questions,
  };
}

function validateQuestionFields(
  question: QuestionInput,
  errorPrefix: string,
  nextErrors: Record<string, string>,
) {
  if (!question.questionText.trim()) {
    nextErrors[errorPrefix] = "Question text is required.";
  }

  if (!FIELD_TYPES.includes(question.inputType)) {
    nextErrors[`${errorPrefix}-type`] = "Select a valid question type.";
  }

  if (question.noMarks) {
    if (Number(question.totalMarks) !== 0) {
      nextErrors[`${errorPrefix}-marks`] =
        "Total marks must be 0 when No Marks is enabled.";
    }
  } else if (
    question.totalMarks === undefined ||
    question.totalMarks === null ||
    Number.isNaN(Number(question.totalMarks)) ||
    Number(question.totalMarks) <= 0
  ) {
    nextErrors[`${errorPrefix}-marks`] =
      "Total marks is required and must be greater than 0.";
  }

  if (["RADIO", "SELECT"].includes(question.inputType)) {
    if (question.options.length < 2) {
      nextErrors[errorPrefix] =
        "Radio and dropdown questions need at least two options.";
    }
  }

  if (question.inputType === "CHECKBOX" && question.options.length < 1) {
    nextErrors[errorPrefix] =
      "Checkbox questions need at least one option.";
  }

  question.options.forEach((option, optionIndex) => {
    if (!option.optionLabel.trim()) {
      nextErrors[errorPrefix] = `Option ${optionIndex + 1} label is required.`;
    }
  });
}

// --- Modern Form Design Step Components ---

interface ModernFormDesignStepProps {
  title: string;
  description: string;
  sections: FormSectionInput[];
  questions: QuestionInput[];
  errors: Record<string, string>;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onStructureChange: (sections: FormSectionInput[], questions: QuestionInput[]) => void;
}

function ModernFormDesignStep({
  title,
  description,
  sections,
  questions,
  errors,
  onTitleChange,
  onDescriptionChange,
  onStructureChange,
}: ModernFormDesignStepProps) {
  const [activePanel, setActivePanel] = useState<"builder" | "preview">("builder");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-expand sections that have errors
  useEffect(() => {
    const sectionsWithErrors = new Set<string>();
    sections.forEach((section, sIdx) => {
      const hasError = Object.keys(errors).some(k => k.startsWith(`section-${sIdx}`));
      if (hasError) sectionsWithErrors.add(section.clientId);
    });
    if (sectionsWithErrors.size > 0) {
      setExpandedSections(prev => new Set([...prev, ...sectionsWithErrors]));
    }
  }, [errors, sections]);

  const toggleSection = (clientId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const commitStructure = useCallback(
    (nextSections: FormSectionInput[], nextQuestions: QuestionInput[]) => {
      const normalized = normalizeRootFormStructure(nextSections, nextQuestions);
      onStructureChange(normalized.sections, normalized.questions);
    },
    [onStructureChange],
  );

  const addSection = useCallback(() => {
    const newSection = createEmptySection(getNextRootSortOrder(sections, questions));
    commitStructure([...sections, newSection], questions);
    setExpandedSections(prev => new Set([...prev, newSection.clientId]));
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, [sections, questions, commitStructure]);

  const addStandaloneQuestion = useCallback(() => {
    const newQuestion = createEmptyQuestion(getNextRootSortOrder(sections, questions));
    commitStructure(sections, [...questions, newQuestion]);
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, [sections, questions, commitStructure]);

  const updateSection = (clientId: string, updates: Partial<FormSectionInput>) => {
    commitStructure(
      sections.map(s => s.clientId === clientId ? { ...s, ...updates } : s),
      questions,
    );
  };

  const removeSection = (clientId: string) => {
    commitStructure(sections.filter(s => s.clientId !== clientId), questions);
  };

  const addQuestionToSection = (sectionClientId: string) => {
    commitStructure(
      sections.map(s => {
        if (s.clientId === sectionClientId) {
          return {
            ...s,
            questions: [
              ...s.questions,
              createEmptyQuestion(s.questions.length),
            ],
          };
        }
        return s;
      }),
      questions,
    );
  };

  const addSubsection = (sectionClientId: string) => {
    commitStructure(
      sections.map(s => {
        if (s.clientId === sectionClientId) {
          return {
            ...s,
            subsections: [
              ...s.subsections,
              {
                clientId: createClientId(),
                title: "",
                sortOrder: s.subsections.length,
                questions: [],
              }
            ]
          };
        }
        return s;
      }),
      questions,
    );
  };

  const removeQuestion = (sectionClientId: string | null, questionClientId: string) => {
    if (sectionClientId) {
      commitStructure(
        sections.map(s => {
          if (s.clientId === sectionClientId) {
            return {
              ...s,
              questions: s.questions
                .filter(q => q.clientId !== questionClientId)
                .map((question, sortOrder) => ({ ...question, sortOrder })),
            };
          }
          return s;
        }),
        questions,
      );
    } else {
      commitStructure(
        sections,
        questions.filter(q => q.clientId !== questionClientId),
      );
    }
  };

  const totalQuestions = countAllQuestions(sections, questions);
  const hasErrors = Object.keys(errors).length > 0;
  const rootLayout = useMemo(
    () => buildRootLayoutOrder(sections, questions),
    [sections, questions],
  );

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {/* Left Sidebar - Sticky Tools */}
      <div className="flex w-72 flex-col border-r border-slate-200 bg-slate-50/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Settings2 className="h-4 w-4" />
            Form Settings
          </h3>
        </div>
        
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* Title Field */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Form Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Enter form title..."
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 dark:bg-slate-900",
                errors.title
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-800"
                  : "border-slate-200 focus:border-primary focus:ring-primary/20 dark:border-slate-700"
              )}
            />
            {errors.title && (
              <p className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.title}
              </p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          {/* Stats Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total Questions</span>
              <span className="text-lg font-bold text-primary">{totalQuestions}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Sections</span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{sections.length}</span>
            </div>
          </div>

          {/* Quick Actions - Always Visible */}
          <div className="sticky top-0 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Quick Add
            </label>
            <button
              onClick={addSection}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary dark:hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" />
              Add Section
            </button>
            <button
              onClick={addStandaloneQuestion}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary dark:hover:bg-primary/10"
            >
              <HelpCircle className="h-4 w-4" />
              Add Standalone Question
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-4">
            <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                onClick={() => setActivePanel("builder")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  activePanel === "builder"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                Builder
              </button>
              <button
                onClick={() => setActivePanel("preview")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  activePanel === "preview"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
            </div>
            {hasErrors && (
              <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5" />
                {Object.keys(errors).length} validation issues
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6"
        >
          {activePanel === "builder" ? (
            <div className="mx-auto max-w-3xl space-y-4">
              {/* Empty State */}
              {sections.length === 0 && questions.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
                  <div className="mb-4 rounded-full bg-slate-100 p-4 dark:bg-slate-800">
                    <FileText className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Start building your form
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                    Add sections to group related questions together, or add standalone questions directly.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <Button fullWidth={false} onClick={addSection} className="px-5">
                      <Plus className="h-4 w-4" />
                      Add Section
                    </Button>
                    <Button
                      fullWidth={false}
                      variant="outline"
                      onClick={addStandaloneQuestion}
                      className="px-5"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Add Question
                    </Button>
                  </div>
                </div>
              )}

              {rootLayout.length > 0 && (
                <div className="space-y-4">
                  {rootLayout.map((item) => {
                    if (item.kind === "section") {
                      const sectionIndex = sections.findIndex(
                        (section) => section.clientId === item.clientId,
                      );
                      const section = sections[sectionIndex];
                      if (!section) {
                        return null;
                      }

                      return (
                        <SectionCard
                          key={section.clientId}
                          section={section}
                          index={sectionIndex}
                          isExpanded={expandedSections.has(section.clientId)}
                          onToggle={() => toggleSection(section.clientId)}
                          errors={errors}
                          onUpdate={(updates) => updateSection(section.clientId, updates)}
                          onRemove={() => removeSection(section.clientId)}
                          onAddQuestion={() => addQuestionToSection(section.clientId)}
                          onAddSubsection={() => addSubsection(section.clientId)}
                          onRemoveQuestion={(qId) => removeQuestion(section.clientId, qId)}
                          onUpdateQuestion={(qId, updates) => {
                            commitStructure(
                              sections.map((currentSection) => {
                                if (currentSection.clientId === section.clientId) {
                                  return {
                                    ...currentSection,
                                    questions: currentSection.questions.map((question) =>
                                      question.clientId === qId
                                        ? { ...question, ...updates }
                                        : question,
                                    ),
                                  };
                                }
                                return currentSection;
                              }),
                              questions,
                            );
                          }}
                        />
                      );
                    }

                    const questionIndex = questions.findIndex(
                      (question) => question.clientId === item.clientId,
                    );
                    const question = questions[questionIndex];
                    if (!question) {
                      return null;
                    }

                    return (
                      <QuestionCard
                        key={question.clientId}
                        question={question}
                        index={questionIndex}
                        errorPrefix={`question-${questionIndex}`}
                        errors={errors}
                        onRemove={() => removeQuestion(null, question.clientId)}
                        onChange={(updates) => {
                          commitStructure(
                            sections,
                            questions.map((currentQuestion) =>
                              currentQuestion.clientId === question.clientId
                                ? { ...currentQuestion, ...updates }
                                : currentQuestion,
                            ),
                          );
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-2xl">
              {/* Simple Preview */}
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {title || "Untitled Form"}
                </h1>
                {description && (
                  <p className="mt-2 text-slate-600 dark:text-slate-400">{description}</p>
                )}
                <div className="mt-8 space-y-6">
                  {rootLayout.map((item) => {
                    if (item.kind === "section") {
                      const section = sections.find(
                        (currentSection) => currentSection.clientId === item.clientId,
                      );
                      if (!section) {
                        return null;
                      }

                      return (
                        <div key={section.clientId} className="space-y-4">
                          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                            {section.title || "Untitled Section"}
                          </h2>
                          {section.questions.map((question) => (
                            <div key={question.clientId} className="rounded-lg border border-slate-100 p-4 dark:border-slate-800">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {question.questionText || "Untitled Question"}
                              </p>
                              <div className="mt-2 h-8 rounded border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800" />
                            </div>
                          ))}
                        </div>
                      );
                    }

                    const question = questions.find(
                      (currentQuestion) => currentQuestion.clientId === item.clientId,
                    );
                    if (!question) {
                      return null;
                    }

                    return (
                      <div key={question.clientId} className="rounded-lg border border-slate-100 p-4 dark:border-slate-800">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {question.questionText || "Untitled Question"}
                        </p>
                        <div className="mt-2 h-8 rounded border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Sticky Bar */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white/90 px-6 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {totalQuestions} question{totalQuestions !== 1 ? "s" : ""} total
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addSection}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Section
            </button>
            <button
              type="button"
              onClick={addStandaloneQuestion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components for cleaner architecture ---

function SectionCard({
  section,
  index,
  isExpanded,
  onToggle,
  errors,
  onUpdate,
  onRemove,
  onAddQuestion,
  onAddSubsection,
  onRemoveQuestion,
  onUpdateQuestion,
}: {
  section: FormSectionInput;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<FormSectionInput>) => void;
  onRemove: () => void;
  onAddQuestion: () => void;
  onAddSubsection: () => void;
  onRemoveQuestion: (qId: string) => void;
  onUpdateQuestion: (qId: string, updates: Partial<QuestionInput>) => void;
}) {
  const hasTitleError = errors[`section-${index}-title`];
  const hasAnyError = Object.keys(errors).some(k => k.startsWith(`section-${index}`));

  return (
    <div className={cn(
      "group rounded-xl border bg-white transition-all dark:bg-slate-900",
      hasAnyError 
        ? "border-red-200 shadow-sm shadow-red-100 dark:border-red-900/50 dark:shadow-red-900/10"
        : "border-slate-200 shadow-sm hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
    )}>
      {/* Section Header */}
      <div 
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors",
          hasAnyError
            ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            : "bg-primary/10 text-primary dark:bg-primary/20"
        )}>
          {index + 1}
        </div>
        
        <div className="flex-1 min-w-0">
          {isExpanded ? (
            <input
              type="text"
              value={section.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Section Title"
              className={cn(
                "w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400",
                hasTitleError ? "text-red-600 placeholder:text-red-300" : "text-slate-900 dark:text-slate-100"
              )}
            />
          ) : (
            <h4 className={cn(
              "truncate text-sm font-semibold",
              hasTitleError ? "text-red-600" : "text-slate-900 dark:text-slate-100"
            )}>
              {section.title || `Section ${index + 1}`}
            </h4>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {section.questions.length} question{section.questions.length !== 1 ? "s" : ""}
            {section.subsections.length > 0 && ` · ${section.subsections.length} subsection${section.subsections.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onAddQuestion(); }}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800"
            title="Add question"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            title="Delete section"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <ChevronDown className={cn(
            "h-4 w-4 text-slate-400 transition-transform",
            isExpanded && "rotate-180"
          )} />
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          {hasTitleError && (
            <p className="mb-3 flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" /> {hasTitleError}
            </p>
          )}

          {/* Section Questions */}
          <div className="space-y-3">
            {section.questions.map((question, qIdx) => (
              <QuestionCard
                key={question.clientId}
                question={question}
                index={qIdx}
                errorPrefix={`section-${index}-question-${qIdx}`}
                errors={errors}
                onRemove={() => onRemoveQuestion(question.clientId)}
                onChange={(updates) => onUpdateQuestion(question.clientId, updates)}
                compact
              />
            ))}
            
            {section.questions.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center dark:border-slate-800">
                <p className="text-xs text-slate-400 dark:text-slate-500">No questions yet</p>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={onAddQuestion}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-slate-700 dark:text-slate-400 dark:hover:border-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Question
            </button>
            <button
              onClick={onAddSubsection}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-slate-700 dark:text-slate-400 dark:hover:border-primary"
            >
              <Layers className="h-3.5 w-3.5" />
              Add Subsection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  index,
  errorPrefix,
  errors,
  onRemove,
  onChange,
  compact = false,
}: {
  question: QuestionInput;
  index: number;
  errorPrefix: string;
  errors: Record<string, string>;
  onRemove: () => void;
  onChange: (updates: Partial<QuestionInput>) => void;
  compact?: boolean;
}) {
  const textError = errors[errorPrefix];
  const typeError = errors[`${errorPrefix}-type`];
  const marksError = errors[`${errorPrefix}-marks`];
  const hasError = textError || typeError || marksError;
  const showOptions = questionNeedsOptions(question.inputType);

  const handleNoMarksChange = (checked: boolean) => {
    onChange({
      noMarks: checked,
      totalMarks: checked ? 0 : question.totalMarks,
    });
  };

  return (
    <div className={cn(
      "group relative rounded-lg border bg-slate-50/50 p-3 transition-all dark:bg-slate-800/50",
      hasError
        ? "border-red-200 dark:border-red-800"
        : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
    )}>
      <div className="flex items-start gap-2">
        <div className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-200 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-400">
          {index + 1}
        </div>
        
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={question.questionText}
              onChange={(e) => onChange({ questionText: e.target.value })}
              placeholder="Enter question text..."
              className={cn(
                "flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400",
                textError ? "text-red-600 placeholder:text-red-300" : "text-slate-900 dark:text-slate-100"
              )}
            />
            {!question.noMarks && (
              <input
                type="number"
                min={1}
                value={question.totalMarks || ""}
                onChange={(e) => onChange({ totalMarks: Number(e.target.value) })}
                placeholder="Marks"
                className={cn(
                  "w-20 rounded border bg-white px-2 py-1 text-right text-xs outline-none dark:bg-slate-900",
                  marksError
                    ? "border-red-300 text-red-600 dark:border-red-800"
                    : "border-slate-200 dark:border-slate-700"
                )}
              />
            )}
          </div>

          <div className={cn(
            "grid gap-2",
            compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          )}>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Question Type
              </label>
              <select
                value={question.inputType}
                onChange={(e) =>
                  onChange(applyQuestionInputTypeChange(question, e.target.value as QuestionInput["inputType"]))
                }
                className={cn(
                  "h-8 w-full rounded border bg-white px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:bg-slate-900",
                  typeError
                    ? "border-red-300 dark:border-red-800"
                    : "border-slate-200 dark:border-slate-700"
                )}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {FIELD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={question.isRequired}
                  onChange={(e) => onChange({ isRequired: e.target.checked })}
                  className="size-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                />
                Required
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={question.selfAssessmentEnabled}
                  onChange={(e) => onChange({ selfAssessmentEnabled: e.target.checked })}
                  className="size-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                />
                Self Assessment
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={question.hodAssessmentEnabled}
                  onChange={(e) => onChange({ hodAssessmentEnabled: e.target.checked })}
                  className="size-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                />
                HOD Assessment
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={question.noMarks}
                  onChange={(e) => handleNoMarksChange(e.target.checked)}
                  className="size-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                />
                No Marks
              </label>
            </div>
          </div>
          
          {textError && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" /> {textError}
            </p>
          )}
          {typeError && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" /> {typeError}
            </p>
          )}
          {marksError && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" /> {marksError}
            </p>
          )}

          {showOptions && (
            <div className="space-y-1.5 pt-1">
              {question.options.map((option, oIdx) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <div className={cn(
                    "h-3.5 w-3.5 border",
                    question.inputType === "CHECKBOX" ? "rounded-sm" : "rounded-full",
                    "border-slate-300 dark:border-slate-600"
                  )} />
                  <input
                    type="text"
                    value={option.optionLabel}
                    onChange={(e) => {
                      const newOptions = [...question.options];
                      newOptions[oIdx] = { ...option, optionLabel: e.target.value };
                      onChange({ options: newOptions });
                    }}
                    placeholder={`Option ${oIdx + 1}`}
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 dark:text-slate-300"
                  />
                  <input
                    type="number"
                    min={0}
                    value={option.pointsAssigned}
                    onChange={(e) => {
                      const newOptions = [...question.options];
                      newOptions[oIdx] = {
                        ...option,
                        pointsAssigned: Number(e.target.value || 0),
                      };
                      onChange({ options: newOptions });
                    }}
                    placeholder="Pts"
                    className="w-14 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right text-xs outline-none dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newOptions = question.options.filter((_, i) => i !== oIdx);
                      onChange({ options: newOptions });
                    }}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onChange({ options: [...question.options, { optionLabel: "", pointsAssigned: 0, sortOrder: question.options.length }] })}
                className="text-xs text-primary hover:underline"
              >
                + Add option
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="mt-1 opacity-0 transition-opacity group-hover:opacity-100 text-slate-400 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// --- Main Wizard Component ---

export default function FormBuilderWizard({
  templateId,
  initialData,
  appraisalCycles = [],
  appraisalCount = 0,
}: FormBuilderWizardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const initialState = initialData ? mapRecordToState(initialData) : null;

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(initialState?.title ?? "");
  const [description, setDescription] = useState(initialState?.description ?? "");
  const [sections, setSections] = useState<FormSectionInput[]>(
    initialState?.sections ?? [],
  );
  const [questions, setQuestions] = useState<QuestionInput[]>(
    initialState?.questions ?? [],
  );
  const [cycleId, setCycleId] = useState<number | "">(
    initialState?.cycleId ?? pickDefaultAppraisalCycleId(appraisalCycles),
  );
  const [targetCategory, setTargetCategory] = useState<EmployeeCategory | "">(
    initialState?.targetCategory ?? "",
  );
  const [targetSubCategory, setTargetSubCategory] = useState<SubCategory | "">(
    initialState?.targetSubCategory ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateFormId, setDuplicateFormId] = useState<number | null>(null);

  const payload = useMemo<FormTemplateInput | null>(() => {
    if (!targetCategory || !targetSubCategory) {
      return null;
    }

    const normalized = normalizeRootFormStructure(sections, questions);

    return {
      title: title.trim(),
      description: description.trim(),
      targetCategory,
      targetSubCategory,
      sections: normalized.sections,
      questions: normalized.questions,
      ...(cycleId ? { cycleId } : {}),
    };
  }, [
    title,
    description,
    targetCategory,
    targetSubCategory,
    sections,
    questions,
    cycleId,
  ]);

  const saveMutation = useMutation({
    mutationFn: async (input: FormTemplateInput) => {
      if (templateId) {
        return updateFormTemplate(templateId, input);
      }
      return createFormTemplate(input);
    },
    onSuccess: async (template: FormTemplateRecord) => {
      await queryClient.invalidateQueries({ queryKey: ["form-templates"] });
      const viewId = templateId ?? template.id;
      router.push(`/dashboard/forms/${viewId}/view`);
      router.refresh();
    },
    onError: (error: Error) => {
      if (error instanceof FormTemplateRequestError) {
        setSubmitError(error.message);
        setDuplicateFormId(error.existingFormId ?? null);
        return;
      }

      setSubmitError(error.message);
      setDuplicateFormId(null);
    },
  });

  const validateDesignStep = () => {
    const nextErrors: Record<string, string> = {};

    if (!title.trim()) {
      nextErrors.title = "Form title is required.";
    }

    if (countAllQuestions(sections, questions) === 0) {
      nextErrors.questions = "At least one question is required.";
    }

    sections.forEach((section, sectionIndex) => {
      if (!section.title.trim()) {
        nextErrors[`section-${sectionIndex}-title`] = "Section title is required.";
      }

      section.questions.forEach((question, questionIndex) => {
        validateQuestionFields(
          question,
          `section-${sectionIndex}-question-${questionIndex}`,
          nextErrors,
        );
      });

      section.subsections.forEach((subsection, subsectionIndex) => {
        if (!subsection.title.trim()) {
          nextErrors[`section-${sectionIndex}-sub-${subsectionIndex}-title`] =
            "Subsection title is required.";
        }

        subsection.questions.forEach((question, questionIndex) => {
          validateQuestionFields(
            question,
            `section-${sectionIndex}-sub-${subsectionIndex}-question-${questionIndex}`,
            nextErrors,
          );
        });
      });
    });

    questions.forEach((question, index) => {
      validateQuestionFields(question, `question-${index}`, nextErrors);
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateCategoryStep = () => {
    const nextErrors: Record<string, string> = {};

    if (
      appraisalCycles.length > 0 &&
      !cycleId
    ) {
      nextErrors.cycleId = "Appraisal cycle is required.";
    }

    if (!targetCategory) {
      nextErrors.targetCategory = "Employee category is required.";
    }

    if (!targetSubCategory) {
      nextErrors.targetSubCategory = "Sub-category is required.";
    }

    if (
      targetCategory &&
      targetSubCategory &&
      !CATEGORY_SUB_MAP[targetCategory].includes(targetSubCategory)
    ) {
      nextErrors.targetSubCategory =
        "Selected sub-category does not belong to the chosen category.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    setSubmitError(null);
    setDuplicateFormId(null);
    if (step === 0 && !validateDesignStep()) {
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setSubmitError(null);
    setDuplicateFormId(null);
    setErrors({});
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = () => {
    setSubmitError(null);
    setDuplicateFormId(null);
    if (!validateCategoryStep() || !payload) {
      return;
    }
    saveMutation.mutate(payload);
  };

  const handleCategoryChange = (category: EmployeeCategory) => {
    setTargetCategory(category);
    setTargetSubCategory("");
  };

  const handleStructureChange = (
    nextSections: FormSectionInput[],
    nextQuestions: QuestionInput[],
  ) => {
    setSections(nextSections);
    setQuestions(nextQuestions);
  };

  const currentStepData = STEPS[step];
  const StepIcon = currentStepData.icon;

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Navigation Bar */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-w-0 items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/forms")}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
              {templateId ? "Edit Form" : "Create Form"}
            </h1>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {currentStepData.description}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="hidden items-center gap-2 md:flex">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === step;
            const isCompleted = idx < step;
            
            return (
              <div key={s.id} className="flex items-center">
                <div className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 transition-all",
                  isActive 
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                    : isCompleted
                      ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                      : "text-slate-400"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="mx-2 h-4 w-4 text-slate-300 dark:text-slate-700" />
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              fullWidth={false}
              onClick={goBack}
              disabled={saveMutation.isPending}
              className="h-9 px-4"
            >
              Back
            </Button>
          )}
          
          {step < STEPS.length - 1 ? (
            <Button type="button" fullWidth={false} onClick={goNext} className="h-9 px-4">
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              fullWidth={false}
              isLoading={saveMutation.isPending}
              onClick={handleSubmit}
              className="h-9 px-4"
            >
              <Save className="h-4 w-4" />
              {templateId ? "Update Form" : "Publish Form"}
            </Button>
          )}
        </div>
      </div>

      {templateId && appraisalCount > 0 ? (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This form has active appraisals — removing questions is restricted.
            You can still edit question text, options, and add new questions.
          </p>
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        {step === 0 ? (
          <ModernFormDesignStep
            title={title}
            description={description}
            sections={sections}
            questions={questions}
            errors={errors}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onStructureChange={handleStructureChange}
          />
        ) : (
          <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="w-full max-w-2xl">
              <CategoryAssignmentStep
                appraisalCycles={appraisalCycles}
                cycleId={cycleId}
                targetCategory={targetCategory}
                targetSubCategory={targetSubCategory}
                errors={errors}
                onCycleChange={setCycleId}
                onCategoryChange={handleCategoryChange}
                onSubCategoryChange={setTargetSubCategory}
              />
            </div>
          </div>
        )}
      </div>

      {/* Global Error Toast */}
      {submitError && (
        <div className="absolute bottom-6 right-6 z-50 max-w-sm rounded-xl border border-red-200 bg-white px-4 py-3 shadow-lg dark:border-red-900 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
              {duplicateFormId ? (
                <Link
                  href={`/dashboard/forms/${duplicateFormId}`}
                  className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Edit existing form
                </Link>
              ) : null}
            </div>
            <button
              onClick={() => {
                setSubmitError(null);
                setDuplicateFormId(null);
              }}
              className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X className="h-4 w-4 text-red-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}