"use client";

import { useState, useMemo, useCallback } from "react";
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
} from "recharts";
import {
  TrendingUp,
  AlertTriangle,
  Scale,
  Banknote,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  Download,
  RefreshCw,
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
  category: EmployeeCategory;
  subCategory: string;
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
   Chart Data
   ────────────────────────────────────────────── */
const calibrationData = [
  { rating: "Unsatisfactory", quota: 5, actual: 8 },
  { rating: "Needs Improvement", quota: 10, actual: 12 },
  { rating: "Satisfactory", quota: 25, actual: 22 },
  { rating: "Good", quota: 35, actual: 38 },
  { rating: "Excellent", quota: 20, actual: 15 },
  { rating: "Outstanding", quota: 5, actual: 5 },
];

const completionByCategory = [
  { category: "Academic", draft: 5, selfAssessment: 80, headReview: 65, hrCalibration: 40, approved: 30, rejected: 2 },
  { category: "Administrative", draft: 8, selfAssessment: 70, headReview: 55, hrCalibration: 30, approved: 20, rejected: 3 },
  { category: "Support Staff", draft: 12, selfAssessment: 60, headReview: 45, hrCalibration: 25, approved: 15, rejected: 1 },
  { category: "Blue-Collar", draft: 20, selfAssessment: 40, headReview: 30, hrCalibration: 15, approved: 10, rejected: 0 },
  { category: "Management", draft: 2, selfAssessment: 90, headReview: 85, hrCalibration: 70, approved: 60, rejected: 1 },
];

const functionPerformance = [
  { function: "Teaching & Learning", avgScore: 82, headcount: 45 },
  { function: "Student Affairs", avgScore: 71, headcount: 12 },
  { function: "Facilities Mgmt", avgScore: 65, headcount: 28 },
  { function: "Finance & Admin", avgScore: 78, headcount: 18 },
  { function: "Research & Dev", avgScore: 88, headcount: 8 },
];

const categoryDistribution = [
  { name: "Academic", value: 45, color: "#0f172a" },
  { name: "Administrative", value: 18, color: "#d97706" },
  { name: "Support Staff", value: 15, color: "#64748b" },
  { name: "Blue-Collar", value: 28, color: "#059669" },
  { name: "Management", value: 8, color: "#7c3aed" },
];

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
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay: number;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900",
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

/* ──────────────────────────────────────────────
   Custom Tooltip
   ────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-slate-800">
      <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
          <span className="text-slate-600 dark:text-slate-400">{entry.name}:</span>
          <span className="font-semibold text-slate-900 dark:text-white">{entry.value}</span>
        </div>
      ))}
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
  /* ── Filter State ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFunction, setSelectedFunction] = useState<string>("ALL");
  const [selectedSubFunction, setSelectedSubFunction] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<(EmployeeCategory | "ALL")>("ALL");
  const [selectedFormState, setSelectedFormState] = useState<(FormState | "ALL")>("ALL");
  const [showFilters, setShowFilters] = useState(true);

  /* ── Derived Data ── */
  const allFunctions = useMemo(() => {
    const funcs = new Set(MOCK_EMPLOYEES.map((e) => e.function));
    return Array.from(funcs).sort();
  }, []);

  const availableSubFunctions = useMemo(() => {
    const subs = new Set(
      MOCK_EMPLOYEES.filter((e) => selectedFunction === "ALL" || e.function === selectedFunction).map((e) => e.subFunction)
    );
    return Array.from(subs).sort();
  }, [selectedFunction]);

  /* Reset sub-function when function changes */
  const handleFunctionChange = (func: string) => {
    setSelectedFunction(func);
    setSelectedSubFunction("ALL");
  };

  /* ── Stats ── */
  const totalEmployees = MOCK_EMPLOYEES.length;
  const submittedCount = MOCK_EMPLOYEES.filter((e) => e.formState !== "DRAFT" && e.formState !== "PENDING_SELF_ASSESSMENT").length;
  const completionRate = ((submittedCount / totalEmployees) * 100).toFixed(1);

  const pendingHeadCount = MOCK_EMPLOYEES.filter((e) => e.formState === "PENDING_HEAD_REVIEW").length;
  const pendingCalibrationCount = MOCK_EMPLOYEES.filter((e) => e.formState === "PENDING_HR_CALIBRATION").length;
  const totalApprovedIncrement = MOCK_EMPLOYEES.reduce((sum, e) => sum + (e.approvedIncrement ?? 0), 0);

  /* ── Filtered Table ── */
  const filteredEmployees = useMemo(() => {
    return MOCK_EMPLOYEES.filter((e) => {
      const matchesSearch =
        !searchQuery ||
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFunction = selectedFunction === "ALL" || e.function === selectedFunction;
      const matchesSubFunction = selectedSubFunction === "ALL" || e.subFunction === selectedSubFunction;
      const matchesCategory = selectedCategory === "ALL" || e.category === selectedCategory;
      const matchesFormState = selectedFormState === "ALL" || e.formState === selectedFormState;
      return matchesSearch && matchesFunction && matchesSubFunction && matchesCategory && matchesFormState;
    });
  }, [searchQuery, selectedFunction, selectedSubFunction, selectedCategory, selectedFormState]);

  /* ── Active Filters for Display ── */
  const activeFilters = useMemo(() => {
    const filters: { label: string; onRemove: () => void; color: "slate" | "amber" | "orange" | "emerald" | "blue" }[] = [];
    if (selectedFunction !== "ALL") filters.push({ label: `Function: ${selectedFunction}`, onRemove: () => setSelectedFunction("ALL"), color: "slate" });
    if (selectedSubFunction !== "ALL") filters.push({ label: `Sub: ${selectedSubFunction}`, onRemove: () => setSelectedSubFunction("ALL"), color: "blue" });
    if (selectedCategory !== "ALL") filters.push({ label: `Category: ${selectedCategory}`, onRemove: () => setSelectedCategory("ALL"), color: "amber" });
    if (selectedFormState !== "ALL") filters.push({ label: `State: ${FORM_STATE_CONFIG[selectedFormState].label}`, onRemove: () => setSelectedFormState("ALL"), color: "orange" });
    if (searchQuery) filters.push({ label: `Search: "${searchQuery}"`, onRemove: () => setSearchQuery(""), color: "emerald" });
    return filters;
  }, [selectedFunction, selectedSubFunction, selectedCategory, selectedFormState, searchQuery]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedFunction("ALL");
    setSelectedSubFunction("ALL");
    setSelectedCategory("ALL");
    setSelectedFormState("ALL");
  };

  /* ── Filter Handlers ── */
  const filterByFormState = (state: FormState) => {
    setSelectedFormState((prev) => (prev === state ? "ALL" : state));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto  px-4  sm:px-6">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="mb-8 "
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 dark:bg-amber-600">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                    Performance Management System
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Fiscal Year 2026 — University-wide Appraisal Cycle
                  </p>
                </div>
              </div>
            </div>
           
          </div>
        </motion.div>

        {/* ── Stat Cards ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            title="Cycle Progress"
            value={`${completionRate}%`}
            subtitle={`${submittedCount} / ${totalEmployees} Forms Advanced`}
            tone="navy"
            icon={TrendingUp}
            delay={0}
          />
          <StatCard
            title="Function Head Review"
            value={pendingHeadCount.toString()}
            subtitle="Awaiting Line Manager Confirmation"
            tone="amber"
            icon={AlertTriangle}
            delay={0.1}
            onClick={() => filterByFormState("PENDING_HEAD_REVIEW")}
            active={selectedFormState === "PENDING_HEAD_REVIEW"}
          />
          <StatCard
            title="HR Calibration"
            value={pendingCalibrationCount.toString()}
            subtitle="Ready for Curve Adjustment"
            tone="orange"
            icon={Scale}
            delay={0.2}
            onClick={() => filterByFormState("PENDING_HR_CALIBRATION")}
            active={selectedFormState === "PENDING_HR_CALIBRATION"}
          />
          <StatCard
            title="Approved Increment Load"
            value={`${totalApprovedIncrement.toFixed(1)}%`}
            subtitle="Based on Finalized Appraisals"
            tone="emerald"
            icon={Banknote}
            delay={0.3}
          />
        </motion.div>

        {/* ── Charts ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          {/* Calibration Curve */}
          <ChartCard
            title="Rating Calibration Curve"
            subtitle="Institutional Quota vs. Actual Distribution — Identifies Grade Inflation"
            delay={0.35}
            className="lg:col-span-7"
          >
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={calibrationData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                  <Area type="monotone" dataKey="quota" name="Institutional Quota" stroke="#64748b" strokeWidth={2} fill="url(#quotaGrad)" dot={{ r: 4, fill: "#64748b", strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="actual" name="Actual Distribution" stroke="#d97706" strokeWidth={2} fill="url(#actualGrad)" dot={{ r: 4, fill: "#d97706", strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Category Distribution */}
          <ChartCard
            title="Employee Category Mix"
            subtitle="Headcount distribution across university staff types"
            delay={0.4}
            className="lg:col-span-5"
          >
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="middle"
                    align="right"
                    layout="vertical"
                    wrapperStyle={{ fontSize: "12px", lineHeight: "24px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </motion.div>

        {/* Completion by Category */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <ChartCard
            title="Workflow Progress by Employee Category"
            subtitle="Form state advancement across organizational tiers"
            delay={0.45}
            className="mb-8"
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completionByCategory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} iconType="circle" iconSize={8} />
                  <Bar dataKey="draft" name="Draft" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="selfAssessment" name="Self Assessment" stackId="a" fill="#cbd5e1" />
                  <Bar dataKey="headReview" name="Function Head Review" stackId="a" fill="#d97706" />
                  <Bar dataKey="hrCalibration" name="HR Calibration" stackId="a" fill="#ea580c" />
                  <Bar dataKey="approved" name="Approved" stackId="a" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </motion.div>

        {/* Function Performance */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
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
        </motion.div>

        {/* ── Filter Bar ── */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.55 }}
          className="mb-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                Appraisal Ledger
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {filteredEmployees.length} records
              </span>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                showFilters
                  ? "bg-slate-800 text-white dark:bg-amber-600"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showFilters ? "Hide Filters" : "Show Filters"}
              {activeFilters.length > 0 && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
                  {activeFilters.length}
                </span>
              )}
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                        Function
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <select
                          value={selectedFunction}
                          onChange={(e) => handleFunctionChange(e.target.value)}
                          className={cn(
                            "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                            "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                            "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                          )}
                        >
                          <option value="ALL">All Functions</option>
                          {allFunctions.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>

                    {/* Sub-Function */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Sub-Function
                      </label>
                      <div className="relative">
                        <Layers className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <select
                          value={selectedSubFunction}
                          onChange={(e) => setSelectedSubFunction(e.target.value)}
                          disabled={selectedFunction === "ALL"}
                          className={cn(
                            "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                            "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                            "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                          )}
                        >
                          <option value="ALL">All Sub-Functions</option>
                          {availableSubFunctions.map((sf) => (
                            <option key={sf} value={sf}>{sf}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>

                    {/* Employee Category */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Employee Category
                      </label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value as EmployeeCategory | "ALL")}
                          className={cn(
                            "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                            "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                            "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                          )}
                        >
                          <option value="ALL">All Categories</option>
                          <option value="Academic">Academic</option>
                          <option value="Administrative">Administrative</option>
                          <option value="Support Staff">Support Staff</option>
                          <option value="Blue-Collar">Blue-Collar</option>
                          <option value="Management">Management</option>
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
            )}
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
                    Raw Score
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
                <AnimatePresence>
                  {filteredEmployees.map((employee, index) => {
                    const stateConfig = FORM_STATE_CONFIG[employee.formState];
                    const StateIcon = stateConfig.icon;
                    const catConfig = CATEGORY_CONFIG[employee.category];

                    return (
                      <motion.tr
                        key={employee.id}
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
                                {employee.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">
                                {employee.employeeId}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {employee.function}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 pl-4">
                              <Layers className="h-3 w-3 text-slate-400" />
                              <span className="text-xs text-slate-500 dark:text-slate-500">
                                {employee.subFunction}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
                            catConfig.bg,
                            catConfig.color,
                            catConfig.border
                          )}>
                            {employee.category}
                          </span>
                          <p className="mt-1 text-xs text-slate-500">{employee.subCategory}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Hash className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                              {employee.rawScore}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                            employee.calibratedRating
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          )}>
                            {employee.calibratedRating || employee.initialRating}
                            {employee.calibratedRating && (
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
                          <button className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-amber-600 dark:hover:bg-amber-500">
                            <Eye className="h-3.5 w-3.5" />
                            View
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredEmployees.length === 0 && (
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