// BrandingPanel.tsx
"use client";

import { motion } from "framer-motion";
import { BarChart3, GraduationCap, UsersRound, ShieldCheck } from "lucide-react";
import Image from "next/image";

const highlights = [
  {
    title: "Align goals with strategy",
    description: "Track team and individual performance against organizational priorities.",
    icon: BarChart3,
  },
  {
    title: "Grow future leaders",
    description: "Build succession pipelines with clear skill development milestones.",
    icon: UsersRound,
  },
  {
    title: "Reward high impact",
    description: "Use fair, data-driven evaluations to recognize top contributors.",
    icon: GraduationCap,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] },
  },
};

export function BrandingPanel() {
  return (
    <aside className="relative hidden w-1/2 overflow-hidden bg-slate-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
      {/* Subtle architectural grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Warm ambient glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-amber-900/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-slate-700/30 blur-[100px]" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex h-full flex-col justify-between"
      >
        {/* Top: Logo + Title */}
        <div className="max-w-md space-y-5">
          <motion.div variants={itemVariants} className="relative h-16 w-48">
            <Image
              src="/logo.png"
              alt="University of Lahore logo"
              fill
              className="object-contain brightness-0 invert"
              priority
            />
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Performance Management System
            </h1>
            <p className="text-base leading-relaxed text-slate-300">
              University of Lahore — Faculty & Staff Performance Evaluation Platform. 
              Empowering managers and teams with transparent goals, fair reviews, and 
              succession insight.
            </p>
          </motion.div>

          {/* Trust badge */}
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 backdrop-blur-sm"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            FERPA-compliant secure records
          </motion.div>
        </div>

        {/* Bottom: Highlight Cards */}
        <div className="mt-8 grid gap-3">
          {highlights.map(({ title, description, icon: Icon }) => (
            <motion.article
              key={title}
              variants={itemVariants}
              whileHover={{ x: 4, transition: { duration: 0.2 } }}
              className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.06]"
            >
              <div className="mb-2.5 inline-flex rounded-lg bg-amber-500/10 p-2 text-amber-400 transition-colors group-hover:bg-amber-500/20">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{description}</p>
            </motion.article>
          ))}
        </div>
      </motion.div>
    </aside>
  );
}