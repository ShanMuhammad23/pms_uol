// BrandingPanel.tsx
"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  Target,
  BarChart3,
  Landmark,
  ShieldCheck,
  ArrowUpRight,
  UsersRound,
  Award,
} from "lucide-react";
import Image from "next/image";

const highlights = [
  {
    title: "Strategic Goal Alignment",
    description:
      "Cascade organizational objectives from leadership to individual contributors with measurable KPIs.",
    icon: Target,
    metric: "",
    metricLabel: "Goal Coverage",
  },
  {
    title: "Continuous Performance Review",
    description:
      "Move beyond annual cycles with quarterly check-ins, 360° feedback, and competency tracking.",
    icon: BarChart3,
    metric: "",
    metricLabel: "Current Cycle",
  },
  {
    title: "Financial Impact Calibration",
    description:
      "Link performance outcomes to compensation, increments, and succession planning budgets.",
    icon: TrendingUp,
    metric: "",
    metricLabel: "Approved Load",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.18, delayChildren: 0.4 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.23, 1, 0.32, 1] },
  },
};

export function BrandingPanel() {
  return (
    <aside className="relative hidden w-1/2 overflow-hidden bg-slate-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
      {/* ── Layered Background ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Deep base */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />

        {/* Ascending bars — growth metaphor */}
        <svg
          className="absolute bottom-0 left-0 right-0 opacity-[0.06]"
          viewBox="0 0 800 400"
          preserveAspectRatio="none"
        >
          <rect x="0" y="320" width="80" height="80" fill="currentColor" />
          <rect x="100" y="280" width="80" height="120" fill="currentColor" />
          <rect x="200" y="240" width="80" height="160" fill="currentColor" />
          <rect x="300" y="200" width="80" height="200" fill="currentColor" />
          <rect x="400" y="160" width="80" height="240" fill="currentColor" />
          <rect x="500" y="120" width="80" height="280" fill="currentColor" />
          <rect x="600" y="80" width="80" height="320" fill="currentColor" />
          <rect x="700" y="40" width="80" height="360" fill="currentColor" />
        </svg>

        {/* Subtle grid — structure & assessment */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Warm ambient glow — financial warmth */}
        <div className="absolute -right-32 top-1/4 h-[500px] w-[500px] rounded-full bg-amber-600/8 blur-[120px]" />
        <div className="absolute -left-20 bottom-1/4 h-[400px] w-[400px] rounded-full bg-emerald-600/6 blur-[100px]" />

        {/* Radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.4)_100%)]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex h-full flex-col justify-between"
      >
        {/* ── Top: Identity ── */}
        <div className="max-w-lg space-y-6">
          <motion.div variants={itemVariants} className="flex items-center gap-4">
            <div className="relative h-14 w-52">
              <Image
                src="/logo.png"
                alt="University of Lahore logo"
                fill
                className="object-contain brightness-0 invert"
                priority
              />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
              <Landmark className="h-3.5 w-3.5" />
              Fiscal Year 2026
            </div>
            <h1 className="text-[2.75rem] font-bold leading-[1.1] tracking-tight">
              Performance {" "}
              <span className="text-amber-400">Management System</span>
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-slate-400">
              A unified platform for goal setting, continuous assessment, and
              compensation calibration across all university functions and staff
              categories.
            </p>
          </motion.div>

          
        </div>

        {/* ── Bottom: Highlight Cards ── */}
        <div className="mt-10 grid gap-3">
          {highlights.map(({ title, description, icon: Icon, metric, metricLabel }) => (
            <motion.article
              key={title}
              variants={itemVariants}
              whileHover={{ x: 6, transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] } }}
              className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm transition-colors hover:border-amber-500/20 hover:bg-white/[0.04]"
            >
              {/* Subtle top accent per card */}
              <div className="absolute left-0 top-0 h-px w-0 bg-gradient-to-r from-amber-500/50 to-transparent transition-all duration-500 group-hover:w-full" />

              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 transition-colors group-hover:bg-amber-500/20">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">{title}</h2>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                      {description}
                    </p>
                  </div>
                </div>

                {/* Metric pill */}
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold tabular-nums text-amber-400">
                    {metric}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    {metricLabel}
                  </p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

       
      </motion.div>
    </aside>
  );
}