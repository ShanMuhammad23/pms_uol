"use client";

import { useState, useMemo } from "react";
import { motion, type Variants } from "framer-motion";
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
  Hash,
  Award,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────
   Types & Mock Data
   ────────────────────────────────────────────── */
type AppraisalStatus =
  | "PENDING_SELF_ASSESSMENT"
  | "PENDING_HEAD_REVIEW"
  | "PENDING_HR_CALIBRATION"
  | "PENDING_BOARD_APPROVAL"
  | "APPROVED"
  | "REJECTED";

type Employee = {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  department: string;
  category: "Academic" | "Support Staff" | "Blue-Collar";
  subCategory: string;
  rawScore: number;
  initialRating: string;
  calibratedRating: string | null;
  status: AppraisalStatus;
  template: string;
  approvedIncrement: number | null;
};

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "1",
    name: "Dr. Ayesha Khan",
    employeeId: "EMP-2024-001",
    email: "ayesha.khan@uol.edu.pk",
    department: "Pharmacy",
    category: "Academic",
    subCategory: "Senior Faculty",
    rawScore: 87,
    initialRating: "Outstanding",
    calibratedRating: "Excellent",
    status: "APPROVED",
    template: "2026 Annual Faculty Template",
    approvedIncrement: 12.5,
  },
  {
    id: "2",
    name: "Mr. Bilal Ahmed",
    employeeId: "EMP-2024-045",
    email: "bilal.ahmed@uol.edu.pk",
    department: "Engineering",
    category: "Academic",
    subCategory: "Associate Professor",
    rawScore: 72,
    initialRating: "Excellent",
    calibratedRating: null,
    status: "PENDING_HR_CALIBRATION",
    template: "2026 Annual Faculty Template",
    approvedIncrement: null,
  },
  {
    id: "3",
    name: "Ms. Sara Malik",
    employeeId: "EMP-2024-112",
    email: "sara.malik@uol.edu.pk",
    department: "Allied Health Sciences",
    category: "Support Staff",
    subCategory: "Lab Coordinator",
    rawScore: 65,
    initialRating: "Good",
    calibratedRating: null,
    status: "PENDING_HEAD_REVIEW",
    template: "2026 Support Staff Template",
    approvedIncrement: null,
  },
  {
    id: "4",
    name: "Mr. Imran Hussain",
    employeeId: "EMP-2024-203",
    email: "imran.h@uol.edu.pk",
    department: "Engineering",
    category: "Blue-Collar",
    subCategory: "Maintenance",
    rawScore: 58,
    initialRating: "Satisfactory",
    calibratedRating: null,
    status: "PENDING_SELF_ASSESSMENT",
    template: "2026 Blue-Collar Template",
    approvedIncrement: null,
  },
  {
    id: "5",
    name: "Dr. Fatima Raza",
    employeeId: "EMP-2024-089",
    email: "fatima.raza@uol.edu.pk",
    department: "Pharmacy",
    category: "Academic",
    subCategory: "Professor",
    rawScore: 91,
    initialRating: "Outstanding",
    calibratedRating: "Outstanding",
    status: "PENDING_BOARD_APPROVAL",
    template: "2026 Annual Faculty Template",
    approvedIncrement: 15.0,
  },
  {
    id: "6",
    name: "Mr. Usman Tariq",
    employeeId: "EMP-2024-156",
    email: "usman.t@uol.edu.pk",
    department: "Business Administration",
    category: "Academic",
    subCategory: "Lecturer",
    rawScore: 45,
    initialRating: "Unsatisfactory",
    calibratedRating: null,
    status: "PENDING_HEAD_REVIEW",
    template: "2026 Annual Faculty Template",
    approvedIncrement: null,
  },
  {
    id: "7",
    name: "Ms. Nadia Sheikh",
    employeeId: "EMP-2024-078",
    email: "nadia.s@uol.edu.pk",
    department: "Allied Health Sciences",
    category: "Support Staff",
    subCategory: "Admin Officer",
    rawScore: 78,
    initialRating: "Excellent",
    calibratedRating: "Excellent",
    status: "APPROVED",
    template: "2026 Support Staff Template",
    approvedIncrement: 9.5,
  },
  {
    id: "8",
    name: "Mr. Kamran Ali",
    employeeId: "EMP-2024-334",
    email: "kamran.ali@uol.edu.pk",
    department: "Engineering",
    category: "Blue-Collar",
    subCategory: "Technician",
    rawScore: 62,
    initialRating: "Good",
    calibratedRating: null,
    status: "PENDING_SELF_ASSESSMENT",
    template: "2026 Blue-Collar Template",
    approvedIncrement: null,
  },
  {
    id: "9",
    name: "Dr. Hassan Raza",
    employeeId: "EMP-2024-412",
    email: "hassan.raza@uol.edu.pk",
    department: "Law",
    category: "Academic",
    subCategory: "Associate Professor",
    rawScore: 81,
    initialRating: "Excellent",
    calibratedRating: "Excellent",
    status: "APPROVED",
    template: "2026 Annual Faculty Template",
    approvedIncrement: 11.0,
  },
  {
    id: "10",
    name: "Ms. Hina Qureshi",
    employeeId: "EMP-2024-267",
    email: "hina.q@uol.edu.pk",
    department: "CS & IT",
    category: "Academic",
    subCategory: "Senior Lecturer",
    rawScore: 76,
    initialRating: "Excellent",
    calibratedRating: null,
    status: "PENDING_HR_CALIBRATION",
    template: "2026 Annual Faculty Template",
    approvedIncrement: null,
  },
  {
    id: "11",
    name: "Mr. Adnan Siddiqui",
    employeeId: "EMP-2024-521",
    email: "adnan.s@uol.edu.pk",
    department: "Business Administration",
    category: "Support Staff",
    subCategory: "Finance Officer",
    rawScore: 69,
    initialRating: "Good",
    calibratedRating: null,
    status: "PENDING_HEAD_REVIEW",
    template: "2026 Support Staff Template",
    approvedIncrement: null,
  },
  {
    id: "12",
    name: "Dr. Zainab Iqbal",
    employeeId: "EMP-2024-098",
    email: "zainab.i@uol.edu.pk",
    department: "Pharmacy",
    category: "Academic",
    subCategory: "Assistant Professor",
    rawScore: 52,
    initialRating: "Needs Improvement",
    calibratedRating: null,
    status: "REJECTED",
    template: "2026 Annual Faculty Template",
    approvedIncrement: null,
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

const completionData = [
  { category: "Academic", selfAssessment: 85, headReview: 72, hrCalibration: 45, approved: 30 },
  { category: "Support Staff", selfAssessment: 70, headReview: 55, hrCalibration: 30, approved: 20 },
  { category: "Blue-Collar", selfAssessment: 45, headReview: 30, hrCalibration: 15, approved: 10 },
];

const departmentData = [
  { department: "Pharmacy", avgScore: 82 },
  { department: "Engineering", avgScore: 74 },
  { department: "Allied Health", avgScore: 79 },
  { department: "Business Admin", avgScore: 68 },
  { department: "Law", avgScore: 76 },
  { department: "CS & IT", avgScore: 85 },
];

/* ──────────────────────────────────────────────
   Animation Variants
   ────────────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as const },
  },
};

/* ──────────────────────────────────────────────
   Status Config
   ────────────────────────────────────────────── */
const STATUS_CONFIG: Record<
  AppraisalStatus,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  PENDING_SELF_ASSESSMENT: {
    label: "Self Assessment",
    color: "text-slate-600",
    bg: "bg-slate-100",
    icon: Clock,
  },
  PENDING_HEAD_REVIEW: {
    label: "Head Review",
    color: "text-amber-700",
    bg: "bg-amber-50",
    icon: AlertTriangle,
  },
  PENDING_HR_CALIBRATION: {
    label: "HR Calibration",
    color: "text-orange-700",
    bg: "bg-orange-50",
    icon: Scale,
  },
  PENDING_BOARD_APPROVAL: {
    label: "Board Approval",
    color: "text-blue-700",
    bg: "bg-blue-50",
    icon: Award,
  },
  APPROVED: {
    label: "Approved",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    color: "text-red-700",
    bg: "bg-red-50",
    icon: XCircle,
  },
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
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "navy" | "amber" | "orange" | "emerald";
  icon: React.ElementType;
  delay: number;
  onClick?: () => void;
}) {
  const tones = {
    navy: {
      border: "border-slate-200 dark:border-slate-700",
      bg: "bg-white dark:bg-slate-900",
      accent: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      value: "text-slate-900 dark:text-white",
      top: "from-slate-700 via-slate-600 to-slate-700",
    },
    amber: {
      border: "border-amber-200 dark:border-amber-800/50",
      bg: "bg-white dark:bg-slate-900",
      accent: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
      value: "text-amber-700 dark:text-amber-400",
      top: "from-amber-600 via-amber-500 to-amber-600",
    },
    orange: {
      border: "border-orange-200 dark:border-orange-800/50",
      bg: "bg-white dark:bg-slate-900",
      accent: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
      value: "text-orange-700 dark:text-orange-400",
      top: "from-orange-600 via-orange-500 to-orange-600",
    },
    emerald: {
      border: "border-emerald-200 dark:border-emerald-800/50",
      bg: "bg-white dark:bg-slate-900",
      accent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
      value: "text-emerald-700 dark:text-emerald-400",
      top: "from-emerald-600 via-emerald-500 to-emerald-600",
    },
  };

  const t = tones[tone];

  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-300 hover:shadow-md",
        t.border,
        t.bg
      )}
    >
      <div className={cn("absolute left-0 right-0 top-0 h-1 bg-gradient-to-r", t.top)} />
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className={cn("text-3xl font-bold tracking-tight tabular-nums", t.value)}>
            {value}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500">{subtitle}</p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", t.accent)}>
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
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay: number;
  className?: string;
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
      <div className="mb-6">
        <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{subtitle}</p>
        )}
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
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-slate-800">
      <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600 dark:text-slate-400">{entry.name}:</span>
          <span className="font-semibold text-slate-900 dark:text-white">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main Dashboard
   ────────────────────────────────────────────── */
export default function HRDashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL" as AppraisalStatus | "ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  /* ── Derived Stats ── */
  const totalEmployees = MOCK_EMPLOYEES.length;
  const submittedCount = MOCK_EMPLOYEES.filter(
    (e) => e.status !== "PENDING_SELF_ASSESSMENT"
  ).length;
  const completionRate = ((submittedCount / totalEmployees) * 100).toFixed(1);

  const pendingHeadCount = MOCK_EMPLOYEES.filter(
    (e) => e.status === "PENDING_HEAD_REVIEW"
  ).length;

  const pendingCalibrationCount = MOCK_EMPLOYEES.filter(
    (e) => e.status === "PENDING_HR_CALIBRATION"
  ).length;

  const totalApprovedIncrement = MOCK_EMPLOYEES.reduce((sum, e) => {
    return sum + (e.approvedIncrement ?? 0);
  }, 0);

  /* ── Filtered Table Data ── */
  const filteredEmployees = useMemo(() => {
    return MOCK_EMPLOYEES.filter((e) => {
      const matchesSearch =
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || e.status === statusFilter;
      const matchesCategory = categoryFilter === "ALL" || e.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [searchQuery, statusFilter, categoryFilter]);

  /* ── Filter Handlers ── */
  const filterByStatus = (status: AppraisalStatus) => {
    setStatusFilter(status === statusFilter ? "ALL" : status);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto  px-4  sm:px-6">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] as const }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Performance Management
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Fiscal Year 2026 — Annual Appraisal Cycle Overview
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5">
                <Download className="h-4 w-4" />
                Export
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-amber-600 dark:hover:bg-amber-500">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
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
            title="Active Cycle Progress"
            value={`${completionRate}%`}
            subtitle={`${submittedCount} / ${totalEmployees} Forms Submitted`}
            tone="navy"
            icon={TrendingUp}
            delay={0}
          />
          <StatCard
            title="Awaiting Head Review"
            value={pendingHeadCount.toString()}
            subtitle="Requires Line Manager Confirmation"
            tone="amber"
            icon={AlertTriangle}
            delay={0.1}
            onClick={() => filterByStatus("PENDING_HEAD_REVIEW")}
          />
          <StatCard
            title="Ready for HR Calibration"
            value={pendingCalibrationCount.toString()}
            subtitle="Score & Rating (1) completed"
            tone="orange"
            icon={Scale}
            delay={0.2}
            onClick={() => filterByStatus("PENDING_HR_CALIBRATION")}
          />
          <StatCard
            title="Total Approved Increment"
            value={`${totalApprovedIncrement.toFixed(1)}%`}
            subtitle="Based on final Board approvals"
            tone="emerald"
            icon={Banknote}
            delay={0.3}
          />
        </motion.div>

        {/* ── Charts Section ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3"
        >
          {/* Chart A: Calibration Curve */}
          <ChartCard
            title="Calibration Curve"
            subtitle="Institutional Quota vs. Actual Ratings Distribution"
            delay={0.35}
            className="lg:col-span-2"
          >
            <div className="h-[300px]">
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
                  <XAxis
                    dataKey="rating"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Area
                    type="monotone"
                    dataKey="quota"
                    name="Institutional Quota"
                    stroke="#64748b"
                    strokeWidth={2}
                    fill="url(#quotaGrad)"
                    dot={{ r: 4, fill: "#64748b", strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name="Actual Distribution"
                    stroke="#d97706"
                    strokeWidth={2}
                    fill="url(#actualGrad)"
                    dot={{ r: 4, fill: "#d97706", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Chart C: Departmental Spread */}
          <ChartCard
            title="Faculty Performance"
            subtitle="Average system raw score by faculty"
            delay={0.4}
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="department"
                    type="category"
                    width={100}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgScore" name="Avg Score" radius={[0, 4, 4, 0]} barSize={20}>
                    {departmentData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i % 2 === 0 ? "#0f172a" : "#d97706"}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </motion.div>

        {/* Chart B: Completion by Category (Full Width) */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <ChartCard
            title="Completion Status by Faculty Category"
            subtitle="Progression through appraisal workflow stages"
            delay={0.45}
            className="mb-8"
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    unit="%"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="selfAssessment" name="Self Assessment" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="headReview" name="Head Review" stackId="a" fill="#d97706" />
                  <Bar dataKey="hrCalibration" name="HR Calibration" stackId="a" fill="#ea580c" />
                  <Bar dataKey="approved" name="Approved" stackId="a" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </motion.div>

        {/* ── Filters ── */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.5 }}
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              Appraisal Ledger
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {filteredEmployees.length} records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, ID, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-64 rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400",
                  "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                  "dark:border-white/10 dark:bg-slate-900 dark:text-white"
                )}
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AppraisalStatus | "ALL")}
                className={cn(
                  "appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm text-slate-700",
                  "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                  "dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                )}
              >
                <option value="ALL">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={cn(
                  "appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm text-slate-700",
                  "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                  "dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                )}
              >
                <option value="ALL">All Categories</option>
                <option value="Academic">Academic</option>
                <option value="Support Staff">Support Staff</option>
                <option value="Blue-Collar">Blue-Collar</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </motion.div>

        {/* ── Data Table ── */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.55 }}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-white/[0.02]">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Employee
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tier Group
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Department
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Raw Score
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Current Rating
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Workflow Status
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.03]">
                {filteredEmployees.map((employee, index) => {
                  const statusConfig = STATUS_CONFIG[employee.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <motion.tr
                      key={employee.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.4,
                        delay: 0.6 + index * 0.05,
                        ease: [0.23, 1, 0.32, 1] as const,
                      }}
                      className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5">
                            <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {employee.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              {employee.employeeId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {employee.category}
                        </span>
                        <p className="mt-1 text-xs text-slate-500">{employee.subCategory}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-slate-700 dark:text-slate-300">
                            {employee.department}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                            {employee.rawScore}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                            employee.calibratedRating
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          )}
                        >
                          {employee.calibratedRating || employee.initialRating}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                            statusConfig.bg,
                            statusConfig.color
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-amber-600 dark:hover:bg-amber-500">
                          <Eye className="h-3.5 w-3.5" />
                          View
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredEmployees.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <Search className="h-10 w-10 text-slate-300 dark:text-slate-700" />
              <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-500">
                No records match your filters
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setCategoryFilter("ALL");
                }}
                className="mt-2 text-xs text-amber-600 hover:underline dark:text-amber-400"
              >
                Clear all filters
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}