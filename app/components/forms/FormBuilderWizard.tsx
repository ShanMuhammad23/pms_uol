"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  type KeyboardEvent,
} from "react";
import { Button } from "@/app/components/auth/Button";
import FormEmployeeAssignment from "./FormEmployeeAssignment";
import FormTemplateView from "./FormTemplateView";
import { FormRatingScalesEditor } from "./FormRatingScalesEditor";
import {
  createFormTemplate,
  FormTemplateRequestError,
  updateFormTemplate,
} from "@/lib/queries/forms-client";
import type {
  AppraisalCycleRecord,
  FormSectionInput,
  FormSectionRecord,
  FormSubsectionInput,
  FormSubsectionRecord,
  FormTemplateInput,
  FormTemplateRecord,
  FormRatingScaleInput,
  FormRatingScaleRecord,
  QuestionInput,
  QuestionOptionRecord,
  QuestionRecord,
} from "@/types/forms";
import {
  countAllQuestions,
  createClientId,
  createEmptyQuestion,
  createEmptyRatingScale,
  createEmptySubsection,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  applyQuestionInputTypeChange,
  buildRootLayoutOrder,
  buildSectionLayoutOrder,
  createEmptySection,
  getNextRootSortOrder,
  mapQuestionRecordToInput,
  normalizeRootFormStructure,
  pickDefaultAppraisalCycleId,
  questionNeedsOptions,
} from "@/types/forms";
import { cn } from "@/lib/utils";
import { deriveRatingScaleMaxValue } from "@/app/helpers/form-rating-scoring";
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
  PanelRight,
  X
} from "lucide-react";

interface QuestionLocation {
  sectionClientId: string | null;
  subsectionClientId: string | null;
  insertIndex?: number;
}

/** Textarea that grows with its content instead of scrolling inside a fixed height. */
function AutoGrowTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={1}
      className={cn("overflow-hidden resize-none field-sizing-content", className)}
    />
  );
}

function draftToTemplateRecord(
  title: string,
  code: string,
  description: string,
  selfAssessmentEnabled: boolean,
  additionalRemarksEnabled: boolean,
  ratingBased: boolean,
  ratingScales: FormRatingScaleInput[],
  sections: FormSectionInput[],
  questions: QuestionInput[],
): FormTemplateRecord {
  let idCounter = 1;
  const nextId = () => idCounter++;

  const mappedScales: FormRatingScaleRecord[] = ratingScales.map((scale) => ({
    id: scale.id ?? nextId(),
    name: scale.name,
    maxValue: deriveRatingScaleMaxValue(scale.options, scale.maxValue),
    sortOrder: scale.sortOrder,
    options: scale.options.map((option) => ({
      id: option.id ?? nextId(),
      optionLabel: option.optionLabel,
      ratingValue: option.ratingValue,
      sortOrder: option.sortOrder,
    })),
  }));
  const scaleIdByClientId = new Map(
    ratingScales.map((scale, index) => [scale.clientId, mappedScales[index].id]),
  );

  const mapQuestion = (q: QuestionInput): QuestionRecord => ({
    id: q.id ?? nextId(),
    questionText: q.questionText,
    inputType: q.inputType,
    isRequired: q.isRequired,
    sortOrder: q.sortOrder,
    selfAssessmentEnabled: q.selfAssessmentEnabled,
    hodAssessmentEnabled: q.hodAssessmentEnabled,
    totalMarks: q.totalMarks,
    ratingScaleId:
      q.ratingScaleClientId
        ? (scaleIdByClientId.get(q.ratingScaleClientId) ?? q.ratingScaleId ?? null)
        : (q.ratingScaleId ?? null),
    options: q.options.map((o): QuestionOptionRecord => ({
      id: o.id ?? nextId(),
      optionLabel: o.optionLabel,
      pointsAssigned: o.pointsAssigned,
      sortOrder: o.sortOrder,
    })),
  });

  const recordSections: FormSectionRecord[] = sections.map((s) => {
    const sectionId = s.id ?? nextId();
    const mappedSubsections = s.subsections.map((sub): FormSubsectionRecord => ({
      id: sub.id ?? nextId(),
      title: sub.title,
      sortOrder: sub.sortOrder,
      questions: sub.questions.map(mapQuestion),
    }));
    const mappedQuestions = s.questions.map(mapQuestion);

    // Build id-based layout from clientId-based layout.
    const subIdLookup = new Map(s.subsections.map((sub, i) => [sub.clientId, mappedSubsections[i].id]));
    const qIdLookup = new Map(s.questions.map((q, i) => [q.clientId, mappedQuestions[i].id]));
    const sectionLayout = (s.layout ?? []).map((item) => {
      if (item.kind === "subsection") {
        const id = subIdLookup.get(item.clientId);
        return id ? { kind: "subsection" as const, id } : null;
      }
      const id = qIdLookup.get(item.clientId);
      return id ? { kind: "question" as const, id } : null;
    }).filter((item): item is { kind: "subsection"; id: number } | { kind: "question"; id: number } => item !== null);

    return {
      id: sectionId,
      title: s.title,
      sortOrder: s.sortOrder,
      subsections: mappedSubsections,
      questions: mappedQuestions,
      layout: sectionLayout,
    };
  });

  const recordQuestions: QuestionRecord[] = questions.map(mapQuestion);

  return {
    id: 0,
    title,
    code,
    description: description || null,
    cycleId: 0,
    fiscalYear: 0,
    targetCategory: null,
    targetSubCategory: null,
    selfAssessmentEnabled,
    additionalRemarksEnabled,
    ratingBased,
    ratingScales: mappedScales,
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
  /** Submitted/advanced appraisals — assignment alone does not lock structure. */
  submissionCount?: number;
  copyMode?: boolean;
}

function mapRecordToState(record: FormTemplateRecord) {
  const mappedScales: FormRatingScaleInput[] = (record.ratingScales ?? []).map(
    (scale) => ({
      id: scale.id,
      clientId: createClientId(),
      name: scale.name,
      maxValue: deriveRatingScaleMaxValue(scale.options, scale.maxValue),
      sortOrder: scale.sortOrder,
      options: scale.options.map((option) => ({
        id: option.id,
        clientId: createClientId(),
        optionLabel: option.optionLabel,
        ratingValue: option.ratingValue,
        sortOrder: option.sortOrder,
      })),
    }),
  );
  const scaleClientIdById = new Map(
    mappedScales
      .filter((scale) => scale.id != null)
      .map((scale) => [scale.id as number, scale.clientId]),
  );
  const mapQ = (question: QuestionRecord): QuestionInput => {
    const input = mapQuestionRecordToInput(question);
    return {
      ...input,
      ratingScaleClientId: question.ratingScaleId
        ? (scaleClientIdById.get(question.ratingScaleId) ?? "")
        : "",
    };
  };

  const mappedSections = record.sections.map((section) => {
    const sectionClientId = createClientId();
    const mappedSubsections = section.subsections.map((subsection) => ({
      clientId: createClientId(),
      id: subsection.id,
      title: subsection.title,
      sortOrder: subsection.sortOrder,
      questions: subsection.questions.map(mapQ),
    }));
    const mappedSectionQuestions = section.questions.map(mapQ);

    // Build clientId-based layout from the record's id-based layout.
    const subClientIdById = new Map(
      mappedSubsections.map((sub) => [sub.id!, sub.clientId]),
    );
    const qClientIdById = new Map(
      mappedSectionQuestions.map((q) => [q.id!, q.clientId]),
    );
    const sectionLayout = (section.layout ?? [])
      .map((item) => {
        if (item.kind === "subsection") {
          const clientId = subClientIdById.get(item.id);
          return clientId ? { kind: "subsection" as const, clientId } : null;
        }
        const clientId = qClientIdById.get(item.id);
        return clientId ? { kind: "question" as const, clientId } : null;
      })
      .filter(
        (item): item is { kind: "subsection"; clientId: string } | { kind: "question"; clientId: string } =>
          item !== null,
      );

    return {
      clientId: sectionClientId,
      id: section.id,
      title: section.title,
      sortOrder: section.sortOrder,
      questions: mappedSectionQuestions,
      subsections: mappedSubsections,
      layout: sectionLayout,
    };
  });
  const mappedQuestions = record.questions.map(mapQ);
  const normalized = normalizeRootFormStructure(mappedSections, mappedQuestions);

  return {
    title: record.title,
    code: record.code ?? "",
    description: record.description ?? "",
    cycleId: record.cycleId,
    selfAssessmentEnabled: record.selfAssessmentEnabled,
    additionalRemarksEnabled: record.additionalRemarksEnabled,
    ratingBased: record.ratingBased,
    ratingScales: mappedScales,
    sections: normalized.sections,
    questions: normalized.questions,
  };
}

function applyDefaultRatingScale(
  question: QuestionInput,
  ratingBased: boolean,
  ratingScales: FormRatingScaleInput[],
): QuestionInput {
  if (!ratingBased || question.noMarks || question.ratingScaleClientId) {
    return question;
  }
  const scale = ratingScales[0];
  if (!scale) {
    return question;
  }
  return {
    ...question,
    ratingScaleClientId: scale.clientId,
    ratingScaleId: scale.id ?? null,
  };
}

function validateQuestionFields(
  question: QuestionInput,
  errorPrefix: string,
  nextErrors: Record<string, string>,
  ratingBased = false,
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

  if (
    ratingBased &&
    !question.noMarks &&
    Number(question.totalMarks) > 0 &&
    !question.ratingScaleClientId
  ) {
    nextErrors[`${errorPrefix}-scale`] = "Select a rating dropdown.";
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

function findQuestionByClientId(
  sections: FormSectionInput[],
  questions: QuestionInput[],
  clientId: string,
): QuestionInput | undefined {
  const root = questions.find((question) => question.clientId === clientId);
  if (root) return root;

  for (const section of sections) {
    const inSection = section.questions.find((question) => question.clientId === clientId);
    if (inSection) return inSection;
    for (const subsection of section.subsections) {
      const inSubsection = subsection.questions.find(
        (question) => question.clientId === clientId,
      );
      if (inSubsection) return inSubsection;
    }
  }

  return undefined;
}

// --- Modern Form Design Step Components ---

interface ModernFormDesignStepProps {
  title: string;
  code: string;
  description: string;
  selfAssessmentEnabled: boolean;
  additionalRemarksEnabled: boolean;
  ratingBased: boolean;
  scoringMode: "absolute" | "rating" | null;
  ratingScales: FormRatingScaleInput[];
  sections: FormSectionInput[];
  questions: QuestionInput[];
  errors: Record<string, string>;
  onDescriptionChange: (description: string) => void;
  onAdditionalRemarksEnabledChange: (enabled: boolean) => void;
  onScoringModeChange: (mode: "absolute" | "rating") => void;
  onRatingScalesChange: (scales: FormRatingScaleInput[]) => void;
  onStructureChange: (sections: FormSectionInput[], questions: QuestionInput[]) => void;
  lockExistingQuestions?: boolean;
}

function ModernFormDesignStep({
  title,
  code,
  description,
  selfAssessmentEnabled,
  additionalRemarksEnabled,
  ratingBased,
  scoringMode,
  ratingScales,
  sections,
  questions,
  errors,
  onDescriptionChange,
  onAdditionalRemarksEnabledChange,
  onScoringModeChange,
  onRatingScalesChange,
  onStructureChange,
  lockExistingQuestions = false,
}: ModernFormDesignStepProps) {
  const [activePanel, setActivePanel] = useState<"builder" | "preview">("builder");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(scoringMode == null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.ratingScales || errors.formType) {
      setSettingsOpen(true);
    }
  }, [errors.ratingScales, errors.formType]);

  // Auto-expand sections that have errors
  const sectionsWithErrors = useMemo(() => {
    const ids = new Set<string>();
    sections.forEach((section, sIdx) => {
      const hasError = Object.keys(errors).some((k) =>
        k.startsWith(`section-${sIdx}`),
      );
      if (hasError) ids.add(section.clientId);
    });
    return ids;
  }, [errors, sections]);
  if (sectionsWithErrors.size > 0) {
    let missing = false;
    for (const id of sectionsWithErrors) {
      if (!expandedSections.has(id)) {
        missing = true;
        break;
      }
    }
    if (missing) {
      setExpandedSections(
        (prev) => new Set([...prev, ...sectionsWithErrors]),
      );
    }
  }

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
    const newQuestion = applyDefaultRatingScale(
      createEmptyQuestion(getNextRootSortOrder(sections, questions)),
      ratingBased,
      ratingScales,
    );
    commitStructure(sections, [...questions, newQuestion]);
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, [sections, questions, commitStructure, ratingBased, ratingScales]);

  const updateSection = (clientId: string, updates: Partial<FormSectionInput>) => {
    commitStructure(
      sections.map(s => s.clientId === clientId ? { ...s, ...updates } : s),
      questions,
    );
  };

  const removeSection = (clientId: string) => {
    const section = sections.find((s) => s.clientId === clientId);
    if (
      lockExistingQuestions &&
      section &&
      (section.questions.some((q) => q.id != null) ||
        section.subsections.some((sub) => sub.questions.some((q) => q.id != null)))
    ) {
      return;
    }
    commitStructure(sections.filter(s => s.clientId !== clientId), questions);
  };

  const addQuestionToSection = (sectionClientId: string) => {
    commitStructure(
      sections.map(s => {
        if (s.clientId === sectionClientId) {
          const nextSortOrder = s.questions.length === 0 ? 0 : Math.max(...s.questions.map(q => q.sortOrder)) + 1;
          const newQ = applyDefaultRatingScale(
            createEmptyQuestion(nextSortOrder),
            ratingBased,
            ratingScales,
          );
          return {
            ...s,
            questions: [...s.questions, newQ],
            layout: [...(s.layout ?? []), { kind: "question" as const, clientId: newQ.clientId }],
          };
        }
        return s;
      }),
      questions,
    );
  };

  const removeQuestion = (questionClientId: string) => {
    const existing = findQuestionByClientId(sections, questions, questionClientId);
    if (lockExistingQuestions && existing?.id != null) {
      return;
    }

    if (questions.some(q => q.clientId === questionClientId)) {
      commitStructure(
        sections,
        questions.filter(q => q.clientId !== questionClientId),
      );
      return;
    }

    commitStructure(
      sections.map(s => ({
        ...s,
        questions: s.questions
          .filter(q => q.clientId !== questionClientId)
          .map((question, sortOrder) => ({ ...question, sortOrder })),
        subsections: s.subsections.map(sub => ({
          ...sub,
          questions: sub.questions
            .filter(q => q.clientId !== questionClientId)
            .map((question, sortOrder) => ({ ...question, sortOrder })),
        })),
        layout: (s.layout ?? []).filter(
          item => !(item.kind === "question" && item.clientId === questionClientId),
        ),
      })),
      questions,
    );
  };

  const updateQuestion = (questionClientId: string, updates: Partial<QuestionInput>) => {
    if (questions.some(q => q.clientId === questionClientId)) {
      commitStructure(
        sections,
        questions.map(q => q.clientId === questionClientId ? { ...q, ...updates } : q),
      );
      return;
    }

    commitStructure(
      sections.map(s => ({
        ...s,
        questions: s.questions.map(q =>
          q.clientId === questionClientId ? { ...q, ...updates } : q
        ),
        subsections: s.subsections.map(sub => ({
          ...sub,
          questions: sub.questions.map(q =>
            q.clientId === questionClientId ? { ...q, ...updates } : q
          ),
        })),
      })),
      questions,
    );
  };

  const addSubsectionToSection = (sectionClientId: string) => {
    commitStructure(
      sections.map(s => {
        if (s.clientId === sectionClientId) {
          const nextSortOrder = s.subsections.length === 0 ? 0 : Math.max(...s.subsections.map(sub => sub.sortOrder)) + 1;
          const newSub = createEmptySubsection(nextSortOrder);
          return {
            ...s,
            subsections: [...s.subsections, newSub],
            layout: [...(s.layout ?? []), { kind: "subsection" as const, clientId: newSub.clientId }],
          };
        }
        return s;
      }),
      questions,
    );
  };

  const removeSubsection = (sectionClientId: string, subsectionClientId: string) => {
    const section = sections.find((s) => s.clientId === sectionClientId);
    const subsection = section?.subsections.find((sub) => sub.clientId === subsectionClientId);
    if (
      lockExistingQuestions &&
      subsection?.questions.some((question) => question.id != null)
    ) {
      return;
    }

    commitStructure(
      sections.map(s => {
        if (s.clientId === sectionClientId) {
          return {
            ...s,
            subsections: s.subsections
              .filter(sub => sub.clientId !== subsectionClientId)
              .map((sub, sortOrder) => ({ ...sub, sortOrder })),
            layout: (s.layout ?? []).filter(
              item => !(item.kind === "subsection" && item.clientId === subsectionClientId),
            ),
          };
        }
        return s;
      }),
      questions,
    );
  };

  const addQuestionToSubsection = (sectionClientId: string, subsectionClientId: string) => {
    commitStructure(
      sections.map(s => {
        if (s.clientId === sectionClientId) {
          return {
            ...s,
            subsections: s.subsections.map(sub => {
              if (sub.clientId === subsectionClientId) {
                const nextSortOrder = sub.questions.length === 0 ? 0 : Math.max(...sub.questions.map(q => q.sortOrder)) + 1;
                return {
                  ...sub,
                  questions: [
                    ...sub.questions,
                    applyDefaultRatingScale(
                      createEmptyQuestion(nextSortOrder),
                      ratingBased,
                      ratingScales,
                    ),
                  ],
                };
              }
              return sub;
            }),
          };
        }
        return s;
      }),
      questions,
    );
  };

  const moveSubsection = (subsectionClientId: string, sourceSectionClientId: string, targetSectionClientId: string, insertLayoutIndex: number) => {
    const sourceSection = sections.find(s => s.clientId === sourceSectionClientId);
    if (!sourceSection) return;
    const movedSubsection = sourceSection.subsections.find(sub => sub.clientId === subsectionClientId);
    if (!movedSubsection) return;

    // Find source layout index for same-section adjustment
    const sourceLayout = sourceSection.layout ?? [];
    const sourceLayoutIndex = sourceLayout.findIndex(
      item => item.kind === "subsection" && item.clientId === subsectionClientId,
    );

    // Remove from source section (both subsections array and layout)
    let nextSections = sections.map(s => {
      if (s.clientId !== sourceSectionClientId) return s;
      return {
        ...s,
        subsections: s.subsections.filter(sub => sub.clientId !== subsectionClientId),
        layout: (s.layout ?? []).filter(
          item => !(item.kind === "subsection" && item.clientId === subsectionClientId),
        ),
      };
    });

    // Adjust target layout index for same-section removal
    let targetIndex = insertLayoutIndex;
    if (sourceSectionClientId === targetSectionClientId && sourceLayoutIndex >= 0 && sourceLayoutIndex < insertLayoutIndex) {
      targetIndex = insertLayoutIndex - 1;
    }

    // Insert into target section's layout
    const targetSection = nextSections.find(s => s.clientId === targetSectionClientId);
    if (!targetSection) return;

    const targetLayout = [...(targetSection.layout ?? [])];
    const clampedIndex = Math.max(0, Math.min(targetIndex, targetLayout.length));
    targetLayout.splice(clampedIndex, 0, { kind: "subsection" as const, clientId: subsectionClientId });

    nextSections = nextSections.map(s => {
      if (s.clientId !== targetSectionClientId) return s;
      return {
        ...s,
        subsections: [...s.subsections, movedSubsection],
        layout: targetLayout,
      };
    });

    commitStructure(nextSections, questions);
  };

  const moveSection = (sectionClientId: string, insertLayoutIndex: number) => {
    // Build the current root layout to determine interleaved positions
    const layout = buildRootLayoutOrder(sections, questions);
    const sourceLayoutIndex = layout.findIndex(
      item => item.kind === "section" && item.clientId === sectionClientId,
    );
    if (sourceLayoutIndex < 0) return;

    // Remove the section from the layout
    const removed = layout[sourceLayoutIndex];
    const remainingLayout = layout.filter((_, i) => i !== sourceLayoutIndex);

    // Adjust target layout index for removal
    let targetIndex = insertLayoutIndex;
    if (sourceLayoutIndex < insertLayoutIndex) {
      targetIndex = insertLayoutIndex - 1;
    }

    const clampedIndex = Math.max(0, Math.min(targetIndex, remainingLayout.length));
    const newLayout = [...remainingLayout];
    newLayout.splice(clampedIndex, 0, removed);

    // Reassign sortOrder to all root items based on the new layout
    const sectionMap = new Map(sections.map(s => [s.clientId, s]));
    const questionMap = new Map(questions.map(q => [q.clientId, q]));
    const nextSections: FormSectionInput[] = [];
    const nextQuestions: QuestionInput[] = [];
    let sortOrder = 0;
    for (const item of newLayout) {
      if (item.kind === "section") {
        const s = sectionMap.get(item.clientId);
        if (s) { nextSections.push({ ...s, sortOrder }); sortOrder++; }
      } else {
        const q = questionMap.get(item.clientId);
        if (q) { nextQuestions.push({ ...q, sortOrder }); sortOrder++; }
      }
    }

    commitStructure(nextSections, nextQuestions);
  };

  const moveQuestion = useCallback(
    (questionClientId: string, source: QuestionLocation, target: QuestionLocation) => {
      let movedQuestion: QuestionInput | null = null;
      let sourceLayoutIndex = -1;
      let sourceRootLayoutIndex = -1;
      let nextSections = [...sections];
      let nextQuestions = [...questions];

      // Step 1: Extract question from source, tracking layout index for adjustment
      if (source.sectionClientId === null) {
        // Source is root — track root layout index for same-list adjustment
        const fullRootLayout = buildRootLayoutOrder(sections, questions);
        sourceRootLayoutIndex = fullRootLayout.findIndex(
          item => item.kind === "question" && item.clientId === questionClientId,
        );
        const sourceIdx = nextQuestions.findIndex(q => q.clientId === questionClientId);
        if (sourceIdx >= 0) {
          movedQuestion = nextQuestions[sourceIdx];
          nextQuestions = nextQuestions.filter(q => q.clientId !== questionClientId);
        }
      } else {
        // Source is a section
        nextSections = nextSections.map(s => {
          if (s.clientId !== source.sectionClientId) return s;
          if (source.subsectionClientId === null) {
            // Source is section direct question — remove from layout too
            const q = s.questions.find(qq => qq.clientId === questionClientId);
            if (q) {
              movedQuestion = q;
              sourceLayoutIndex = (s.layout ?? []).findIndex(
                item => item.kind === "question" && item.clientId === questionClientId,
              );
              return {
                ...s,
                questions: s.questions.filter(qq => qq.clientId !== questionClientId),
                layout: (s.layout ?? []).filter(
                  item => !(item.kind === "question" && item.clientId === questionClientId),
                ),
              };
            }
          } else {
            // Source is subsection question
            return {
              ...s,
              subsections: s.subsections.map(sub => {
                if (sub.clientId !== source.subsectionClientId) return sub;
                const q = sub.questions.find(qq => qq.clientId === questionClientId);
                if (q) {
                  movedQuestion = q;
                  return {
                    ...sub,
                    questions: sub.questions
                      .filter(qq => qq.clientId !== questionClientId)
                      .map((qq, i) => ({ ...qq, sortOrder: i })),
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

      // Step 2: Insert at target
      if (target.sectionClientId === null) {
        // Target is root — insertIndex is a root layout index
        const layout = buildRootLayoutOrder(nextSections, nextQuestions);
        let targetLayoutIndex = target.insertIndex ?? layout.length;

        // Adjust for same-list removal (root question moved within root)
        if (source.sectionClientId === null && sourceRootLayoutIndex >= 0 && sourceRootLayoutIndex < targetLayoutIndex) {
          targetLayoutIndex = targetLayoutIndex - 1;
        }

        const clampedIndex = Math.max(0, Math.min(targetLayoutIndex, layout.length));
        const newLayout = [...layout];
        newLayout.splice(clampedIndex, 0, { kind: "question" as const, clientId: questionClientId });

        // Reassign sortOrder to all root items
        const sectionMap = new Map(nextSections.map(s => [s.clientId, s]));
        const questionMap = new Map(nextQuestions.map(q => [q.clientId, q]));
        questionMap.set(questionClientId, moved);

        const reorderedSections: FormSectionInput[] = [];
        const reorderedQuestions: QuestionInput[] = [];
        let sortOrder = 0;
        for (const item of newLayout) {
          if (item.kind === "section") {
            const s = sectionMap.get(item.clientId);
            if (s) { reorderedSections.push({ ...s, sortOrder }); sortOrder++; }
          } else {
            const q = questionMap.get(item.clientId);
            if (q) { reorderedQuestions.push({ ...q, sortOrder }); sortOrder++; }
          }
        }
        nextSections = reorderedSections;
        nextQuestions = reorderedQuestions;
      } else if (target.subsectionClientId === null) {
        // Target is section direct question — update layout field
        const targetSection = nextSections.find(s => s.clientId === target.sectionClientId);
        if (!targetSection) return;

        const targetLayout = [...(targetSection.layout ?? [])];
        let insertIdx = target.insertIndex ?? targetLayout.length;

        // Adjust for same-section removal (layout index shift)
        if (source.sectionClientId === target.sectionClientId &&
            source.subsectionClientId === null &&
            sourceLayoutIndex >= 0 && sourceLayoutIndex < insertIdx) {
          insertIdx = insertIdx - 1;
        }

        const clampedIndex = Math.max(0, Math.min(insertIdx, targetLayout.length));
        targetLayout.splice(clampedIndex, 0, { kind: "question" as const, clientId: questionClientId });

        nextSections = nextSections.map(s => {
          if (s.clientId !== target.sectionClientId) return s;
          return {
            ...s,
            questions: [...s.questions, moved],
            layout: targetLayout,
          };
        });
      } else {
        // Target is subsection question — insert into subsection's questions array
        const insertIdx = target.insertIndex ?? 0;
        nextSections = nextSections.map(s => {
          if (s.clientId !== target.sectionClientId) return s;
          return {
            ...s,
            subsections: s.subsections.map(sub => {
              if (sub.clientId !== target.subsectionClientId) return sub;
              const newQs = [...sub.questions];
              newQs.splice(insertIdx, 0, moved);
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
    () => draftToTemplateRecord(title, code, description, selfAssessmentEnabled, additionalRemarksEnabled, ratingBased, ratingScales, sections, questions),
    [title, code, description, selfAssessmentEnabled, additionalRemarksEnabled, ratingBased, ratingScales, sections, questions],
  );

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      {settingsOpen ? (
        <>
        <button
          type="button"
          className="absolute inset-0 z-10 bg-slate-900/25 lg:hidden"
          aria-label="Close settings"
          onClick={() => setSettingsOpen(false)}
        />
        <aside
          id="form-settings-content"
          className="absolute inset-y-0 left-0 z-20 flex w-[min(100%,20.5rem)] shrink-0 flex-col overflow-y-auto border-r border-indigo-100 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:relative lg:z-0 lg:shadow-none"
        >
          <div className="flex items-center justify-between border-b border-indigo-100 px-3 py-2.5 dark:border-slate-800">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Settings2 className="h-4 w-4 text-indigo-500" />
              Form settings
            </h3>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Close settings"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-4 p-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-snug text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-indigo-500/40">
              <input
                type="checkbox"
                checked={additionalRemarksEnabled}
                onChange={(e) => onAdditionalRemarksEnabledChange(e.target.checked)}
                className="mt-0.5 size-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30 dark:border-slate-600"
              />
              <span>
                <span className="block font-semibold text-slate-800 dark:text-slate-100">
                  Additional remarks
                </span>
                Overall remarks for Manager 1 &amp; Manager 2. Employees never see this.
              </span>
            </label>

            <fieldset
              className={cn(
                "space-y-2 rounded-lg border px-3 py-2.5",
                errors.formType
                  ? "border-red-300 bg-red-50/60 dark:border-red-700 dark:bg-red-950/20"
                  : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950",
              )}
            >
              <legend className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Form type <span className="text-red-500">*</span>
              </legend>
              <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                Choose how this form is scored. Required before saving.
              </p>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-snug transition-colors",
                  scoringMode === "absolute"
                    ? "border-indigo-300 bg-indigo-50 text-slate-700 dark:border-indigo-500/50 dark:bg-indigo-950/40 dark:text-slate-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500/40",
                )}
              >
                <input
                  type="radio"
                  name="form-scoring-type"
                  checked={scoringMode === "absolute"}
                  onChange={() => onScoringModeChange("absolute")}
                  className="mt-0.5 size-3.5 border-slate-300 text-indigo-600 focus:ring-indigo-500/30 dark:border-slate-600"
                />
                <span>
                  <span className="block font-semibold text-slate-800 dark:text-slate-100">
                    Absolute score
                  </span>
                  Enter marks directly, up to the question weight. Rating based is off.
                </span>
              </label>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-snug transition-colors",
                  scoringMode === "rating"
                    ? "border-violet-300 bg-violet-50 text-slate-700 dark:border-violet-500/50 dark:bg-violet-950/40 dark:text-slate-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-violet-500/40",
                )}
              >
                <input
                  type="radio"
                  name="form-scoring-type"
                  checked={scoringMode === "rating"}
                  onChange={() => onScoringModeChange("rating")}
                  className="mt-0.5 size-3.5 border-slate-300 text-violet-600 focus:ring-violet-500/30 dark:border-slate-600"
                />
                <span>
                  <span className="block font-semibold text-slate-800 dark:text-slate-100">
                    Rating based
                  </span>
                  Score from a rating dropdown (rating ÷ max × question marks).
                </span>
              </label>
              {errors.formType ? (
                <p className="text-xs text-red-500">{errors.formType}</p>
              ) : null}
            </fieldset>

            {scoringMode === "rating" ? (
              <FormRatingScalesEditor
                scales={ratingScales}
                onChange={onRatingScalesChange}
                error={errors.ratingScales}
              />
            ) : null}
          </div>
        </aside>
        </>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-indigo-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex rounded-lg bg-indigo-50 p-0.5 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActivePanel("builder")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                  activePanel === "builder"
                    ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                Builder
              </button>
              <button
                type="button"
                onClick={() => setActivePanel("preview")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                  activePanel === "preview"
                    ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
            </div>
            <span className="hidden text-xs text-slate-500 sm:inline dark:text-slate-400">
              <span className="font-semibold text-indigo-600 dark:text-indigo-300">{totalQuestions}</span> questions
              <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{sections.length}</span> sections
            </span>
            {hasErrors ? (
              <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5" />
                {Object.keys(errors).length}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activePanel === "builder" ? (
              <>
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Section
                </button>
                <button
                  type="button"
                  onClick={addStandaloneQuestion}
                  className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-500/40 dark:bg-slate-900 dark:text-indigo-300"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Question
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              aria-expanded={settingsOpen}
              aria-controls="form-settings-content"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                scoringMode == null
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-200"
                  : settingsOpen
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-950/40 dark:text-indigo-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
              )}
            >
              <PanelRight className="h-3.5 w-3.5" />
              Settings
              {scoringMode === "rating" ? (
                <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-200">
                  Rating
                </span>
              ) : scoringMode === "absolute" ? (
                <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
                  Absolute
                </span>
              ) : (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/50 dark:text-red-200">
                  Type *
                </span>
              )}
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto bg-indigo-50 px-4 py-4 [background-image:radial-gradient(circle_at_1px_1px,rgb(99_102_241_/_0.16)_1px,transparent_0)] [background-size:18px_18px] sm:px-6 dark:bg-slate-950 dark:[background-image:radial-gradient(circle_at_1px_1px,rgb(165_180_252_/_0.12)_1px,transparent_0)]"
        >
          {activePanel === "builder" ? (
            <div className=" space-y-3">
              {sections.length === 0 && questions.length === 0 && (
                <div className="flex min-h-[min(28rem,calc(100dvh-11rem))] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 bg-white/80 py-16 text-center shadow-sm dark:border-indigo-500/30 dark:bg-slate-900/70">
                  <div className="mb-4 rounded-full bg-indigo-100 p-4 dark:bg-indigo-900/40">
                    <FileText className="h-8 w-8 text-indigo-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Start building your form
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                    Add sections to group related questions, or add a standalone question. Title and code live in the top bar.
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
                <div className="space-y-3">
                  {rootLayout.map((item, rootIdx) => {
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
                          rootLayoutIndex={rootIdx}
                          isExpanded={expandedSections.has(section.clientId)}
                          onToggle={() => toggleSection(section.clientId)}
                          errors={errors}
                          onUpdate={(updates) => updateSection(section.clientId, updates)}
                          onRemove={() => removeSection(section.clientId)}
                          onAddQuestion={() => addQuestionToSection(section.clientId)}
                          onAddSubsection={() => addSubsectionToSection(section.clientId)}
                          onRemoveSubsection={(subId) => removeSubsection(section.clientId, subId)}
                          onDropSection={(dragSectionClientId, insertIndex) => moveSection(dragSectionClientId, insertIndex)}
                          onDropSubsection={(dragSubsectionClientId, sourceSectionClientId, insertIndex) =>
                            moveSubsection(dragSubsectionClientId, sourceSectionClientId, section.clientId, insertIndex)
                          }
                          onAddQuestionToSubsection={(subId) => addQuestionToSubsection(section.clientId, subId)}
                          onRemoveQuestion={removeQuestion}
                          onMoveQuestion={moveQuestion}
                          onUpdateQuestion={updateQuestion}
                          formSelfAssessmentEnabled={selfAssessmentEnabled}
                          ratingBased={ratingBased}
                          ratingScales={ratingScales}
                          lockExistingQuestions={lockExistingQuestions}
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
                        layoutIndex={rootIdx}
                        errorPrefix={`question-${questionIndex}`}
                        errors={errors}
                        sourceLocation={{ sectionClientId: null, subsectionClientId: null }}
                        onRemove={() => removeQuestion(question.clientId)}
                        onChange={(updates) => updateQuestion(question.clientId, updates)}
                        onDropQuestion={(dragData, insertIndex) => {
                          moveQuestion(dragData.questionClientId, dragData.source, {
                            sectionClientId: null,
                            subsectionClientId: null,
                            insertIndex,
                          });
                        }}
                        onDropSection={(dragSectionClientId, insertIndex) => moveSection(dragSectionClientId, insertIndex)}
                        formSelfAssessmentEnabled={selfAssessmentEnabled}
                        ratingBased={ratingBased}
                        ratingScales={ratingScales}
                        lockExistingQuestions={lockExistingQuestions}
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
                      if (data.kind === "section") {
                        moveSection(data.sectionClientId, rootLayout.length);
                      } else if (data.questionClientId) {
                        moveQuestion(data.questionClientId, data.source, {
                          sectionClientId: null,
                          subsectionClientId: null,
                          insertIndex: rootLayout.length,
                        });
                      }
                    } catch { /* ignore */ }
                  }}
                  className={cn(
                    "rounded-md border-2 border-dashed py-4 text-center text-xs transition-all",
                    dragOverTarget === "root"
                      ? "border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300"
                      : "border-indigo-200 text-indigo-400 dark:border-indigo-600/30 dark:text-indigo-500"
                  )}
                >
                  Drop here to move question or section to root level
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <FormTemplateView template={previewTemplate} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components for cleaner architecture ---

function SubsectionCard({
  subsection,
  subsectionIndex,
  layoutIndex,
  sectionIndex,
  sectionClientId,
  errors,
  onUpdate,
  onRemove,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  onMoveQuestion,
  onDropSubsection,
  formSelfAssessmentEnabled = true,
  ratingBased = false,
  ratingScales = [],
  lockExistingQuestions = false,
}: {
  subsection: FormSubsectionInput;
  subsectionIndex: number;
  layoutIndex: number;
  sectionIndex: number;
  sectionClientId: string;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<FormSubsectionInput>) => void;
  onRemove: () => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (qId: string) => void;
  onUpdateQuestion: (qId: string, updates: Partial<QuestionInput>) => void;
  onMoveQuestion: (questionClientId: string, source: QuestionLocation, target: QuestionLocation) => void;
  onDropSubsection: (dragSubsectionClientId: string, sourceSectionClientId: string, insertLayoutIndex: number) => void;
  formSelfAssessmentEnabled?: boolean;
  ratingBased?: boolean;
  ratingScales?: FormRatingScaleInput[];
  lockExistingQuestions?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [dragOverPos, setDragOverPos] = useState<"before" | "after" | null>(null);
  const titleError = errors[`section-${sectionIndex}-sub-${subsectionIndex}-title`];
  const subsectionLocked =
    lockExistingQuestions &&
    subsection.questions.some((question) => question.id != null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        setDragOverPos(e.clientY < midpoint ? "before" : "after");
      }}
      onDragLeave={(e) => {
        const relatedTarget = e.relatedTarget as Node | null;
        if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
        setDragOverPos(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverPos(null);
        try {
          const data = JSON.parse(e.dataTransfer.getData("application/json"));
          const rect = e.currentTarget.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          const targetLayoutIndex = e.clientY < midpoint ? layoutIndex : layoutIndex + 1;
          if (data.kind === "subsection" && data.subsectionClientId !== subsection.clientId) {
            onDropSubsection(data.subsectionClientId, data.sourceSectionClientId, targetLayoutIndex);
          } else if (data.questionClientId) {
            // Drop question before/after this subsection → make it a direct section question
            onMoveQuestion(data.questionClientId, data.source, {
              sectionClientId,
              subsectionClientId: null,
              insertIndex: targetLayoutIndex,
            });
          }
        } catch { /* ignore */ }
      }}
      className={cn(
        "relative rounded-md border border-l-[3px] p-3 transition-all",
        titleError
          ? "border-red-300 border-l-red-500 bg-red-50/50 dark:border-red-600/50 dark:bg-red-950/30"
          : "border-slate-200 border-l-teal-500 bg-white shadow-sm hover:border-teal-300 dark:border-slate-700 dark:border-l-teal-400 dark:bg-slate-900",
        dragOverPos === "before" && "rounded-t-none border-t-2 border-t-primary",
        dragOverPos === "after" && "rounded-b-none border-b-2 border-b-primary"
      )}
    >
      {dragOverPos === "before" && (
        <div className="pointer-events-none absolute -top-0.5 left-2 right-2 h-0.5 rounded-full bg-primary z-20" />
      )}
      {dragOverPos === "after" && (
        <div className="pointer-events-none absolute -bottom-0.5 left-2 right-2 h-0.5 rounded-full bg-primary z-20" />
      )}
      <div className="mb-3 flex items-start gap-2">
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/json", JSON.stringify({
              kind: "subsection",
              subsectionClientId: subsection.clientId,
              sourceSectionClientId: sectionClientId,
            }));
            e.dataTransfer.effectAllowed = "move";
          }}
          className="mt-1 flex cursor-grab items-center text-teal-300 hover:text-teal-600 active:cursor-grabbing dark:text-teal-500 dark:hover:text-teal-300"
          title="Drag to move subsection"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-teal-100 text-[10px] font-bold text-teal-700 dark:bg-teal-800/50 dark:text-teal-200">
          {sectionIndex + 1}.{subsectionIndex + 1}
        </div>
        <textarea
          value={subsection.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
            }
          }}
          placeholder="Subsection Title (Press Enter for new line)"
          rows={1}
          className={cn(
            "min-w-0 flex-1 resize-y bg-transparent text-sm font-semibold outline-none whitespace-pre-wrap",
            titleError ? "text-red-700 placeholder:text-red-400 dark:text-red-400" : "text-teal-900 placeholder:text-teal-400 dark:text-teal-100"
          )}
        />
        <div className="flex items-center gap-1">
          <button
            onClick={onAddQuestion}
            className="rounded p-1 text-sky-400 hover:bg-sky-100 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-800/40"
            title="Add question"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            disabled={subsectionLocked}
            className="rounded p-1 text-teal-400 hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-teal-400 dark:text-teal-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title={
              subsectionLocked
                ? "Cannot delete a subsection with questions after submissions exist"
                : "Delete subsection"
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {titleError && (
        <p className="mb-3 flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3 w-3" /> {titleError}
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          try {
            const data = JSON.parse(e.dataTransfer.getData("application/json"));
            if (data.questionClientId) {
              onMoveQuestion(data.questionClientId, data.source, {
                sectionClientId,
                subsectionClientId: subsection.clientId,
                insertIndex: subsection.questions.length,
              });
            }
          } catch { /* ignore */ }
        }}
        className={cn(
          "space-y-3 rounded-lg transition-all",
          dragOver && "ring-2 ring-primary/40 bg-primary/5"
        )}
      >
        {subsection.questions.map((question, qIdx) => (
          <QuestionCard
            key={question.clientId}
            question={question}
            index={qIdx}
            errorPrefix={`section-${sectionIndex}-sub-${subsectionIndex}-question-${qIdx}`}
            errors={errors}
            sourceLocation={{ sectionClientId, subsectionClientId: subsection.clientId }}
            onRemove={() => onRemoveQuestion(question.clientId)}
            onChange={(updates) => onUpdateQuestion(question.clientId, updates)}
            onDropQuestion={(dragData, insertIndex) => {
              onMoveQuestion(dragData.questionClientId, dragData.source, {
                sectionClientId,
                subsectionClientId: subsection.clientId,
                insertIndex,
              });
            }}
            compact
            formSelfAssessmentEnabled={formSelfAssessmentEnabled}
            ratingBased={ratingBased}
            ratingScales={ratingScales}
            lockExistingQuestions={lockExistingQuestions}
          />
        ))}

        {subsection.questions.length === 0 && (
          <div className="rounded-lg border border-dashed border-sky-200 py-5 text-center dark:border-sky-500/30">
            <p className="text-xs text-sky-400 dark:text-sky-400/70">No questions — drag here or click Add Question</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  section,
  index,
  rootLayoutIndex,
  isExpanded,
  onToggle,
  errors,
  onUpdate,
  onRemove,
  onAddQuestion,
  onAddSubsection,
  onRemoveSubsection,
  onDropSection,
  onDropSubsection,
  onAddQuestionToSubsection,
  onRemoveQuestion,
  onMoveQuestion,
  onUpdateQuestion,
  formSelfAssessmentEnabled = true,
  ratingBased = false,
  ratingScales = [],
  lockExistingQuestions = false,
}: {
  section: FormSectionInput;
  index: number;
  /** Position of this section in the root layout (for root-level question drops). */
  rootLayoutIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<FormSectionInput>) => void;
  onRemove: () => void;
  onAddQuestion: () => void;
  onAddSubsection: () => void;
  onRemoveSubsection: (subId: string) => void;
  onDropSection: (dragSectionClientId: string, insertIndex: number) => void;
  onDropSubsection: (dragSubsectionClientId: string, sourceSectionClientId: string, insertLayoutIndex: number) => void;
  onAddQuestionToSubsection: (subId: string) => void;
  onRemoveQuestion: (qId: string) => void;
  onMoveQuestion: (questionClientId: string, source: QuestionLocation, target: QuestionLocation) => void;
  onUpdateQuestion: (qId: string, updates: Partial<QuestionInput>) => void;
  formSelfAssessmentEnabled?: boolean;
  ratingBased?: boolean;
  ratingScales?: FormRatingScaleInput[];
  lockExistingQuestions?: boolean;
}) {
  const [sectionDragOver, setSectionDragOver] = useState(false);
  const [headerDragPos, setHeaderDragPos] = useState<"before" | "after" | null>(null);
  const hasTitleError = errors[`section-${index}-title`];
  const hasAnyError = Object.keys(errors).some(k => k.startsWith(`section-${index}`));
  const totalQuestions = section.questions.length + section.subsections.reduce((sum, sub) => sum + sub.questions.length, 0);
  const sectionLocked =
    lockExistingQuestions &&
    (section.questions.some((question) => question.id != null) ||
      section.subsections.some((sub) =>
        sub.questions.some((question) => question.id != null),
      ));

  return (
    <div className={cn(
      "group relative rounded-md border border-l-[3px] shadow-sm transition-all",
      hasAnyError
        ? "border-red-400 border-l-red-500 bg-red-50 dark:border-red-600/50 dark:bg-red-950/30"
        : "border-slate-200 border-l-indigo-500 bg-white hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:border-l-indigo-400 dark:bg-slate-900 dark:hover:border-indigo-400/50"
    )}>
      {headerDragPos === "before" && (
        <div className="pointer-events-none absolute -top-0.5 left-2 right-2 h-0.5 rounded-full bg-primary z-20" />
      )}
      {headerDragPos === "after" && (
        <div className="pointer-events-none absolute -bottom-0.5 left-2 right-2 h-0.5 rounded-full bg-primary z-20" />
      )}
      {/* Section Header */}
      <div
        className={cn(
          "relative flex cursor-pointer items-center gap-3 rounded-t-md bg-indigo-50/90 p-3 dark:bg-indigo-950/40",
          headerDragPos === "before" && "rounded-t-none border-t-2 border-t-primary",
          headerDragPos === "after" && "rounded-b-none border-b-2 border-b-primary"
        )}
        onClick={onToggle}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const rect = e.currentTarget.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          setHeaderDragPos(e.clientY < midpoint ? "before" : "after");
        }}
        onDragLeave={(e) => {
          const relatedTarget = e.relatedTarget as Node | null;
          if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
          setHeaderDragPos(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          const isAfter = e.clientY >= midpoint;
          setHeaderDragPos(null);
          try {
            const data = JSON.parse(e.dataTransfer.getData("application/json"));
            if (data.kind === "section") {
              onDropSection(data.sectionClientId, isAfter ? rootLayoutIndex + 1 : rootLayoutIndex);
            } else if (data.kind === "subsection") {
              // Move subsection into this section (append to end of layout)
              const sectionLayout = buildSectionLayoutOrder(
                section.subsections,
                section.questions,
                section.layout,
              );
              onDropSubsection(data.subsectionClientId, data.sourceSectionClientId, sectionLayout.length);
            } else if (data.questionClientId) {
              // Drop question before/after this section at root level
              onMoveQuestion(data.questionClientId, data.source, {
                sectionClientId: null,
                subsectionClientId: null,
                insertIndex: isAfter ? rootLayoutIndex + 1 : rootLayoutIndex,
              });
            }
          } catch { /* ignore */ }
        }}
      >
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/json", JSON.stringify({ kind: "section", sectionClientId: section.clientId }));
            e.dataTransfer.effectAllowed = "move";
          }}
          className="flex cursor-grab items-center text-indigo-300 hover:text-indigo-600 active:cursor-grabbing dark:text-indigo-600 dark:hover:text-indigo-300"
          title="Drag to move section"
        >
          <GripVertical className="h-5 w-5" />
        </div>
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
            <textarea
              value={section.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                }
              }}
              placeholder="Section Title (Press Enter for new line)"
              rows={1}
              className={cn(
                "w-full resize-y bg-transparent text-sm font-semibold outline-none whitespace-pre-wrap",
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
            {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}
            {section.subsections.length > 0 ? ` · ${section.subsections.length} subsection${section.subsections.length !== 1 ? "s" : ""}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onAddSubsection(); }}
            className="rounded p-1.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-800/40 dark:hover:text-indigo-200"
            title="Add subsection"
          >
            <Layers className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAddQuestion(); }}
            className="rounded p-1.5 text-sky-400 hover:bg-sky-100 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-800/40 dark:hover:text-sky-200"
            title="Add question"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            disabled={sectionLocked}
            className="rounded p-1.5 text-indigo-400 hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-indigo-400 dark:text-indigo-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title={
              sectionLocked
                ? "Cannot delete a section with questions after submissions exist"
                : "Delete section"
            }
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
        <div className="border-t border-indigo-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          {hasTitleError && (
            <p className="mb-3 flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" /> {hasTitleError}
            </p>
          )}

          {/* Interleaved section children — subsections and direct questions
              rendered in creation order using the section layout. */}
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
                const sectionLayout = buildSectionLayoutOrder(
                  section.subsections,
                  section.questions,
                  section.layout,
                );
                if (data.kind === "subsection") {
                  // Move subsection into this section (append to end of layout)
                  onDropSubsection(data.subsectionClientId, data.sourceSectionClientId, sectionLayout.length);
                } else if (data.questionClientId) {
                  // Move question as direct section question (append to end of layout)
                  onMoveQuestion(data.questionClientId, data.source, {
                    sectionClientId: section.clientId,
                    subsectionClientId: null,
                    insertIndex: sectionLayout.length,
                  });
                }
              } catch { /* ignore */ }
            }}
            className={cn(
              "space-y-3 rounded-lg transition-all",
              sectionDragOver && "ring-2 ring-primary/40 bg-primary/5"
            )}
          >
            {(() => {
              const sectionLayout = buildSectionLayoutOrder(
                section.subsections,
                section.questions,
                section.layout,
              );
              let qCounter = 0;
              let subCounter = 0;

              if (sectionLayout.length === 0) {
                return (
                  <div className="rounded-lg border border-dashed border-indigo-200 py-6 text-center dark:border-indigo-500/30">
                    <p className="text-xs text-indigo-400 dark:text-indigo-400/70">No questions or subsections yet — add using the buttons below</p>
                  </div>
                );
              }

              return sectionLayout.map((item, layoutIdx) => {
                if (item.kind === "subsection") {
                  const sub = section.subsections.find(s => s.clientId === item.clientId);
                  if (!sub) return null;
                  const subIndex = subCounter++;

                  return (
                    <SubsectionCard
                      key={sub.clientId}
                      subsection={sub}
                      subsectionIndex={subIndex}
                      layoutIndex={layoutIdx}
                      sectionIndex={index}
                      sectionClientId={section.clientId}
                      errors={errors}
                      onUpdate={(updates) => onUpdate({
                        subsections: section.subsections.map(s => s.clientId === sub.clientId ? { ...s, ...updates } : s),
                      })}
                      onRemove={() => onRemoveSubsection(sub.clientId)}
                      onAddQuestion={() => onAddQuestionToSubsection(sub.clientId)}
                      onRemoveQuestion={onRemoveQuestion}
                      onUpdateQuestion={onUpdateQuestion}
                      onMoveQuestion={onMoveQuestion}
                      onDropSubsection={(dragSubsectionClientId, sourceSectionClientId, insertLayoutIndex) =>
                        onDropSubsection(dragSubsectionClientId, sourceSectionClientId, insertLayoutIndex)
                      }
                      formSelfAssessmentEnabled={formSelfAssessmentEnabled}
                      ratingBased={ratingBased}
                      ratingScales={ratingScales}
                      lockExistingQuestions={lockExistingQuestions}
                    />
                  );
                }

                const question = section.questions.find(q => q.clientId === item.clientId);
                if (!question) return null;
                const qIdx = qCounter++;

                return (
                  <QuestionCard
                    key={question.clientId}
                    question={question}
                    index={qIdx}
                    layoutIndex={layoutIdx}
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
                    onDropSubsection={(dragSubsectionClientId, sourceSectionClientId, insertLayoutIndex) =>
                      onDropSubsection(dragSubsectionClientId, sourceSectionClientId, insertLayoutIndex)
                    }
                    compact
                    formSelfAssessmentEnabled={formSelfAssessmentEnabled}
                    ratingBased={ratingBased}
                    ratingScales={ratingScales}
                    lockExistingQuestions={lockExistingQuestions}
                  />
                );
              });
            })()}
          </div>

          {/* Action Bar */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={onAddSubsection}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-amber-300 px-3 py-2 text-xs font-medium text-amber-600 transition-all hover:border-amber-500 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-500/40 dark:text-amber-300 dark:hover:border-amber-400 dark:hover:bg-amber-900/30"
            >
              <Layers className="h-3.5 w-3.5" />
              Add Subsection
            </button>
            <button
              onClick={onAddQuestion}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-sky-300 px-3 py-2 text-xs font-medium text-sky-600 transition-all hover:border-sky-500 hover:bg-sky-50 hover:text-sky-700 dark:border-sky-500/40 dark:text-sky-300 dark:hover:border-sky-400 dark:hover:bg-sky-900/30"
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
  layoutIndex,
  errorPrefix,
  errors,
  sourceLocation,
  onRemove,
  onChange,
  onDropQuestion,
  onDropSubsection,
  onDropSection,
  formSelfAssessmentEnabled = true,
  ratingBased = false,
  ratingScales = [],
  lockExistingQuestions = false,
}: {
  question: QuestionInput;
  index: number;
  /** Position in the interleaved layout (for section context). Defaults to `index`. */
  layoutIndex?: number;
  errorPrefix: string;
  errors: Record<string, string>;
  sourceLocation: QuestionLocation;
  onRemove: () => void;
  onChange: (updates: Partial<QuestionInput>) => void;
  onDropQuestion?: (dragData: { questionClientId: string; source: QuestionLocation }, insertIndex: number) => void;
  onDropSubsection?: (dragSubsectionClientId: string, sourceSectionClientId: string, insertIndex: number) => void;
  onDropSection?: (dragSectionClientId: string, insertIndex: number) => void;
  compact?: boolean;
  formSelfAssessmentEnabled?: boolean;
  ratingBased?: boolean;
  ratingScales?: FormRatingScaleInput[];
  lockExistingQuestions?: boolean;
}) {
  const textError = errors[errorPrefix];
  const typeError = errors[`${errorPrefix}-type`];
  const marksError = errors[`${errorPrefix}-marks`];
  const scaleError = errors[`${errorPrefix}-scale`];
  const hasError = textError || typeError || marksError || scaleError;
  const showOptions = questionNeedsOptions(question.inputType);
  const [dragOverPos, setDragOverPos] = useState<"before" | "after" | null>(null);
  const dropLayoutIndex = layoutIndex ?? index;
  const canAcceptDrop = !!(onDropQuestion || onDropSubsection || onDropSection);
  const questionLocked = lockExistingQuestions && question.id != null;

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
        if (!canAcceptDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        setDragOverPos(e.clientY < midpoint ? "before" : "after");
      }}
      onDragLeave={(e) => {
        if (!canAcceptDrop) return;
        const relatedTarget = e.relatedTarget as Node | null;
        if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
        setDragOverPos(null);
      }}
      onDrop={(e) => {
        if (!canAcceptDrop) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isAfter = e.clientY >= midpoint;
        const insertIndex = isAfter ? dropLayoutIndex + 1 : dropLayoutIndex;
        setDragOverPos(null);
        try {
          const data = JSON.parse(e.dataTransfer.getData("application/json"));
          if (data.kind === "subsection" && onDropSubsection) {
            onDropSubsection(data.subsectionClientId, data.sourceSectionClientId, insertIndex);
          } else if (data.kind === "section" && onDropSection) {
            onDropSection(data.sectionClientId, insertIndex);
          } else if (data.questionClientId && onDropQuestion) {
            onDropQuestion(data, insertIndex);
          }
        } catch { /* ignore */ }
      }}
      className={cn(
      "group relative rounded-lg border border-l-[3px] p-3 shadow-sm transition-all",
      hasError
        ? "border-red-300 border-l-red-500 bg-red-50/80 dark:border-red-700/50 dark:bg-red-950/20"
        : "border-slate-200 border-l-sky-500 bg-white hover:border-sky-300 hover:shadow-md dark:border-slate-700 dark:border-l-sky-400 dark:bg-slate-900 dark:hover:border-sky-500/50",
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
          className="mt-1 flex cursor-grab items-center text-sky-300 hover:text-sky-600 active:cursor-grabbing dark:text-sky-600 dark:hover:text-sky-300"
          title="Drag to move question"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-sky-200 text-[10px] font-bold text-sky-800 dark:bg-sky-800/50 dark:text-sky-200">
          {index + 1}
        </div>
        
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <AutoGrowTextarea
              value={question.questionText}
              onChange={(value) => onChange({ questionText: value })}
              onKeyDown={(e) => {
                // Enter inserts a new line; Shift+Enter also inserts a new line.
                // No special handling needed — textarea handles newlines natively.
                // Stop event bubbling so parent onKeyDown handlers (e.g. section
                // collapse on Enter) don't interfere while typing.
                if (e.key === "Enter") {
                  e.stopPropagation();
                }
              }}
              placeholder="Enter question text... (Press Enter for new line)"
              className={cn(
                "min-h-8 flex-1 bg-transparent text-sm outline-none whitespace-pre-wrap",
                textError ? "text-red-700 placeholder:text-red-400 dark:text-red-400 dark:placeholder:text-red-500" : "text-slate-800 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
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
                  "w-20 shrink-0 self-start rounded border px-2 py-1 text-right text-xs outline-none bg-white/70 dark:bg-slate-900/50",
                  marksError
                    ? "border-red-400 text-red-700 dark:border-red-700 dark:text-red-400"
                    : "border-sky-200 text-sky-800 dark:border-sky-600/40 dark:text-sky-100"
                )}
              />
            )}
          </div>

          <div className={cn(
            "flex flex-wrap items-end gap-3",
          )}>
            <div className="w-40 shrink-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                Question Type
              </label>
              <select
                value={question.inputType}
                onChange={(e) =>
                  onChange(applyQuestionInputTypeChange(question, e.target.value as QuestionInput["inputType"]))
                }
                className={cn(
                  "h-8 w-full rounded border px-2 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200/40 bg-white/70 dark:bg-slate-900/50 dark:focus:ring-sky-700/30",
                  typeError
                    ? "border-red-400 dark:border-red-700"
                    : "border-sky-200 dark:border-sky-600/40"
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
              <label className="inline-flex items-center gap-1.5 text-xs text-sky-800 dark:text-sky-200">
                <input
                  type="checkbox"
                  checked={question.isRequired}
                  onChange={(e) => onChange({ isRequired: e.target.checked })}
                  className="size-3.5 rounded border-sky-400 text-sky-600 focus:ring-sky-400 dark:border-sky-500 dark:text-sky-400"
                />
                Required
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-sky-800 dark:text-sky-200">
                <input
                  type="checkbox"
                  checked={question.selfAssessmentEnabled}
                  onChange={(e) => onChange({ selfAssessmentEnabled: e.target.checked })}
                  disabled={!formSelfAssessmentEnabled}
                  className="size-3.5 rounded border-sky-400 text-sky-600 focus:ring-sky-400 disabled:opacity-40 dark:border-sky-500 dark:text-sky-400"
                />
                Self Assessment
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-sky-800 dark:text-sky-200">
                <input
                  type="checkbox"
                  checked={question.hodAssessmentEnabled}
                  onChange={(e) => onChange({ hodAssessmentEnabled: e.target.checked })}
                  className="size-3.5 rounded border-sky-400 text-sky-600 focus:ring-sky-400 dark:border-sky-500 dark:text-sky-400"
                />
                HOD Assessment
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-sky-800 dark:text-sky-200">
                <input
                  type="checkbox"
                  checked={question.noMarks}
                  onChange={(e) => handleNoMarksChange(e.target.checked)}
                  className="size-3.5 rounded border-sky-400 text-sky-600 focus:ring-sky-400 dark:border-sky-500 dark:text-sky-400"
                />
                No Marks
              </label>
              {ratingBased && !question.noMarks ? (
                <div className="w-52">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                    Rating dropdown
                  </label>
                  <select
                    value={question.ratingScaleClientId ?? ""}
                    onChange={(e) => {
                      const clientId = e.target.value;
                      const scale = ratingScales.find((item) => item.clientId === clientId);
                      onChange({
                        ratingScaleClientId: clientId,
                        ratingScaleId: scale?.id ?? null,
                      });
                    }}
                    className={cn(
                      "h-8 w-full rounded border px-2 text-xs outline-none bg-white/70 dark:bg-slate-900/50",
                      scaleError
                        ? "border-red-400 dark:border-red-700"
                        : "border-sky-200 dark:border-sky-600/40",
                    )}
                  >
                    <option value="">Select dropdown</option>
                    {ratingScales.map((scale) => (
                      <option key={scale.clientId} value={scale.clientId}>
                        {scale.name || "Untitled dropdown"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
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
          {scaleError && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" /> {scaleError}
            </p>
          )}

          {showOptions && (
            <div className="space-y-1.5 pt-1">
              {question.options.map((option, oIdx) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <div className={cn(
                    "h-3.5 w-3.5 border",
                    question.inputType === "CHECKBOX" ? "rounded-sm" : "rounded-full",
                    "border-sky-300 dark:border-sky-600"
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
                    className="flex-1 bg-transparent text-xs outline-none text-sky-900 placeholder:text-sky-400 dark:text-sky-100 dark:placeholder:text-sky-500"
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
                    className="w-14 rounded border border-sky-200 bg-white/70 px-1.5 py-0.5 text-right text-xs outline-none dark:border-sky-600/40 dark:bg-slate-900/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newOptions = question.options.filter((_, i) => i !== oIdx);
                      onChange({ options: newOptions });
                    }}
                    disabled={lockExistingQuestions && option.id != null}
                    className="text-sky-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-sky-400 dark:text-sky-500 dark:hover:text-red-400"
                    title={
                      lockExistingQuestions && option.id != null
                        ? "Cannot remove an option after submissions exist"
                        : "Remove option"
                    }
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
          disabled={questionLocked}
          className="mt-1 text-sky-400 hover:text-red-600 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-sky-400 dark:text-sky-500 dark:hover:text-red-400"
          title={
            questionLocked
              ? "Cannot remove a question after submissions exist"
              : "Remove question"
          }
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
  submissionCount = 0,
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
  const [code, setCode] = useState(initialState?.code ?? "");
  const [description, setDescription] = useState(initialState?.description ?? "");
  const [selfAssessmentEnabled, setSelfAssessmentEnabled] = useState(initialState?.selfAssessmentEnabled ?? true);
  const [additionalRemarksEnabled, setAdditionalRemarksEnabled] = useState(initialState?.additionalRemarksEnabled ?? false);
  const [scoringMode, setScoringMode] = useState<"absolute" | "rating" | null>(
    initialState ? (initialState.ratingBased ? "rating" : "absolute") : null,
  );
  const ratingBased = scoringMode === "rating";
  const [ratingScales, setRatingScales] = useState<FormRatingScaleInput[]>(
    initialState?.ratingScales.map((scale) => ({
      ...scale,
      id: copyMode ? undefined : scale.id,
      options: scale.options.map((option) => ({
        ...option,
        id: copyMode ? undefined : option.id,
      })),
    })) ?? [],
  );
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
          ratingScaleId: copyMode ? null : q.ratingScaleId,
          options: q.options.map((o) => ({
            ...o,
            id: copyMode ? undefined : o.id,
          })),
        })),
      })),
      questions: section.questions.map((q) => ({
        ...q,
        id: copyMode ? undefined : q.id,
        ratingScaleId: copyMode ? null : q.ratingScaleId,
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
      ratingScaleId: copyMode ? null : q.ratingScaleId,
      options: q.options.map((o) => ({
        ...o,
        id: copyMode ? undefined : o.id,
      })),
    })) ?? [],
  );
  const [cycleId] = useState<number | "">(
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
      code: code.trim(),
      description: description.trim(),
      selfAssessmentEnabled,
      additionalRemarksEnabled,
      ratingBased,
      ratingScales: ratingBased
        ? ratingScales.map((scale) => ({
            ...scale,
            maxValue: deriveRatingScaleMaxValue(scale.options, scale.maxValue),
          }))
        : [],
      sections: normalized.sections,
      questions: normalized.questions,
      ...(cycleId ? { cycleId } : {}),
    };
  }, [
    title,
    code,
    description,
    selfAssessmentEnabled,
    additionalRemarksEnabled,
    ratingBased,
    ratingScales,
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

    if (!code.trim()) {
      nextErrors.code = "Form code is required.";
    }

    if (scoringMode == null) {
      nextErrors.formType = "Select a form type: Absolute score or Rating based.";
    }

    if (countAllQuestions(sections, questions) === 0) {
      nextErrors.questions = "At least one question is required.";
    }

    sections.forEach((section, sectionIndex) => {
      if (!section.title.trim()) {
        nextErrors[`section-${sectionIndex}-title`] = "Section title is required.";
      }

      section.subsections.forEach((subsection, subsectionIndex) => {
        if (!subsection.title.trim()) {
          nextErrors[`section-${sectionIndex}-sub-${subsectionIndex}-title`] = "Subsection title is required.";
        }

        subsection.questions.forEach((question, questionIndex) => {
          validateQuestionFields(
            question,
            `section-${sectionIndex}-sub-${subsectionIndex}-question-${questionIndex}`,
            nextErrors,
            ratingBased,
          );
        });
      });

      section.questions.forEach((question, questionIndex) => {
        validateQuestionFields(
          question,
          `section-${sectionIndex}-question-${questionIndex}`,
          nextErrors,
          ratingBased,
        );
      });
    });

    questions.forEach((question, index) => {
      validateQuestionFields(question, `question-${index}`, nextErrors, ratingBased);
    });

    if (ratingBased) {
      if (ratingScales.length === 0) {
        nextErrors.ratingScales = "Add at least one rating dropdown.";
      }
      ratingScales.forEach((scale, scaleIndex) => {
        if (!scale.name.trim()) {
          nextErrors.ratingScales = `Rating dropdown ${scaleIndex + 1} needs a name.`;
        }
        if (scale.options.length < 2) {
          nextErrors.ratingScales = `Rating dropdown ${scaleIndex + 1} needs at least two options.`;
        }
        scale.options.forEach((option, optionIndex) => {
          if (!option.optionLabel.trim()) {
            nextErrors.ratingScales = `Rating dropdown ${scaleIndex + 1}, option ${optionIndex + 1}: label is required.`;
          }
        });
      });
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

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-white dark:bg-slate-950">
      <header className="flex shrink-0 items-center gap-2 border-b border-indigo-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={() => router.push("/dashboard/forms")}
          className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Back to forms"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {step === 0 ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Form title"
                className={cn(
                  "h-9 w-full rounded-lg border bg-slate-50 px-3 text-sm font-semibold outline-none transition-all placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-2 dark:bg-slate-950",
                  errors.title
                    ? "border-red-300 text-red-800 focus:border-red-500 focus:ring-red-500/20 dark:border-red-800"
                    : "border-slate-200 text-slate-900 focus:border-indigo-400 focus:ring-indigo-500/15 dark:border-slate-700 dark:text-slate-100",
                )}
              />
              {errors.title ? (
                <p className="mt-0.5 truncate text-[11px] text-red-500">{errors.title}</p>
              ) : null}
            </div>
            <div className="w-28 shrink-0 sm:w-36">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code"
                maxLength={50}
                className={cn(
                  "h-9 w-full rounded-lg border bg-slate-50 px-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 dark:bg-slate-950",
                  errors.code
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-800"
                    : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-500/15 dark:border-slate-700 dark:text-slate-100",
                )}
              />
              {errors.code ? (
                <p className="mt-0.5 truncate text-[11px] text-red-500">{errors.code}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
              {title || (templateId ? "Edit Form" : "Create Form")}
            </h1>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {currentStepData.description}
            </p>
          </div>
        )}

        <div className="hidden items-center gap-1 md:flex">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === step;
            const isCompleted = idx < step;

            return (
              <div key={s.id} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:ring-indigo-500/30"
                      : isCompleted
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "text-slate-400",
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  <span>{s.label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="mx-1 h-3.5 w-3.5 text-slate-300 dark:text-slate-700" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              fullWidth={false}
              onClick={goBack}
              disabled={saveMutation.isPending}
              className="h-9 px-3"
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
      </header>

      {templateId && submissionCount > 0 ? (
        <div className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This form has submissions — removing questions is restricted.
            You can still edit question text, options, and add new questions.
          </p>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {step === 0 ? (
          <ModernFormDesignStep
            title={title}
            code={code}
            description={description}
            selfAssessmentEnabled={selfAssessmentEnabled}
            additionalRemarksEnabled={additionalRemarksEnabled}
            ratingBased={ratingBased}
            scoringMode={scoringMode}
            ratingScales={ratingScales}
            sections={sections}
            questions={questions}
            errors={errors}
            onDescriptionChange={setDescription}
            onAdditionalRemarksEnabledChange={setAdditionalRemarksEnabled}
            onScoringModeChange={(mode) => {
              setScoringMode(mode);
              if (mode === "absolute") {
                return;
              }
              const nextScales =
                ratingScales.length === 0
                  ? [createEmptyRatingScale(0)]
                  : ratingScales;
              if (ratingScales.length === 0) {
                setRatingScales(nextScales);
              }
              const assignScale = (question: QuestionInput) =>
                applyDefaultRatingScale(question, true, nextScales);
              setQuestions((current) => current.map(assignScale));
              setSections((current) =>
                current.map((section) => ({
                  ...section,
                  questions: section.questions.map(assignScale),
                  subsections: section.subsections.map((subsection) => ({
                    ...subsection,
                    questions: subsection.questions.map(assignScale),
                  })),
                })),
              );
            }}
            onRatingScalesChange={setRatingScales}
            onStructureChange={handleStructureChange}
            lockExistingQuestions={submissionCount > 0}
          />
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            {savedTemplateId ? (
              <FormEmployeeAssignment
                templateId={savedTemplateId}
                templateTitle={title}
                templateCode={code}
              />
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