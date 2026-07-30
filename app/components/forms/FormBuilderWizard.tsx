"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/app/components/auth/Button";
import FormEmployeeAssignment from "./FormEmployeeAssignment";
import FormTemplateView from "./FormTemplateView";
import {
  createFormTemplate,
  FormTemplateRequestError,
  updateFormTemplate,
} from "@/lib/queries/forms-client";
import type {
  AppraisalCycleRecord,
  FormSectionInput,
  FormSectionRecord,
  FormSubsectionRecord,
  FormTemplateInput,
  FormTemplateRecord,
  QuestionInput,
  QuestionOptionRecord,
  QuestionRecord,
} from "@/types/forms";
import {
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
  ArrowLeft,
  FileText,
  Layers,
  HelpCircle,
  X
} from "lucide-react";

interface QuestionLocation {
  sectionClientId: string | null;
  subsectionClientId: string | null;
  insertIndex?: number;
}

function draftToTemplateRecord(
  title: string,
  description: string,
  selfAssessmentEnabled: boolean,
  sections: FormSectionInput[],
  questions: QuestionInput[],
): FormTemplateRecord {
  let idCounter = 1;
  const nextId = () => idCounter++;

  const mapQuestion = (q: QuestionInput): QuestionRecord => ({
    id: q.id ?? nextId(),
    questionText: q.questionText,
    inputType: q.inputType,
    isRequired: q.isRequired,
    sortOrder: q.sortOrder,
    selfAssessmentEnabled: q.selfAssessmentEnabled,
    hodAssessmentEnabled: q.hodAssessmentEnabled,
    totalMarks: q.totalMarks,
    options: q.options.map((o): QuestionOptionRecord => ({
      id: o.id ?? nextId(),
      optionLabel: o.optionLabel,
      pointsAssigned: o.pointsAssigned,
      sortOrder: o.sortOrder,
    })),
  });

  const recordSections: FormSectionRecord[] = sections.map((s) => ({
    id: s.id ?? nextId(),
    title: s.title,
    sortOrder: s.sortOrder,
    subsections: s.subsections.map((sub): FormSubsectionRecord => ({
      id: sub.id ?? nextId(),
      title: sub.title,
      sortOrder: sub.sortOrder,
      questions: sub.questions.map(mapQuestion),
    })),
    questions: s.questions.map(mapQuestion),
  }));

  const recordQuestions: QuestionRecord[] = questions.map(mapQuestion);

  return {
    id: 0,
    title,
    description: description || null,
    cycleId: 0,
    fiscalYear: 0,
    targetCategory: null,
    targetSubCategory: null,
    selfAssessmentEnabled,
    sections: recordSections,
    questions: recordQuestions,
    incrementMatrices: [],
    createdAt: "",
    updatedAt: "",
  };
}

const STEPS = [
  { id: "design" as const, label: "Design", icon: LayoutTemplate, description: "Build your form structure" },
  { id: "assign" as const, label: "Assign", icon: Users, description: "Assign form to employees" },
] as const;

interface FormBuilderWizardProps {
  templateId?: number;
  initialData?: FormTemplateRecord;
  appraisalCycles?: AppraisalCycleRecord[];
  appraisalCount?: number;
  copyMode?: boolean;
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
    cycleId: record.cycleId,
    selfAssessmentEnabled: record.selfAssessmentEnabled,
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
  selfAssessmentEnabled: boolean;
  sections: FormSectionInput[];
  questions: QuestionInput[];
  errors: Record<string, string>;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onSelfAssessmentEnabledChange: (enabled: boolean) => void;
  onStructureChange: (sections: FormSectionInput[], questions: QuestionInput[]) => void;
}

function ModernFormDesignStep({
  title,
  description,
  selfAssessmentEnabled,
  sections,
  questions,
  errors,
  onTitleChange,
  onDescriptionChange,
  onSelfAssessmentEnabledChange,
  onStructureChange,
}: ModernFormDesignStepProps) {
  const [activePanel, setActivePanel] = useState<"builder" | "preview">("builder");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);
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

  useEffect(() => {
    const handleDragStart = () => setDraggingId("active");
    const handleDragEnd = () => {
      setDraggingId(null);
      setDragOverTarget(null);
    };
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("dragend", handleDragEnd);
    return () => {
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("dragend", handleDragEnd);
    };
  }, []);

  useEffect(() => {
    if (!draggingId || !scrollContainerRef.current) return;
    let animationId: number;
    let lastClientY = 0;
    const handleDragOver = (e: DragEvent) => { lastClientY = e.clientY; };
    const autoScroll = () => {
      if (!scrollContainerRef.current) return;
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const scrollZone = 80;
      if (lastClientY > 0 && lastClientY < rect.top + scrollZone) {
        const speed = (rect.top + scrollZone - lastClientY) / scrollZone;
        scrollContainerRef.current.scrollTop -= Math.max(1, speed * 8);
      } else if (lastClientY > rect.bottom - scrollZone && lastClientY < rect.bottom) {
        const speed = (lastClientY - (rect.bottom - scrollZone)) / scrollZone;
        scrollContainerRef.current.scrollTop += Math.max(1, speed * 8);
      }
      animationId = requestAnimationFrame(autoScroll);
    };
    animationId = requestAnimationFrame(autoScroll);
    window.addEventListener("dragover", handleDragOver);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("dragover", handleDragOver);
    };
  }, [draggingId]);

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

  const moveQuestion = useCallback(
    (questionClientId: string, source: QuestionLocation, target: QuestionLocation) => {
      let movedQuestion: QuestionInput | null = null;
      let sourceIdx = -1;
      let nextSections = [...sections];
      let nextQuestions = [...questions];

      // Step 1: Extract question from source and record original index
      if (source.sectionClientId === null) {
        sourceIdx = nextQuestions.findIndex(q => q.clientId === questionClientId);
        if (sourceIdx >= 0) {
          movedQuestion = nextQuestions[sourceIdx];
          nextQuestions = nextQuestions.filter(q => q.clientId !== questionClientId);
        }
      } else {
        nextSections = nextSections.map(s => {
          if (s.clientId !== source.sectionClientId) return s;
          if (source.subsectionClientId === null) {
            sourceIdx = s.questions.findIndex(q => q.clientId === questionClientId);
            if (sourceIdx >= 0) {
              movedQuestion = s.questions[sourceIdx];
              return {
                ...s,
                questions: s.questions
                  .filter(q => q.clientId !== questionClientId)
                  .map((q, i) => ({ ...q, sortOrder: i })),
              };
            }
          } else {
            return {
              ...s,
              subsections: s.subsections.map(sub => {
                if (sub.clientId !== source.subsectionClientId) return sub;
                sourceIdx = sub.questions.findIndex(q => q.clientId === questionClientId);
                if (sourceIdx >= 0) {
                  movedQuestion = sub.questions[sourceIdx];
                  return {
                    ...sub,
                    questions: sub.questions
                      .filter(q => q.clientId !== questionClientId)
                      .map((q, i) => ({ ...q, sortOrder: i })),
                  };
                }
                return sub;
              }),
            };
          }
          return s;
        });
      }

      if (!movedQuestion) return;
      const moved = movedQuestion;

      // Step 2: Compute insert index (default to end if not specified)
      const isSameList =
        source.sectionClientId === target.sectionClientId &&
        source.subsectionClientId === target.subsectionClientId;

      let insertIdx = target.insertIndex;
      if (insertIdx === undefined) {
        if (target.sectionClientId === null) {
          insertIdx = nextQuestions.length;
        } else {
          const targetSection = nextSections.find(s => s.clientId === target.sectionClientId);
          if (target.subsectionClientId === null) {
            insertIdx = targetSection?.questions.length ?? 0;
          } else {
            const targetSub = targetSection?.subsections.find(sub => sub.clientId === target.subsectionClientId);
            insertIdx = targetSub?.questions.length ?? 0;
          }
        }
      } else if (isSameList && sourceIdx >= 0 && sourceIdx < insertIdx) {
        insertIdx = insertIdx - 1;
      }

      // Step 3: Insert at target position
      if (target.sectionClientId === null) {
        const newQuestions = [...nextQuestions];
        newQuestions.splice(insertIdx, 0, { ...moved, sortOrder: insertIdx });
        nextQuestions = newQuestions.map((q, i) => ({ ...q, sortOrder: i }));
      } else {
        nextSections = nextSections.map(s => {
          if (s.clientId !== target.sectionClientId) return s;
          if (target.subsectionClientId === null) {
            const newQs = [...s.questions];
            newQs.splice(insertIdx, 0, { ...moved, sortOrder: insertIdx });
            return {
              ...s,
              questions: newQs.map((q, i) => ({ ...q, sortOrder: i })),
            };
          }
          return {
            ...s,
            subsections: s.subsections.map(sub => {
              if (sub.clientId !== target.subsectionClientId) return sub;
              const newQs = [...sub.questions];
              newQs.splice(insertIdx, 0, { ...moved, sortOrder: insertIdx });
              return {
                ...sub,
                questions: newQs.map((q, i) => ({ ...q, sortOrder: i })),
              };
            }),
          };
        });
      }

      commitStructure(nextSections, nextQuestions);
    },
    [sections, questions, commitStructure],
  );

  const totalQuestions = countAllQuestions(sections, questions);
  const hasErrors = Object.keys(errors).length > 0;
  const rootLayout = useMemo(
    () => buildRootLayoutOrder(sections, questions),
    [sections, questions],
  );
  const previewTemplate = useMemo(
    () => draftToTemplateRecord(title, description, selfAssessmentEnabled, sections, questions),
    [title, description, selfAssessmentEnabled, sections, questions],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {/* Top: Form Settings Panel */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50">
        <button
          type="button"
          onClick={() => setSettingsOpen((prev) => !prev)}
          aria-expanded={settingsOpen}
          aria-controls="form-settings-content"
          className="flex w-full items-center justify-between border-b border-slate-200 px-4 py-2.5 transition-colors hover:bg-slate-100/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Settings2 className="h-4 w-4" />
            Form Settings
            {!settingsOpen && title ? (
              <span className="ml-2 truncate text-xs font-normal text-slate-400 dark:text-slate-500">
                {title}
              </span>
            ) : null}
          </h3>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform duration-200",
              settingsOpen && "rotate-180",
            )}
          />
        </button>

        {settingsOpen ? (
        <>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Title Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Form Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Enter form title..."
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 dark:bg-slate-900",
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
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          {/* Assessment Settings info */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Assessment
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-snug text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Self-assessment is configured per employee during assignment.
            </div>
          </div>
        </div>

        {/* Stats + Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-4 rounded-md border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Questions: <span className="font-bold text-primary">{totalQuestions}</span>
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Sections: <span className="font-semibold text-slate-700 dark:text-slate-300">{sections.length}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addSection}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary dark:hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Section
            </button>
            <button
              onClick={addStandaloneQuestion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary dark:hover:bg-primary/10"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Add Question
            </button>
          </div>
        </div>
        </>
        ) : null}
      </div>

      {/* Main Content Area - Full Width */}
      <div className="flex min-h-0 flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
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
            <div className=" space-y-4">
              {/* Empty State */}
              {sections.length === 0 && questions.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
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
                          onRemoveQuestion={(qId) => removeQuestion(section.clientId, qId)}
                          onMoveQuestion={moveQuestion}
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
                          formSelfAssessmentEnabled={selfAssessmentEnabled}
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
                        sourceLocation={{ sectionClientId: null, subsectionClientId: null }}
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
                        onDropQuestion={(dragData, insertIndex) => {
                          moveQuestion(dragData.questionClientId, dragData.source, {
                            sectionClientId: null,
                            subsectionClientId: null,
                            insertIndex,
                          });
                        }}
                        formSelfAssessmentEnabled={selfAssessmentEnabled}
                      />
                    );
                  })}
                </div>
              )}

              {sections.length > 0 && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverTarget("root");
                  }}
                  onDragLeave={() => setDragOverTarget(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverTarget(null);
                    try {
                      const data = JSON.parse(e.dataTransfer.getData("application/json"));
                      moveQuestion(data.questionClientId, data.source, { sectionClientId: null, subsectionClientId: null, insertIndex: questions.length });
                    } catch { /* ignore */ }
                  }}
                  className={cn(
                    "rounded-md border-2 border-dashed py-4 text-center text-xs transition-all",
                    dragOverTarget === "root"
                      ? "border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300"
                      : "border-indigo-200 text-indigo-400 dark:border-indigo-600/30 dark:text-indigo-500"
                  )}
                >
                  Drop here to move question to root level
                </div>
              )}
            </div>
          ) : (
            <FormTemplateView template={previewTemplate} />
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
  onRemoveQuestion,
  onMoveQuestion,
  onUpdateQuestion,
  formSelfAssessmentEnabled = true,
}: {
  section: FormSectionInput;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<FormSectionInput>) => void;
  onRemove: () => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (qId: string) => void;
  onMoveQuestion: (questionClientId: string, source: QuestionLocation, target: QuestionLocation) => void;
  onUpdateQuestion: (qId: string, updates: Partial<QuestionInput>) => void;
  formSelfAssessmentEnabled?: boolean;
}) {
  const [sectionDragOver, setSectionDragOver] = useState(false);
  const hasTitleError = errors[`section-${index}-title`];
  const hasAnyError = Object.keys(errors).some(k => k.startsWith(`section-${index}`));

  return (
    <div className={cn(
      "group rounded-md border transition-all shadow-sm",
      hasAnyError
        ? "border-red-400 bg-red-50 shadow-red-200/40 dark:border-red-600/50 dark:bg-red-950/30 dark:shadow-red-900/20"
        : "border-indigo-200 bg-indigo-50/80 shadow-indigo-100/60 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/40 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:shadow-indigo-900/10 dark:hover:border-indigo-400/40"
    )}>
      {/* Section Header */}
      <div 
        className="flex items-center gap-3 p-4 cursor-pointer rounded-t-xl"
        onClick={onToggle}
      >
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors",
          hasAnyError
            ? "bg-red-200 text-red-700 dark:bg-red-800/40 dark:text-red-300"
            : "bg-indigo-200 text-indigo-700 dark:bg-indigo-800/50 dark:text-indigo-300"
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
                "w-full bg-transparent text-sm font-semibold outline-none",
                hasTitleError ? "text-red-700 placeholder:text-red-400 dark:text-red-400 dark:placeholder:text-red-500" : "text-indigo-900 placeholder:text-indigo-400 dark:text-indigo-100 dark:placeholder:text-indigo-400"
              )}
            />
          ) : (
            <h4 className={cn(
              "truncate text-sm font-semibold",
              hasTitleError ? "text-red-700 dark:text-red-400" : "text-indigo-900 dark:text-indigo-100"
            )}>
              {section.title || `Section ${index + 1}`}
            </h4>
          )}
          <p className="text-xs text-indigo-600/70 dark:text-indigo-300/70">
            {section.questions.length} question{section.questions.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onAddQuestion(); }}
            className="rounded p-1.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-800/40 dark:hover:text-indigo-200"
            title="Add question"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="rounded p-1.5 text-indigo-400 hover:bg-red-100 hover:text-red-600 dark:text-indigo-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title="Delete section"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <ChevronDown className={cn(
            "h-4 w-4 text-indigo-400 dark:text-indigo-400 transition-transform",
            isExpanded && "rotate-180"
          )} />
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-indigo-100 bg-white/60 p-4 dark:border-indigo-500/20 dark:bg-slate-900/40">
          {hasTitleError && (
            <p className="mb-3 flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" /> {hasTitleError}
            </p>
          )}

          {/* Section Questions - Drop Target */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setSectionDragOver(true);
            }}
            onDragLeave={() => setSectionDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setSectionDragOver(false);
              try {
                const data = JSON.parse(e.dataTransfer.getData("application/json"));
                onMoveQuestion(data.questionClientId, data.source, { sectionClientId: section.clientId, subsectionClientId: null, insertIndex: section.questions.length });
              } catch { /* ignore */ }
            }}
            className={cn(
              "space-y-3 rounded-lg transition-all",
              sectionDragOver && "ring-2 ring-primary/40 bg-primary/5"
            )}
          >
            {section.questions.map((question, qIdx) => (
              <QuestionCard
                key={question.clientId}
                question={question}
                index={qIdx}
                errorPrefix={`section-${index}-question-${qIdx}`}
                errors={errors}
                sourceLocation={{ sectionClientId: section.clientId, subsectionClientId: null }}
                onRemove={() => onRemoveQuestion(question.clientId)}
                onChange={(updates) => onUpdateQuestion(question.clientId, updates)}
                onDropQuestion={(dragData, insertIndex) => {
                  onMoveQuestion(dragData.questionClientId, dragData.source, {
                    sectionClientId: section.clientId,
                    subsectionClientId: null,
                    insertIndex,
                  });
                }}
                compact
                formSelfAssessmentEnabled={formSelfAssessmentEnabled}
              />
            ))}
            
            {section.questions.length === 0 && (
              <div className="rounded-lg border border-dashed border-indigo-200 py-6 text-center dark:border-indigo-500/30">
                <p className="text-xs text-indigo-400 dark:text-indigo-400/70">No questions yet — drag here or click Add Question</p>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={onAddQuestion}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-600 transition-all hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:border-indigo-400 dark:hover:bg-indigo-900/30"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Question
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
  sourceLocation,
  onRemove,
  onChange,
  onDropQuestion,
  compact = false,
  formSelfAssessmentEnabled = true,
}: {
  question: QuestionInput;
  index: number;
  errorPrefix: string;
  errors: Record<string, string>;
  sourceLocation: QuestionLocation;
  onRemove: () => void;
  onChange: (updates: Partial<QuestionInput>) => void;
  onDropQuestion?: (dragData: { questionClientId: string; source: QuestionLocation }, insertIndex: number) => void;
  compact?: boolean;
  formSelfAssessmentEnabled?: boolean;
}) {
  const textError = errors[errorPrefix];
  const typeError = errors[`${errorPrefix}-type`];
  const marksError = errors[`${errorPrefix}-marks`];
  const hasError = textError || typeError || marksError;
  const showOptions = questionNeedsOptions(question.inputType);
  const [dragOverPos, setDragOverPos] = useState<"before" | "after" | null>(null);

  useEffect(() => {
    const handleDragEnd = () => setDragOverPos(null);
    document.addEventListener("dragend", handleDragEnd);
    return () => document.removeEventListener("dragend", handleDragEnd);
  }, []);

  const handleNoMarksChange = (checked: boolean) => {
    onChange({
      noMarks: checked,
      totalMarks: checked ? 0 : question.totalMarks,
    });
  };

  return (
    <div
      onDragOver={(e) => {
        if (!onDropQuestion) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        setDragOverPos(e.clientY < midpoint ? "before" : "after");
      }}
      onDragLeave={(e) => {
        if (!onDropQuestion) return;
        const relatedTarget = e.relatedTarget as Node | null;
        if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
        setDragOverPos(null);
      }}
      onDrop={(e) => {
        if (!onDropQuestion) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isAfter = e.clientY >= midpoint;
        const insertIndex = isAfter ? index + 1 : index;
        setDragOverPos(null);
        try {
          const data = JSON.parse(e.dataTransfer.getData("application/json"));
          onDropQuestion(data, insertIndex);
        } catch { /* ignore */ }
      }}
      className={cn(
      "group relative rounded-lg border p-3 transition-all shadow-sm",
      hasError
        ? "border-red-300 bg-red-50/60 dark:border-red-700/50 dark:bg-red-950/20"
        : "border-teal-200 bg-teal-50/50 hover:border-teal-300 hover:shadow-md hover:shadow-teal-100/40 dark:border-teal-500/25 dark:bg-teal-950/30 dark:hover:border-teal-400/35",
      dragOverPos === "before" && "rounded-t-none border-t-2 border-t-primary",
      dragOverPos === "after" && "rounded-b-none border-b-2 border-b-primary",
    )}>
      {dragOverPos === "before" && (
        <div className="pointer-events-none absolute -top-0.5 left-2 right-2 h-0.5 rounded-full bg-primary z-20" />
      )}
      {dragOverPos === "after" && (
        <div className="pointer-events-none absolute -bottom-0.5 left-2 right-2 h-0.5 rounded-full bg-primary z-20" />
      )}
      <div className="flex items-start gap-2">
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/json", JSON.stringify({
              questionClientId: question.clientId,
              source: sourceLocation,
            }));
            e.dataTransfer.effectAllowed = "move";
          }}
          className="mt-1 flex cursor-grab items-center text-teal-300 hover:text-teal-600 active:cursor-grabbing dark:text-teal-600 dark:hover:text-teal-300"
          title="Drag to move question"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-teal-200 text-[10px] font-bold text-teal-800 dark:bg-teal-800/50 dark:text-teal-200">
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
                "flex-1 bg-transparent text-sm outline-none",
                textError ? "text-red-700 placeholder:text-red-400 dark:text-red-400 dark:placeholder:text-red-500" : "text-teal-900 placeholder:text-teal-400 dark:text-teal-50 dark:placeholder:text-teal-500"
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
                  "w-20 rounded border px-2 py-1 text-right text-xs outline-none bg-white/70 dark:bg-slate-900/50",
                  marksError
                    ? "border-red-400 text-red-700 dark:border-red-700 dark:text-red-400"
                    : "border-teal-200 text-teal-800 dark:border-teal-600/40 dark:text-teal-100"
                )}
              />
            )}
          </div>

          <div className={cn(
            "flex flex-wrap items-end gap-3",
          )}>
            <div className="w-40 shrink-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                Question Type
              </label>
              <select
                value={question.inputType}
                onChange={(e) =>
                  onChange(applyQuestionInputTypeChange(question, e.target.value as QuestionInput["inputType"]))
                }
                className={cn(
                  "h-8 w-full rounded border px-2 text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200/40 bg-white/70 dark:bg-slate-900/50 dark:focus:ring-teal-700/30",
                  typeError
                    ? "border-red-400 dark:border-red-700"
                    : "border-teal-200 dark:border-teal-600/40"
                )}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {FIELD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs text-teal-800 dark:text-teal-200">
                <input
                  type="checkbox"
                  checked={question.isRequired}
                  onChange={(e) => onChange({ isRequired: e.target.checked })}
                  className="size-3.5 rounded border-teal-400 text-teal-600 focus:ring-teal-400 dark:border-teal-500 dark:text-teal-400"
                />
                Required
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-teal-800 dark:text-teal-200">
                <input
                  type="checkbox"
                  checked={question.selfAssessmentEnabled}
                  onChange={(e) => onChange({ selfAssessmentEnabled: e.target.checked })}
                  disabled={!formSelfAssessmentEnabled}
                  className="size-3.5 rounded border-teal-400 text-teal-600 focus:ring-teal-400 disabled:opacity-40 dark:border-teal-500 dark:text-teal-400"
                />
                Self Assessment
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-teal-800 dark:text-teal-200">
                <input
                  type="checkbox"
                  checked={question.hodAssessmentEnabled}
                  onChange={(e) => onChange({ hodAssessmentEnabled: e.target.checked })}
                  className="size-3.5 rounded border-teal-400 text-teal-600 focus:ring-teal-400 dark:border-teal-500 dark:text-teal-400"
                />
                HOD Assessment
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-teal-800 dark:text-teal-200">
                <input
                  type="checkbox"
                  checked={question.noMarks}
                  onChange={(e) => handleNoMarksChange(e.target.checked)}
                  className="size-3.5 rounded border-teal-400 text-teal-600 focus:ring-teal-400 dark:border-teal-500 dark:text-teal-400"
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
                    "border-teal-300 dark:border-teal-600"
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
                    className="flex-1 bg-transparent text-xs outline-none text-teal-900 placeholder:text-teal-400 dark:text-teal-100 dark:placeholder:text-teal-500"
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
                    className="w-14 rounded border border-teal-200 bg-white/70 px-1.5 py-0.5 text-right text-xs outline-none dark:border-teal-600/40 dark:bg-slate-900/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newOptions = question.options.filter((_, i) => i !== oIdx);
                      onChange({ options: newOptions });
                    }}
                    className="text-teal-400 hover:text-red-600 dark:text-teal-500 dark:hover:text-red-400"
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
          className="mt-1 opacity-0 transition-opacity group-hover:opacity-100 text-teal-400 hover:text-red-600 dark:text-teal-500 dark:hover:text-red-400"
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
  copyMode = false,
}: FormBuilderWizardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const initialState = initialData ? mapRecordToState(initialData) : null;

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(
    copyMode && initialState
      ? `${initialState.title} (Copy)`
      : initialState?.title ?? "",
  );
  const [description, setDescription] = useState(initialState?.description ?? "");
  const [selfAssessmentEnabled, setSelfAssessmentEnabled] = useState(initialState?.selfAssessmentEnabled ?? true);
  const [sections, setSections] = useState<FormSectionInput[]>(
    initialState?.sections.map((section) => ({
      ...section,
      id: copyMode ? undefined : section.id,
      subsections: section.subsections.map((sub) => ({
        ...sub,
        id: copyMode ? undefined : sub.id,
        questions: sub.questions.map((q) => ({
          ...q,
          id: copyMode ? undefined : q.id,
          options: q.options.map((o) => ({
            ...o,
            id: copyMode ? undefined : o.id,
          })),
        })),
      })),
      questions: section.questions.map((q) => ({
        ...q,
        id: copyMode ? undefined : q.id,
        options: q.options.map((o) => ({
          ...o,
          id: copyMode ? undefined : o.id,
        })),
      })),
    })) ?? [],
  );
  const [questions, setQuestions] = useState<QuestionInput[]>(
    initialState?.questions.map((q) => ({
      ...q,
      id: copyMode ? undefined : q.id,
      options: q.options.map((o) => ({
        ...o,
        id: copyMode ? undefined : o.id,
      })),
    })) ?? [],
  );
  const [cycleId, setCycleId] = useState<number | "">(
    copyMode
      ? pickDefaultAppraisalCycleId(appraisalCycles)
      : initialState?.cycleId ?? pickDefaultAppraisalCycleId(appraisalCycles),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateFormId, setDuplicateFormId] = useState<number | null>(null);
  const [savedTemplateId, setSavedTemplateId] = useState<number | null>(templateId ?? null);

  const payload = useMemo<FormTemplateInput | null>(() => {
    const normalized = normalizeRootFormStructure(sections, questions);

    return {
      title: title.trim(),
      description: description.trim(),
      selfAssessmentEnabled,
      sections: normalized.sections,
      questions: normalized.questions,
      ...(cycleId ? { cycleId } : {}),
    };
  }, [
    title,
    description,
    selfAssessmentEnabled,
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
      const nextId = templateId ?? template.id;
      setSavedTemplateId(nextId);
      setStep(1);
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
    });

    questions.forEach((question, index) => {
      validateQuestionFields(question, `question-${index}`, nextErrors);
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    setSubmitError(null);
    setDuplicateFormId(null);
    if (step === 0 && !validateDesignStep()) {
      return;
    }
    if (step === 0 && payload) {
      saveMutation.mutate(payload);
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

  const handleFinish = () => {
    if (savedTemplateId) {
      window.location.href = `/dashboard/forms/${savedTemplateId}/view?t=${Date.now()}`;
    } else {
      window.location.href = "/dashboard/forms";
    }
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
            <Button type="button" fullWidth={false} onClick={goNext} isLoading={saveMutation.isPending} className="h-9 px-4">
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              fullWidth={false}
              onClick={handleFinish}
              className="h-9 px-4"
            >
              <CheckCircle2 className="h-4 w-4" />
              Finish
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
            selfAssessmentEnabled={selfAssessmentEnabled}
            sections={sections}
            questions={questions}
            errors={errors}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onSelfAssessmentEnabledChange={setSelfAssessmentEnabled}
            onStructureChange={handleStructureChange}
          />
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            {savedTemplateId ? (
              <FormEmployeeAssignment templateId={savedTemplateId} templateTitle={title} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                Saving form...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global Error Toast */}
      {submitError && (
        <div className="absolute bottom-6 right-6 z-50 max-w-sm rounded-md border border-red-200 bg-white px-4 py-3 shadow-lg dark:border-red-900 dark:bg-slate-900">
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