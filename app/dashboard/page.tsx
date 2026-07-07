"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFinancialYears } from "@/lib/queries/financial-years-client";
import { fetchPerformanceMatrix } from "@/lib/queries/performance-matrices-client";
import { fetchStaffCategoriesWithSubCategories } from "@/lib/queries/staff-categories-client";
import { fetchEntities } from "@/lib/queries/entities-client";
import { fetchFormSubmissions } from "@/lib/queries/form-submissions-client";
import Link from "next/link";
import {
  buildQuartileBandsFromMatrix,
  getMatrixQuartileColumnHeaders,
  sortPerformanceMatrix,
  type MatrixQuartileColumn,
} from "@/lib/performance-matrix";
import { resolvePerformanceQuartile } from "@/lib/performance-rating";
import {
  formatPerformanceScore,
  type PerformanceLevelWithQuartiles,
} from "@/types/performance-matrices";
import type { StaffCategoryWithSubCategories } from "@/types/staff-categories";
import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import {
  APPRAISAL_STATUSES,
  RATING_LABELS,
  type AppraisalStatus,
} from "@/types/forms";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Cell,
  PieChart,
  Pie,
  LabelList,
} from "recharts";
import {
  AlertTriangle,
  Scale,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  User,
  Building2,
  Layers,
  Hash,
  Award,
  ArrowRight,
  X,
  SlidersHorizontal,
  RotateCcw,
  BarChart3,
  Users,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────
   Types — Corrected Taxonomy
   ────────────────────────────────────────────── */
type EmployeeCategory = "Academic" | "Administrative" | "Support Staff" | "Blue-Collar" | "Management";
type FormState = "DRAFT" | "PENDING_SELF_ASSESSMENT" | "PENDING_HEAD_REVIEW" | "PENDING_HR_CALIBRATION" | "PENDING_BOARD_APPROVAL" | "APPROVED" | "REJECTED" | "ARCHIVED";

type Employee = {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  function: string;        // e.g., "Teaching & Learning", "Student Affairs", "Facilities"
  subFunction: string;     // e.g., "Computer Science Dept", "Registrar Office", "Maintenance"
  entityId?: number;
  entityName?: string;
  category: EmployeeCategory;
  subCategory: string;
  staffCategoryId?: number;
  staffSubCategoryId?: number;
  rawScore: number;
  initialRating: string;
  calibratedRating: string | null;
  formState: FormState;
  template: string;
  approvedIncrement: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};

/* ──────────────────────────────────────────────
   Mock Data — Diverse University Staff
   ────────────────────────────────────────────── */
const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "1",
    name: "Dr. Ayesha Khan",
    employeeId: "EMP-2024-001",
    email: "ayesha.khan@uol.edu.pk",
    function: "Teaching & Learning",
    subFunction: "Computer Science",
    category: "Academic",
    subCategory: "Professor",
    rawScore: 87,
    initialRating: "Outstanding",
    calibratedRating: "Excellent",
    formState: "APPROVED",
    template: "2026 Academic Performance Template",
    approvedIncrement: 12.5,
    submittedAt: "2026-03-15",
    reviewedAt: "2026-04-20",
  },
  {
    id: "2",
    name: "Mr. Bilal Ahmed",
    employeeId: "EMP-2024-045",
    email: "bilal.ahmed@uol.edu.pk",
    function: "Teaching & Learning",
    subFunction: "Electrical Engineering",
    category: "Academic",
    subCategory: "Associate Professor",
    rawScore: 72,
    initialRating: "Excellent",
    calibratedRating: null,
    formState: "PENDING_HR_CALIBRATION",
    template: "2026 Academic Performance Template",
    approvedIncrement: null,
    submittedAt: "2026-03-20",
    reviewedAt: null,
  },
  {
    id: "3",
    name: "Ms. Sara Malik",
    employeeId: "EMP-2024-112",
    email: "sara.malik@uol.edu.pk",
    function: "Student Affairs",
    subFunction: "Registrar Office",
    category: "Administrative",
    subCategory: "Senior Officer",
    rawScore: 65,
    initialRating: "Good",
    calibratedRating: null,
    formState: "PENDING_HEAD_REVIEW",
    template: "2026 Administrative Staff Template",
    approvedIncrement: null,
    submittedAt: "2026-03-18",
    reviewedAt: null,
  },
  {
    id: "4",
    name: "Mr. Imran Hussain",
    employeeId: "EMP-2024-203",
    email: "imran.h@uol.edu.pk",
    function: "Facilities Management",
    subFunction: "Building Maintenance",
    category: "Blue-Collar",
    subCategory: "Senior Technician",
    rawScore: 58,
    initialRating: "Satisfactory",
    calibratedRating: null,
    formState: "PENDING_SELF_ASSESSMENT",
    template: "2026 Blue-Collar Template",
    approvedIncrement: null,
    submittedAt: null,
    reviewedAt: null,
  },
  {
    id: "5",
    name: "Dr. Fatima Raza",
    employeeId: "EMP-2024-089",
    email: "fatima.raza@uol.edu.pk",
    function: "Teaching & Learning",
    subFunction: "Pharmacy",
    category: "Academic",
    subCategory: "Professor",
    rawScore: 91,
    initialRating: "Outstanding",
    calibratedRating: "Outstanding",
    formState: "PENDING_BOARD_APPROVAL",
    template: "2026 Academic Performance Template",
    approvedIncrement: 15.0,
    submittedAt: "2026-03-10",
    reviewedAt: "2026-04-15",
  },
  {
    id: "6",
    name: "Mr. Usman Tariq",
    employeeId: "EMP-2024-156",
    email: "usman.t@uol.edu.pk",
    function: "Teaching & Learning",
    subFunction: "Business Administration",
    category: "Academic",
    subCategory: "Lecturer",
    rawScore: 45,
    initialRating: "Unsatisfactory",
    calibratedRating: null,
    formState: "PENDING_HEAD_REVIEW",
    template: "2026 Academic Performance Template",
    approvedIncrement: null,
    submittedAt: "2026-03-22",
    reviewedAt: null,
  },
  {
    id: "7",
    name: "Ms. Nadia Sheikh",
    employeeId: "EMP-2024-078",
    email: "nadia.s@uol.edu.pk",
    function: "Finance & Administration",
    subFunction: "Accounts Department",
    category: "Administrative",
    subCategory: "Finance Officer",
    rawScore: 78,
    initialRating: "Excellent",
    calibratedRating: "Excellent",
    formState: "APPROVED",
    template: "2026 Administrative Staff Template",
    approvedIncrement: 9.5,
    submittedAt: "2026-03-12",
    reviewedAt: "2026-04-18",
  },
  {
    id: "8",
    name: "Mr. Kamran Ali",
    employeeId: "EMP-2024-334",
    email: "kamran.ali@uol.edu.pk",
    function: "Facilities Management",
    subFunction: "Grounds & Landscaping",
    category: "Blue-Collar",
    subCategory: "Gardener",
    rawScore: 62,
    initialRating: "Good",
    calibratedRating: null,
    formState: "PENDING_SELF_ASSESSMENT",
    template: "2026 Blue-Collar Template",
    approvedIncrement: null,
    submittedAt: null,
    reviewedAt: null,
  },
  {
    id: "9",
    name: "Dr. Hassan Raza",
    employeeId: "EMP-2024-201",
    email: "hassan.r@uol.edu.pk",
    function: "Research & Development",
    subFunction: "Research Coordination",
    category: "Management",
    subCategory: "Director Research",
    rawScore: 88,
    initialRating: "Outstanding",
    calibratedRating: "Outstanding",
    formState: "APPROVED",
    template: "2026 Management Template",
    approvedIncrement: 14.0,
    submittedAt: "2026-03-08",
    reviewedAt: "2026-04-10",
  },
  {
    id: "10",
    name: "Ms. Amina Farooq",
    employeeId: "EMP-2024-445",
    email: "amina.f@uol.edu.pk",
    function: "Student Affairs",
    subFunction: "Career Services",
    category: "Support Staff",
    subCategory: "Counselor",
    rawScore: 70,
    initialRating: "Good",
    calibratedRating: null,
    formState: "PENDING_HR_CALIBRATION",
    template: "2026 Support Staff Template",
    approvedIncrement: null,
    submittedAt: "2026-03-25",
    reviewedAt: null,
  },
];

/* ──────────────────────────────────────────────
   Chart Data (legacy mock — kept for reference charts)
   ────────────────────────────────────────────── */
const functionPerformance = [
  { function: "Teaching & Learning", avgScore: 82, headcount: 45 },
  { function: "Student Affairs", avgScore: 71, headcount: 12 },
  { function: "Facilities Mgmt", avgScore: 65, headcount: 28 },
  { function: "Finance & Admin", avgScore: 78, headcount: 18 },
  { function: "Research & Dev", avgScore: 88, headcount: 8 },
];

const categoryDistribution = [
  { name: "Academic", light: "#0f172a", dark: "#60a5fa" },
  { name: "Administrative", light: "#d97706", dark: "#fbbf24" },
  { name: "Support Staff", light: "#64748b", dark: "#94a3b8" },
  { name: "Blue-Collar", light: "#059669", dark: "#34d399" },
  { name: "Management", light: "#7c3aed", dark: "#a78bfa" },
] as const;

const CATEGORY_COLOR_PALETTE = categoryDistribution.map(({ light, dark }) => ({
  light,
  dark,
}));

function getStaffCategoryNames(
  submissions: FormSubmissionListItem[],
  staffCategories: StaffCategoryWithSubCategories[],
): string[] {
  if (staffCategories.length > 0) {
    return staffCategories.map((category) => category.name);
  }

  return [...new Set(
    submissions
      .map((submission) => submission.staffCategoryName)
      .filter((name): name is string => Boolean(name)),
  )].sort();
}

function buildSubmissionCategoryCounts(
  submissions: FormSubmissionListItem[],
  staffCategories: StaffCategoryWithSubCategories[],
  isDarkMode: boolean,
) {
  const categoryNames = getStaffCategoryNames(submissions, staffCategories);

  return categoryNames
    .map((name, index) => {
      const palette = CATEGORY_COLOR_PALETTE[index % CATEGORY_COLOR_PALETTE.length];

      return {
        name,
        value: submissions.filter((submission) => submission.staffCategoryName === name).length,
        color: isDarkMode ? palette.dark : palette.light,
      };
    })
    .filter((entry) => entry.value > 0);
}

function buildSubmissionCompletionByCategory(
  submissions: FormSubmissionListItem[],
  staffCategories: StaffCategoryWithSubCategories[],
) {
  const categoryNames = getStaffCategoryNames(submissions, staffCategories).filter((name) =>
    submissions.some((submission) => submission.staffCategoryName === name),
  );

  return categoryNames.map((category) => {
    const inCategory = submissions.filter(
      (submission) => submission.staffCategoryName === category,
    );
    const total = inCategory.length || 1;

    const countStatuses = (statuses: AppraisalStatus[]) =>
      inCategory.filter((submission) => statuses.includes(submission.status)).length;

    return {
      category,
      draft: 0,
      selfAssessment: Math.round(
        (countStatuses(["PENDING_SELF_ASSESSMENT"]) / total) * 100,
      ),
      headReview: Math.round((countStatuses(["PENDING_HEAD_REVIEW"]) / total) * 100),
      hrCalibration: Math.round(
        (countStatuses(["PENDING_HR_CALIBRATION"]) / total) * 100,
      ),
      approved: Math.round(
        (countStatuses(["APPROVED", "PENDING_BOARD_APPROVAL", "COMPLETED"]) / total) *
          100,
      ),
      rejected: 0,
    };
  });
}

const INSTITUTIONAL_QUOTA = [
  { rating: "Unsatisfactory", quota: 5 },
  { rating: "Improvement Needed", quota: 10 },
  { rating: "Strong", quota: 25 },
  { rating: "Excellent", quota: 20 },
  { rating: "Outstanding", quota: 5 },
];

function createMockPerformanceMatrix(): PerformanceLevelWithQuartiles[] {
  const levelDefs = [
    { name: "Unsatisfactory", sortOrder: 0, scoreMin: 0, scoreMax: 39 },
    { name: "Improvement Needed", sortOrder: 1, scoreMin: 40, scoreMax: 54 },
    { name: "Strong", sortOrder: 2, scoreMin: 55, scoreMax: 69 },
    { name: "Excellent", sortOrder: 3, scoreMin: 70, scoreMax: 84 },
    { name: "Outstanding", sortOrder: 4, scoreMin: 85, scoreMax: 100 },
  ];

  return levelDefs.map((levelDef, levelIndex) => {
    const levelId = levelIndex + 1;
    const bandSize = (levelDef.scoreMax - levelDef.scoreMin + 1) / 4;

    return {
      id: levelId,
      financialYearId: 1,
      name: levelDef.name,
      sortOrder: levelDef.sortOrder,
      createdAt: "",
      updatedAt: "",
      quartiles: Array.from({ length: 4 }, (_, quartileIndex) => {
        const scoreMin =
          quartileIndex === 0
            ? levelDef.scoreMin
            : Math.ceil(levelDef.scoreMin + quartileIndex * bandSize);
        const scoreMax =
          quartileIndex === 3
            ? levelDef.scoreMax
            : Math.floor(levelDef.scoreMin + (quartileIndex + 1) * bandSize - 1);

        return {
          id: levelId * 10 + quartileIndex + 1,
          performanceLevelId: levelId,
          name: `Q${quartileIndex + 1}`,
          scoreMin,
          scoreMax,
          sortOrder: quartileIndex,
          createdAt: "",
          updatedAt: "",
        };
      }),
    };
  });
}

const MOCK_PERFORMANCE_MATRIX = createMockPerformanceMatrix();

const ALL_EMPLOYEE_CATEGORIES: EmployeeCategory[] = [
  "Academic",
  "Administrative",
  "Support Staff",
  "Blue-Collar",
  "Management",
];

const RATING_NORMALIZE: Record<string, string> = {
  Unsatisfactory: "Unsatisfactory",
  "Improvement Needed": "Improvement Needed",
  Satisfactory: "Improvement Needed",
  Good: "Strong",
  Strong: "Strong",
  Excellent: "Excellent",
  Outstanding: "Outstanding",
};

function getEffectiveRating(employee: Employee): string {
  return employee.calibratedRating || employee.initialRating;
}

function normalizeRating(rating: string): string {
  return RATING_NORMALIZE[rating] ?? "Strong";
}

function getEntityDescendantIds(
  rootId: number,
  entities: EntityRecord[],
): Set<number> {
  const descendants = new Set<number>();
  const childrenByParent = new Map<number, number[]>();

  entities.forEach((entity) => {
    if (entity.parentEntityId !== null) {
      const siblings = childrenByParent.get(entity.parentEntityId) ?? [];
      siblings.push(entity.id);
      childrenByParent.set(entity.parentEntityId, siblings);
    }
  });

  const stack = [rootId];

  while (stack.length > 0) {
    const current = stack.pop()!;

    for (const childId of childrenByParent.get(current) ?? []) {
      descendants.add(childId);
      stack.push(childId);
    }
  }

  return descendants;
}

function matchesEntityFilter(
  employee: Employee,
  selectedEntityId: number | "ALL",
  entities: EntityRecord[],
): boolean {
  if (selectedEntityId === "ALL") {
    return true;
  }

  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId);

  if (!selectedEntity) {
    return false;
  }

  if (employee.entityId === selectedEntityId) {
    return true;
  }

  const descendantIds = getEntityDescendantIds(selectedEntityId, entities);

  if (employee.entityId != null && descendantIds.has(employee.entityId)) {
    return true;
  }

  if (
    employee.entityName === selectedEntity.name ||
    employee.function === selectedEntity.name ||
    employee.subFunction === selectedEntity.name
  ) {
    return true;
  }

  const descendantNames = [...descendantIds]
    .map((id) => entities.find((entity) => entity.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return descendantNames.includes(employee.subFunction);
}

function matchesSubmissionEntityFilter(
  submission: FormSubmissionListItem,
  selectedEntityId: number | "ALL",
  entities: EntityRecord[],
): boolean {
  if (selectedEntityId === "ALL") {
    return true;
  }

  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId);

  if (!selectedEntity) {
    return false;
  }

  if (submission.entityId === selectedEntityId) {
    return true;
  }

  const descendantIds = getEntityDescendantIds(selectedEntityId, entities);

  if (submission.entityId != null && descendantIds.has(submission.entityId)) {
    return true;
  }

  return (
    submission.entityName === selectedEntity.name ||
    submission.parentEntityName === selectedEntity.name
  );
}

function matchesAppraisalFormState(
  submissionStatus: AppraisalStatus,
  selectedFormState: FormState | "ALL",
): boolean {
  if (selectedFormState === "ALL") {
    return true;
  }

  return APPRAISAL_STATUSES.includes(selectedFormState as AppraisalStatus) &&
    submissionStatus === selectedFormState;
}

function getSubmissionDisplayRating(submission: FormSubmissionListItem): string {
  if (submission.calibratedRating) {
    return RATING_LABELS[submission.calibratedRating];
  }

  if (submission.initialRating) {
    return RATING_LABELS[submission.initialRating];
  }

  return submission.performanceLevelName ?? "—";
}

function matchesSubmissionFilters(
  submission: FormSubmissionListItem,
  filters: {
    searchQuery: string;
    selectedEntityId: number | "ALL";
    selectedCategoryId: number | "ALL";
    selectedSubCategoryId: number | "ALL";
    selectedFormState: FormState | "ALL";
    staffCategories: StaffCategoryWithSubCategories[];
    entities: EntityRecord[];
  },
): boolean {
  const query = filters.searchQuery.toLowerCase();
  const matchesSearch =
    !filters.searchQuery ||
    submission.employeeName.toLowerCase().includes(query) ||
    submission.employeeId.toLowerCase().includes(query) ||
    submission.employeeEmail.toLowerCase().includes(query);

  const matchesEntity = matchesSubmissionEntityFilter(
    submission,
    filters.selectedEntityId,
    filters.entities,
  );

  const selectedCategory =
    filters.selectedCategoryId === "ALL"
      ? null
      : filters.staffCategories.find((category) => category.id === filters.selectedCategoryId);
  const selectedSubCategory =
    filters.selectedSubCategoryId === "ALL"
      ? null
      : filters.staffCategories
          .flatMap((category) =>
            category.subCategories.map((subCategory) => ({
              ...subCategory,
              staffCategoryId: category.id,
            })),
          )
          .find((subCategory) => subCategory.id === filters.selectedSubCategoryId);

  const matchesCategory =
    filters.selectedCategoryId === "ALL" ||
    submission.staffCategoryId === filters.selectedCategoryId ||
    (selectedCategory != null && submission.staffCategoryName === selectedCategory.name);
  const matchesSubCategory =
    filters.selectedSubCategoryId === "ALL" ||
    submission.staffSubCategoryId === filters.selectedSubCategoryId ||
    (selectedSubCategory != null &&
      submission.staffSubCategoryName === selectedSubCategory.name);
  const matchesFormState = matchesAppraisalFormState(
    submission.status,
    filters.selectedFormState,
  );

  return (
    matchesSearch &&
    matchesEntity &&
    matchesCategory &&
    matchesSubCategory &&
    matchesFormState
  );
}

function matchesEmployeeFilters(
  employee: Employee,
  filters: {
    searchQuery: string;
    selectedEntityId: number | "ALL";
    selectedCategoryId: number | "ALL";
    selectedSubCategoryId: number | "ALL";
    selectedFormState: FormState | "ALL";
    staffCategories: StaffCategoryWithSubCategories[];
    entities: EntityRecord[];
  },
): boolean {
  const query = filters.searchQuery.toLowerCase();
  const matchesSearch =
    !filters.searchQuery ||
    employee.name.toLowerCase().includes(query) ||
    employee.employeeId.toLowerCase().includes(query) ||
    employee.email.toLowerCase().includes(query);
  const matchesEntity = matchesEntityFilter(
    employee,
    filters.selectedEntityId,
    filters.entities,
  );

  const selectedCategory =
    filters.selectedCategoryId === "ALL"
      ? null
      : filters.staffCategories.find((category) => category.id === filters.selectedCategoryId);
  const selectedSubCategory =
    filters.selectedSubCategoryId === "ALL"
      ? null
      : filters.staffCategories
        .flatMap((category) =>
          category.subCategories.map((subCategory) => ({
            ...subCategory,
            staffCategoryId: category.id,
          })),
        )
        .find((subCategory) => subCategory.id === filters.selectedSubCategoryId);

  const matchesCategory =
    filters.selectedCategoryId === "ALL" ||
    employee.staffCategoryId === filters.selectedCategoryId ||
    (selectedCategory != null && employee.category === selectedCategory.name);
  const matchesSubCategory =
    filters.selectedSubCategoryId === "ALL" ||
    employee.staffSubCategoryId === filters.selectedSubCategoryId ||
    (selectedSubCategory != null && employee.subCategory === selectedSubCategory.name);

  const matchesFormState =
    filters.selectedFormState === "ALL" || employee.formState === filters.selectedFormState;

  return (
    matchesSearch &&
    matchesEntity &&
    matchesCategory &&
    matchesSubCategory &&
    matchesFormState
  );
}

function buildCalibrationData(employees: Employee[]) {
  const total = employees.length;
  const counts = new Map(INSTITUTIONAL_QUOTA.map((row) => [row.rating, 0]));

  employees.forEach((employee) => {
    const bucket = normalizeRating(getEffectiveRating(employee));
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  });

  return INSTITUTIONAL_QUOTA.map((row) => ({
    rating: row.rating,
    quota: row.quota,
    actual: total === 0 ? 0 : Math.round(((counts.get(row.rating) ?? 0) / total) * 100),
  }));
}

type RatingQuartileMatrixCell = {
  id: number | null;
  label: string;
  sortOrder: number;
  sublabel: string;
  count: number | null;
};

type RatingQuartileMatrixRow = {
  levelId: number;
  rating: string;
  sortOrder: number;
  quartiles: RatingQuartileMatrixCell[];
  rowTotal: number;
};

type RatingQuartileMatrixData = {
  rows: RatingQuartileMatrixRow[];
  columns: MatrixQuartileColumn[];
};

function buildRatingQuartileMatrix(
  employees: Employee[],
  matrix: PerformanceLevelWithQuartiles[],
): RatingQuartileMatrixData {
  const sortedMatrix = sortPerformanceMatrix(matrix);
  const columns = getMatrixQuartileColumnHeaders(sortedMatrix);
  const bands = buildQuartileBandsFromMatrix(sortedMatrix);
  const counts = new Map<string, number>();

  sortedMatrix.forEach((level) => {
    level.quartiles.forEach((quartile) => {
      counts.set(`${level.id}-${quartile.id}`, 0);
    });
  });

  employees.forEach((employee) => {
    const resolved = resolvePerformanceQuartile(employee.rawScore, bands);

    if (resolved) {
      const key = `${resolved.performanceLevelId}-${resolved.quartileId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });

  const rows = sortedMatrix.map((level) => {
    const quartiles = columns.map((column) => {
      const quartile = level.quartiles[column.index];

      if (!quartile) {
        return {
          id: null,
          label: column.label,
          sortOrder: column.sortOrder,
          sublabel: "",
          count: null,
        };
      }

      return {
        id: quartile.id,
        label: quartile.name,
        sortOrder: quartile.sortOrder,
        sublabel: `${formatPerformanceScore(quartile.scoreMin)} – ${formatPerformanceScore(quartile.scoreMax)}`,
        count: counts.get(`${level.id}-${quartile.id}`) ?? 0,
      };
    });

    return {
      levelId: level.id,
      rating: level.name,
      sortOrder: level.sortOrder,
      quartiles,
      rowTotal: quartiles.reduce((sum, cell) => sum + (cell.count ?? 0), 0),
    };
  });

  return { rows, columns };
}

function buildCompletionByCategory(employees: Employee[]) {
  const categories =
    employees.length > 0
      ? ALL_EMPLOYEE_CATEGORIES.filter((category) =>
        employees.some((employee) => employee.category === category),
      )
      : ALL_EMPLOYEE_CATEGORIES;

  return categories.map((category) => {
    const inCategory = employees.filter((employee) => employee.category === category);
    const total = inCategory.length || 1;

    const countStates = (states: FormState[]) =>
      inCategory.filter((employee) => states.includes(employee.formState)).length;

    return {
      category,
      draft: Math.round((countStates(["DRAFT"]) / total) * 100),
      selfAssessment: Math.round((countStates(["PENDING_SELF_ASSESSMENT"]) / total) * 100),
      headReview: Math.round((countStates(["PENDING_HEAD_REVIEW"]) / total) * 100),
      hrCalibration: Math.round((countStates(["PENDING_HR_CALIBRATION"]) / total) * 100),
      approved: Math.round(
        (countStates(["APPROVED", "PENDING_BOARD_APPROVAL"]) / total) * 100,
      ),
      rejected: Math.round((countStates(["REJECTED"]) / total) * 100),
    };
  });
}

function buildCategoryCounts(employees: Employee[]) {
  return categoryDistribution
    .map((entry) => ({
      ...entry,
      value: employees.filter((employee) => employee.category === entry.name).length,
    }))
    .filter((entry) => entry.value > 0);
}

type EligibilityStatus = "Fully Eligible" | "Partially Eligible" | "Not Eligible";

const ELIGIBILITY_CONFIG: Record<
  EligibilityStatus,
  { light: string; dark: string }
> = {
  "Fully Eligible": { light: "#059669", dark: "#34d399" },
  "Partially Eligible": { light: "#d97706", dark: "#fbbf24" },
  "Not Eligible": { light: "#64748b", dark: "#94a3b8" },
};

function getEligibilityStatus(employee: Employee): EligibilityStatus {
  if (
    employee.formState === "PENDING_HR_CALIBRATION" ||
    employee.formState === "PENDING_BOARD_APPROVAL" ||
    employee.formState === "APPROVED"
  ) {
    return "Fully Eligible";
  }

  if (
    employee.formState === "PENDING_SELF_ASSESSMENT" ||
    employee.formState === "PENDING_HEAD_REVIEW"
  ) {
    return "Partially Eligible";
  }

  return "Not Eligible";
}

function buildEligibilityData(employees: Employee[], isDarkMode: boolean) {
  const counts: Record<EligibilityStatus, number> = {
    "Fully Eligible": 0,
    "Partially Eligible": 0,
    "Not Eligible": 0,
  };

  employees.forEach((employee) => {
    counts[getEligibilityStatus(employee)] += 1;
  });

  return (Object.keys(counts) as EligibilityStatus[]).map((name) => ({
    name,
    value: counts[name],
    color: isDarkMode ? ELIGIBILITY_CONFIG[name].dark : ELIGIBILITY_CONFIG[name].light,
  }));
}

function subscribeToTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getIsDarkMode() {
  return document.documentElement.classList.contains("dark");
}

function getServerDarkMode() {
  return false;
}

function useIsDarkMode() {
  return useSyncExternalStore(subscribeToTheme, getIsDarkMode, getServerDarkMode);
}

/* ──────────────────────────────────────────────
   Animation Variants
   ────────────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as const },
  },
};

/* ──────────────────────────────────────────────
   Form State Config
   ────────────────────────────────────────────── */
const FORM_STATE_CONFIG: Record<
  FormState,
  { label: string; color: string; bg: string; border: string; icon: React.ElementType; phase: number }
> = {
  DRAFT: {
    label: "Draft",
    color: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-200",
    icon: Clock,
    phase: 0,
  },
  PENDING_SELF_ASSESSMENT: {
    label: "Self Assessment",
    color: "text-slate-700",
    bg: "bg-slate-100",
    border: "border-slate-200",
    icon: User,
    phase: 1,
  },
  PENDING_HEAD_REVIEW: {
    label: "Function Head Review",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: AlertTriangle,
    phase: 2,
  },
  PENDING_HR_CALIBRATION: {
    label: "HR Calibration",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: Scale,
    phase: 3,
  },
  PENDING_BOARD_APPROVAL: {
    label: "Board Approval",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: Award,
    phase: 4,
  },
  APPROVED: {
    label: "Approved",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: CheckCircle2,
    phase: 5,
  },
  REJECTED: {
    label: "Rejected",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: XCircle,
    phase: 6,
  },
  ARCHIVED: {
    label: "Archived",
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: Clock,
    phase: 7,
  },
};

const APPRAISAL_STATE_CONFIG: Record<
  AppraisalStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ElementType }
> = {
  PENDING_SELF_ASSESSMENT: FORM_STATE_CONFIG.PENDING_SELF_ASSESSMENT,
  PENDING_HEAD_REVIEW: FORM_STATE_CONFIG.PENDING_HEAD_REVIEW,
  PENDING_HR_CALIBRATION: FORM_STATE_CONFIG.PENDING_HR_CALIBRATION,
  PENDING_BOARD_APPROVAL: FORM_STATE_CONFIG.PENDING_BOARD_APPROVAL,
  APPROVED: FORM_STATE_CONFIG.APPROVED,
  COMPLETED: {
    label: "Completed",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: CheckCircle2,
  },
};

/* ──────────────────────────────────────────────
   Category Config
   ────────────────────────────────────────────── */
const CATEGORY_CONFIG: Record<EmployeeCategory, { color: string; bg: string; border: string }> = {
  Academic: { color: "text-slate-800", bg: "bg-slate-100", border: "border-slate-200" },
  Administrative: { color: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200" },
  "Support Staff": { color: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200" },
  "Blue-Collar": { color: "text-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200" },
  Management: { color: "text-violet-800", bg: "bg-violet-50", border: "border-violet-200" },
};

const DEFAULT_CATEGORY_BADGE = {
  color: "text-slate-800",
  bg: "bg-slate-100",
  border: "border-slate-200",
};

function getCategoryBadgeStyle(categoryName: string | null) {
  if (!categoryName) {
    return DEFAULT_CATEGORY_BADGE;
  }

  const configEntry = (Object.keys(CATEGORY_CONFIG) as EmployeeCategory[]).find(
    (key) => key.toLowerCase() === categoryName.toLowerCase(),
  );

  return configEntry ? CATEGORY_CONFIG[configEntry] : DEFAULT_CATEGORY_BADGE;
}

/* ──────────────────────────────────────────────
   Stat Card
   ────────────────────────────────────────────── */
function StatCard({
  title,
  value,
  subtitle,
  tone,
  icon: Icon,
  delay,
  onClick,
  active,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "navy" | "amber" | "orange" | "emerald" | "slate";
  icon: React.ElementType;
  delay: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const tones = {
    navy: {
      border: active ? "border-slate-800 dark:border-slate-600" : "border-slate-200 dark:border-slate-700",
      bg: "bg-white dark:bg-slate-900",
      accent: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      value: "text-slate-900 dark:text-white",
      top: "from-slate-700 via-slate-600 to-slate-700",
    },
    amber: {
      border: active ? "border-amber-500 dark:border-amber-400" : "border-amber-200 dark:border-amber-800/50",
      bg: "bg-white dark:bg-slate-900",
      accent: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
      value: "text-amber-700 dark:text-amber-400",
      top: "from-amber-600 via-amber-500 to-amber-600",
    },
    orange: {
      border: active ? "border-orange-500 dark:border-orange-400" : "border-orange-200 dark:border-orange-800/50",
      bg: "bg-white dark:bg-slate-900",
      accent: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
      value: "text-orange-700 dark:text-orange-400",
      top: "from-orange-600 via-orange-500 to-orange-600",
    },
    emerald: {
      border: active ? "border-emerald-500 dark:border-emerald-400" : "border-emerald-200 dark:border-emerald-800/50",
      bg: "bg-white dark:bg-slate-900",
      accent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
      value: "text-emerald-700 dark:text-emerald-400",
      top: "from-emerald-600 via-emerald-500 to-emerald-600",
    },
    slate: {
      border: active ? "border-slate-500 dark:border-slate-400" : "border-slate-200 dark:border-slate-700",
      bg: "bg-white dark:bg-slate-900",
      accent: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      value: "text-slate-700 dark:text-slate-300",
      top: "from-slate-500 via-slate-400 to-slate-500",
    },
  };

  const t = tones[tone];

  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-300",
        active ? "shadow-md ring-1 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950" : "hover:shadow-md",
        t.border,
        t.bg,
        active && tone === "navy" && "ring-slate-400",
        active && tone === "amber" && "ring-amber-400",
        active && tone === "orange" && "ring-orange-400",
        active && tone === "emerald" && "ring-emerald-400"
      )}
    >
      <div className={cn("absolute left-0 right-0 top-0 h-1 bg-gradient-to-r", t.top)} />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className={cn("text-3xl font-bold tracking-tight tabular-nums", t.value)}>
            {value}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500">{subtitle}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", t.accent)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

function EligibilityStatCard({
  data,
  delay,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  delay: number;
}) {
  const hasData = data.some((entry) => entry.value > 0);

  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600" />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Appraisal Eligibility
      </p>

      {hasData ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-[88px] w-[88px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={24}
                  outerRadius={40}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell key={`eligibility-mini-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="min-w-0 flex-1 space-y-1.5">
            {data.map((entry) => (
              <li
                key={entry.name}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">
                  {entry.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          No employees match the current filters
        </p>
      )}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Chart Card
   ────────────────────────────────────────────── */
function ChartCard({
  title,
  subtitle,
  children,
  delay,
  className,
  action,
  clipOverflow = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay: number;
  className?: string;
  action?: React.ReactNode;
  clipOverflow?: boolean;
}) {
  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900",
        clipOverflow ? "overflow-hidden" : "overflow-visible",
        className
      )}
    >
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

function formatStackBarLabel(value: unknown) {
  const numericValue = Number(value);
  return numericValue >= 5 ? numericValue : "";
}

interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  name?: string;
  value?: number;
  percent?: number;
}

function createPieLabelRenderer(labelColor: string) {
  return function renderPieLabel({
    cx = 0,
    cy = 0,
    midAngle = 0,
    outerRadius = 0,
    name = "",
    value = 0,
    percent = 0,
  }: PieLabelProps) {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 16;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textAnchor = x > cx ? "start" : "end";

    return (
      <text
        x={x}
        y={y}
        fill={labelColor}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fontSize={10}
        fontWeight={600}
      >
        {`${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
      </text>
    );
  };
}

/* ──────────────────────────────────────────────
   Custom Tooltip
   ────────────────────────────────────────────── */
interface TooltipPayloadEntry {
  color?: string;
  fill?: string;
  name?: string;
  value?: number | string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-slate-800">
      <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
          <span className="text-slate-600 dark:text-slate-400">{entry.name}:</span>
          <span className="font-semibold text-slate-900 dark:text-white">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function CalibrationDistributionMatrix({
  rows,
  columns,
  employeeCount,
  isLoading,
  hideHeader = false,
}: {
  rows: RatingQuartileMatrixRow[];
  columns: MatrixQuartileColumn[];
  employeeCount: number;
  isLoading?: boolean;
  hideHeader?: boolean;
}) {
  const columnTotals = columns.map((column) =>
    rows.reduce(
      (sum, row) => sum + (row.quartiles[column.index]?.count ?? 0),
      0,
    ),
  );

  return (
    <div className="flex h-full flex-col">
      {!hideHeader ? (
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Rating × Quartile Matrix</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Employee headcount by performance level and quartile (sorted by configured order)
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          Loading performance matrix…
        </div>
      ) : rows.length === 0 || columns.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          No performance levels or quartiles configured yet.
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-800/60">
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                  Performance Level
                </th>
                {columns.map((column) => (
                  <th
                    key={`${column.label}-${column.index}`}
                    className="px-2 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-300"
                  >
                    <span className="block">{column.label}</span>
                  </th>
                ))}
                <th className="px-2 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-300">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {rows.map((row) => (
                <tr
                  key={row.levelId}
                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                    {row.rating}
                  </td>
                  {row.quartiles.map((cell) => (
                    <td key={`${row.levelId}-${cell.id ?? cell.sortOrder}`} className="px-2 py-2.5 text-center">
                      {cell.count === null ? (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          <span
                            className={cn(
                              "inline-flex min-w-8 items-center justify-center rounded-md px-2 py-1 font-semibold tabular-nums",
                              cell.count > 0
                                ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                : "text-slate-300 dark:text-slate-600",
                            )}
                          >
                            {cell.count}
                          </span>
                          {cell.sublabel ? (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              {cell.sublabel}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {row.rowTotal}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-slate-800/40">
                <td className="px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Total</td>
                {columnTotals.map((total, index) => (
                  <td
                    key={`${columns[index]?.label}-${index}`}
                    className="px-2 py-2.5 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-200"
                  >
                    {total}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  {employeeCount}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Filter Chip
   ────────────────────────────────────────────── */
function FilterChip({
  label,
  onRemove,
  color = "slate",
}: {
  label: string;
  onRemove: () => void;
  color?: "slate" | "amber" | "orange" | "emerald" | "blue";
}) {
  const colors = {
    slate: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50",
    orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/50",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/50",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", colors[color])}>
      {label}
      <button onClick={onRemove} className="ml-1 rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/* ──────────────────────────────────────────────
   Main Dashboard
   ────────────────────────────────────────────── */
export default function HRDashboardPage() {
  const isDarkMode = useIsDarkMode();

  const { data: financialYears } = useQuery({
    queryKey: ["financial-years"],
    queryFn: fetchFinancialYears,
  });

  const activeFinancialYearId = useMemo(() => {
    if (!financialYears?.length) {
      return null;
    }

    return (financialYears.find((year) => year.isActive) ?? financialYears[0]).id;
  }, [financialYears]);

  const { data: performanceMatrix, isLoading: performanceMatrixLoading } = useQuery({
    queryKey: ["performance-matrix", activeFinancialYearId],
    queryFn: () => fetchPerformanceMatrix(activeFinancialYearId!),
    enabled: activeFinancialYearId !== null,
  });

  const { data: staffCategories = [], isLoading: staffCategoriesLoading } = useQuery({
    queryKey: ["staff-categories-with-subcategories"],
    queryFn: fetchStaffCategoriesWithSubCategories,
  });

  const { data: entities = [], isLoading: entitiesLoading } = useQuery({
    queryKey: ["entities"],
    queryFn: fetchEntities,
  });

  const {
    data: submissions = [],
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useQuery({
    queryKey: ["form-submissions"],
    queryFn: fetchFormSubmissions,
  });

  const matrixForDistribution = useMemo(
    () =>
      performanceMatrix && performanceMatrix.length > 0
        ? performanceMatrix
        : MOCK_PERFORMANCE_MATRIX,
    [performanceMatrix],
  );

  /* ── Filter State ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<number | "ALL">("ALL");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "ALL">("ALL");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | "ALL">("ALL");
  const [selectedFormState, setSelectedFormState] = useState<(FormState | "ALL")>("ALL");
  const [showFilters, setShowFilters] = useState(true);

  const selectedStaffCategory = useMemo(
    () =>
      selectedCategoryId === "ALL"
        ? null
        : staffCategories.find((category) => category.id === selectedCategoryId) ?? null,
    [selectedCategoryId, staffCategories],
  );

  const availableSubCategories = useMemo(
    () => selectedStaffCategory?.subCategories ?? [],
    [selectedStaffCategory],
  );

  /* ── Derived Data ── */
  const sortedEntities = useMemo(
    () => [...entities].sort((a, b) => a.name.localeCompare(b.name)),
    [entities],
  );

  const filteredEmployees = useMemo(
    () =>
      MOCK_EMPLOYEES.filter((employee) =>
        matchesEmployeeFilters(employee, {
          searchQuery,
          selectedEntityId,
          selectedCategoryId,
          selectedSubCategoryId,
          selectedFormState,
          staffCategories,
          entities,
        }),
      ),
    [
      searchQuery,
      selectedEntityId,
      selectedCategoryId,
      selectedSubCategoryId,
      selectedFormState,
      staffCategories,
      entities,
    ],
  );

  const filteredSubmissions = useMemo(
    () =>
      submissions.filter((submission) =>
        matchesSubmissionFilters(submission, {
          searchQuery,
          selectedEntityId,
          selectedCategoryId,
          selectedSubCategoryId,
          selectedFormState,
          staffCategories,
          entities,
        }),
      ),
    [
      submissions,
      searchQuery,
      selectedEntityId,
      selectedCategoryId,
      selectedSubCategoryId,
      selectedFormState,
      staffCategories,
      entities,
    ],
  );

  const themedCategoryDistribution = useMemo(
    () => buildSubmissionCategoryCounts(filteredSubmissions, staffCategories, isDarkMode),
    [filteredSubmissions, staffCategories, isDarkMode],
  );

  const filteredCalibrationData = useMemo(
    () => buildCalibrationData(filteredEmployees),
    [filteredEmployees],
  );

  const ratingQuartileMatrix = useMemo(
    () => buildRatingQuartileMatrix(filteredEmployees, matrixForDistribution),
    [filteredEmployees, matrixForDistribution],
  );

  const filteredCompletionByCategory = useMemo(
    () => buildSubmissionCompletionByCategory(filteredSubmissions, staffCategories),
    [filteredSubmissions, staffCategories],
  );

  const pieLabelRenderer = useMemo(
    () => createPieLabelRenderer(isDarkMode ? "#cbd5e1" : "#475569"),
    [isDarkMode],
  );

  const eligibilityData = useMemo(
    () => buildEligibilityData(filteredEmployees, isDarkMode),
    [filteredEmployees, isDarkMode],
  );

  const handleCategoryChange = (categoryId: number | "ALL") => {
    setSelectedCategoryId(categoryId);
    setSelectedSubCategoryId("ALL");
  };

  /* ── Workflow Stats ── */
  const selfAssessmentCount = filteredEmployees.filter(
    (employee) => employee.formState === "PENDING_SELF_ASSESSMENT",
  ).length;
  const managerReviewCount = filteredEmployees.filter(
    (employee) => employee.formState === "PENDING_HEAD_REVIEW",
  ).length;
  const hrAlignmentCount = filteredEmployees.filter(
    (employee) => employee.formState === "PENDING_HR_CALIBRATION",
  ).length;

  /* ── Active Filters for Display ── */
  const activeFilters = useMemo(() => {
    const filters: { label: string; onRemove: () => void; color: "slate" | "amber" | "orange" | "emerald" | "blue" }[] = [];
    if (selectedEntityId !== "ALL") {
      const entity = entities.find((item) => item.id === selectedEntityId);
      filters.push({
        label: `Entity: ${entity?.name ?? selectedEntityId}`,
        onRemove: () => setSelectedEntityId("ALL"),
        color: "slate",
      });
    }
    if (selectedCategoryId !== "ALL") {
      const category = staffCategories.find((item) => item.id === selectedCategoryId);
      filters.push({
        label: `Category: ${category?.name ?? selectedCategoryId}`,
        onRemove: () => handleCategoryChange("ALL"),
        color: "amber",
      });
    }
    if (selectedSubCategoryId !== "ALL") {
      const subCategory = availableSubCategories.find((item) => item.id === selectedSubCategoryId);
      filters.push({
        label: `Sub-Category: ${subCategory?.name ?? selectedSubCategoryId}`,
        onRemove: () => setSelectedSubCategoryId("ALL"),
        color: "blue",
      });
    }
    if (selectedFormState !== "ALL") filters.push({ label: `State: ${FORM_STATE_CONFIG[selectedFormState].label}`, onRemove: () => setSelectedFormState("ALL"), color: "orange" });
    if (searchQuery) filters.push({ label: `Search: "${searchQuery}"`, onRemove: () => setSearchQuery(""), color: "emerald" });
    return filters;
  }, [selectedEntityId, selectedCategoryId, selectedSubCategoryId, selectedFormState, searchQuery, staffCategories, availableSubCategories, entities]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedEntityId("ALL");
    setSelectedCategoryId("ALL");
    setSelectedSubCategoryId("ALL");
    setSelectedFormState("ALL");
  };

  /* ── Filter Handlers ── */
  const filterByFormState = (state: FormState) => {
    setSelectedFormState((prev) => (prev === state ? "ALL" : state));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto  px-4  sm:px-6">

        {/* ── Filter Bar ── */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.55 }}
          className="mb-6 space-y-4"
        >


          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {/* Search */}
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Search
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Name, ID, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={cn(
                          "w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400",
                          "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                          "dark:border-white/10 dark:bg-slate-950 dark:text-white"
                        )}
                      />
                    </div>
                  </div>

                  {/* Function */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Entity
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={selectedEntityId === "ALL" ? "ALL" : String(selectedEntityId)}
                        onChange={(e) =>
                          setSelectedEntityId(
                            e.target.value === "ALL" ? "ALL" : Number(e.target.value),
                          )
                        }
                        disabled={entitiesLoading}
                        className={cn(
                          "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                          "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                        )}
                      >
                        <option value="ALL">All Entities</option>
                        {sortedEntities.map((entity) => (
                          <option key={entity.id} value={entity.id}>
                            {entity.parentName
                              ? `${entity.name} (${entity.parentName})`
                              : entity.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>



                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Category
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={selectedCategoryId === "ALL" ? "ALL" : String(selectedCategoryId)}
                        onChange={(e) =>
                          handleCategoryChange(
                            e.target.value === "ALL" ? "ALL" : Number(e.target.value),
                          )
                        }
                        disabled={staffCategoriesLoading}
                        className={cn(
                          "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                          "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                        )}
                      >
                        <option value="ALL">All Categories</option>
                        {staffCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* Sub-Category */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Sub-Category
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={selectedSubCategoryId === "ALL" ? "ALL" : String(selectedSubCategoryId)}
                        onChange={(e) =>
                          setSelectedSubCategoryId(
                            e.target.value === "ALL" ? "ALL" : Number(e.target.value),
                          )
                        }
                        disabled={staffCategoriesLoading || selectedCategoryId === "ALL"}
                        className={cn(
                          "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                          "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                        )}
                      >
                        <option value="ALL">All Sub-Categories</option>
                        {availableSubCategories.map((subCategory) => (
                          <option key={subCategory.id} value={subCategory.id}>
                            {subCategory.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* Form State */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Form State
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={selectedFormState}
                        onChange={(e) => setSelectedFormState(e.target.value as FormState | "ALL")}
                        className={cn(
                          "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                          "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                          "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                        )}
                      >
                        <option value="ALL">All States</option>
                        {Object.entries(FORM_STATE_CONFIG).map(([key, config]) => (
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

          </AnimatePresence>

          {/* Active Filter Chips */}
          <AnimatePresence>
            {activeFilters.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-wrap items-center gap-2"
              >
                {activeFilters.map((filter, i) => (
                  <FilterChip key={i} label={filter.label} onRemove={filter.onRemove} color={filter.color} />
                ))}
                <button
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear All
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        {/* ── Eligibility + Workflow Stats ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <EligibilityStatCard data={eligibilityData} delay={0} />
          <StatCard
            title="Self Assessment"
            value={selfAssessmentCount.toString()}
            subtitle="Awaiting employee submission"
            tone="slate"
            icon={User}
            delay={0.1}
            onClick={() => filterByFormState("PENDING_SELF_ASSESSMENT")}
            active={selectedFormState === "PENDING_SELF_ASSESSMENT"}
          />
          <StatCard
            title="Manager Review"
            value={managerReviewCount.toString()}
            subtitle="Awaiting line manager review"
            tone="amber"
            icon={AlertTriangle}
            delay={0.2}
            onClick={() => filterByFormState("PENDING_HEAD_REVIEW")}
            active={selectedFormState === "PENDING_HEAD_REVIEW"}
          />
          <StatCard
            title="HR Alignment"
            value={hrAlignmentCount.toString()}
            subtitle="Ready for HR calibration"
            tone="orange"
            icon={Scale}
            delay={0.3}
            onClick={() => filterByFormState("PENDING_HR_CALIBRATION")}
            active={selectedFormState === "PENDING_HR_CALIBRATION"}
          />
        </motion.div>



        {/* ── Charts ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-12"
        >
          <ChartCard
            title="Rating Calibration Curve"
            subtitle="Institutional Quota vs. Actual Distribution — Identifies Grade Inflation"
            delay={0.35}
            className="lg:col-span-6"
          >
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredCalibrationData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="quotaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="rating" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} iconType="circle" iconSize={8} />
                  <Area type="monotone" dataKey="quota" name="Institutional Quota" stroke="#64748b" strokeWidth={2} fill="url(#quotaGrad)" dot={{ r: 4, fill: "#64748b", strokeWidth: 0 }}>
                    <LabelList dataKey="quota" position="top" offset={8} style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
                  </Area>
                  <Area type="monotone" dataKey="actual" name="Actual Distribution" stroke="#d97706" strokeWidth={2} fill="url(#actualGrad)" dot={{ r: 4, fill: "#d97706", strokeWidth: 0 }}>
                    <LabelList dataKey="actual" position="bottom" offset={8} style={{ fontSize: 11, fill: "#d97706", fontWeight: 600 }} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="Rating × Quartile Matrix"
            subtitle="Employee headcount by performance level and quartile (sorted by configured order)"
            delay={0.36}
            className="lg:col-span-6"
          >
            <CalibrationDistributionMatrix
              rows={ratingQuartileMatrix.rows}
              columns={ratingQuartileMatrix.columns}
              employeeCount={filteredEmployees.length}
              isLoading={performanceMatrixLoading}
              hideHeader
            />
          </ChartCard>
        </motion.div>

        {/* Completion by Category */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-12"
        >
          <ChartCard
            title="Employee Category Mix"
            subtitle="Headcount distribution across university staff types"
            delay={0.4}
            className="lg:col-span-5"
            clipOverflow={false}
          >
            <div className="h-[360px] overflow-visible px-1">
              {submissionsLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  Loading submissions...
                </div>
              ) : submissionsError ? (
                <div className="flex h-full items-center justify-center text-sm text-red-600 dark:text-red-400">
                  Failed to load submissions.
                </div>
              ) : themedCategoryDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 20, right: 24, bottom: 20, left: 24 }}>
                    <Pie
                      data={themedCategoryDistribution}
                      cx="52%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={pieLabelRenderer}
                      labelLine={{ stroke: isDarkMode ? "#64748b" : "#94a3b8", strokeWidth: 1 }}
                    >
                      {themedCategoryDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  No submissions match the current filters
                </div>
              )}
            </div>
          </ChartCard>
          <ChartCard
            title="Workflow Progress by Employee Category"
            subtitle="Form state advancement across organizational tiers"
            delay={0.45}
            className="lg:col-span-7"
          >
            <div className="h-[320px]">
              {submissionsLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  Loading submissions...
                </div>
              ) : submissionsError ? (
                <div className="flex h-full items-center justify-center text-sm text-red-600 dark:text-red-400">
                  Failed to load submissions.
                </div>
              ) : filteredCompletionByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredCompletionByCategory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} iconType="circle" iconSize={8} />
                  <Bar dataKey="draft" name="Draft" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]}>
                    <LabelList dataKey="draft" position="center" formatter={formatStackBarLabel} style={{ fill: "#fff", fontSize: 10, fontWeight: 600 }} />
                  </Bar>
                  <Bar dataKey="selfAssessment" name="Self Assessment" stackId="a" fill="#cbd5e1">
                    <LabelList dataKey="selfAssessment" position="center" formatter={formatStackBarLabel} style={{ fill: "#334155", fontSize: 10, fontWeight: 600 }} />
                  </Bar>
                  <Bar dataKey="headReview" name="Function Head Review" stackId="a" fill="#d97706">
                    <LabelList dataKey="headReview" position="center" formatter={formatStackBarLabel} style={{ fill: "#fff", fontSize: 10, fontWeight: 600 }} />
                  </Bar>
                  <Bar dataKey="hrCalibration" name="HR Calibration" stackId="a" fill="#ea580c">
                    <LabelList dataKey="hrCalibration" position="center" formatter={formatStackBarLabel} style={{ fill: "#fff", fontSize: 10, fontWeight: 600 }} />
                  </Bar>
                  <Bar dataKey="approved" name="Approved" stackId="a" fill="#059669" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="approved" position="center" formatter={formatStackBarLabel} style={{ fill: "#fff", fontSize: 10, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  No submissions match the current filters
                </div>
              )}
            </div>
          </ChartCard>
        </motion.div>

        {/* Function Performance */}
        {/* <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <ChartCard
            title="Performance by Function"
            subtitle="Average raw score and headcount across university functions"
            delay={0.5}
            className="mb-8"
            action={
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Avg: {Math.round(functionPerformance.reduce((a, b) => a + b.avgScore, 0) / functionPerformance.length)}
              </span>
            }
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={functionPerformance} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="function" type="category" width={140} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgScore" name="Avg Score" radius={[0, 4, 4, 0]} barSize={24}>
                    {functionPerformance.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? "#0f172a" : "#d97706"} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </motion.div> */}



        {/* ── Data Table ── */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.6 }}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-white/[0.02]">
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Employee
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Function / Sub-Function
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Category
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Score
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Current Rating
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Form State
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.03]">
                {submissionsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                      Loading submissions...
                    </td>
                  </tr>
                ) : submissionsError ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-red-600 dark:text-red-400">
                      Failed to load submissions.
                    </td>
                  </tr>
                ) : (
                <AnimatePresence>
                  {filteredSubmissions.map((submission, index) => {
                    const stateConfig = APPRAISAL_STATE_CONFIG[submission.status];
                    const StateIcon = stateConfig.icon;
                    const catConfig = getCategoryBadgeStyle(submission.staffCategoryName);
                    const functionLabel = submission.parentEntityName ?? submission.entityName ?? "—";
                    const subFunctionLabel = submission.parentEntityName
                      ? submission.entityName ?? "—"
                      : "—";
                    const displayRating = getSubmissionDisplayRating(submission);

                    return (
                      <motion.tr
                        key={submission.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{
                          duration: 0.35,
                          delay: index * 0.04,
                          ease: [0.23, 1, 0.32, 1],
                        }}
                        className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5">
                              <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900 dark:text-white">
                                {submission.employeeName}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">
                                {submission.employeeId}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {functionLabel}
                              </span>
                            </div>
                            {subFunctionLabel !== "—" ? (
                              <div className="flex items-center gap-1.5 pl-4">
                                <Layers className="h-3 w-3 text-slate-400" />
                                <span className="text-xs text-slate-500 dark:text-slate-500">
                                  {subFunctionLabel}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
                            catConfig.bg,
                            catConfig.color,
                            catConfig.border
                          )}>
                            {submission.staffCategoryName ?? "—"}
                          </span>
                          <p className="mt-1 text-xs text-slate-500">
                            {submission.staffSubCategoryName ?? "—"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Hash className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                              {submission.rawScore}
                            </span>
                           
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                            submission.calibratedRating
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          )}>
                            {displayRating}
                            {submission.calibratedRating && (
                              <CheckCircle2 className="ml-1 h-3 w-3" />
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                            stateConfig.bg,
                            stateConfig.color,
                            stateConfig.border
                          )}>
                            <StateIcon className="h-3 w-3" />
                            {stateConfig.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/dashboard/submissions/${submission.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-amber-600 dark:hover:bg-amber-500"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>

          {!submissionsLoading && !submissionsError && filteredSubmissions.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <Search className="h-10 w-10 text-slate-300 dark:text-slate-700" />
              <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-500">
                No records match your filters
              </p>
              <button
                onClick={clearAllFilters}
                className="mt-2 text-xs text-amber-600 hover:underline dark:text-amber-400"
              >
                Clear all filters
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}