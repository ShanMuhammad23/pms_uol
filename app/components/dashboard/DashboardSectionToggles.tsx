"use client";

import type { ElementType } from "react";
import { BarChart3, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SectionToggleButtonProps {
  label: string;
  visible: boolean;
  onToggle: () => void;
  icon: ElementType;
}

function SectionToggleButton({
  label,
  visible,
  onToggle,
  icon: Icon,
}: SectionToggleButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      aria-label={visible ? `Hide ${label}` : `Show ${label}`}
      title={visible ? `Hide ${label}` : `Show ${label}`}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg transition-colors duration-200",
        visible
          ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          : "border-primary/20 bg-primary text-white hover:bg-primary/90 dark:border-slate-500",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="text-xs font-semibold tracking-wide">{label}</span>
    </motion.button>
  );
}

interface DashboardSectionTogglesProps {
  statsVisible: boolean;
  onToggleStats: () => void;
  chartsVisible: boolean;
  onToggleCharts: () => void;
}

export function DashboardSectionToggles({
  statsVisible,
  onToggleStats,
  chartsVisible,
  onToggleCharts,
}: DashboardSectionTogglesProps) {
  return (
    <div className="fixed top-1/2 right-3 z-40 flex -translate-y-1/2 flex-col gap-2 sm:right-4">
      <SectionToggleButton
        label="Stats"
        visible={statsVisible}
        onToggle={onToggleStats}
        icon={LayoutGrid}
      />
      <SectionToggleButton
        label="Charts"
        visible={chartsVisible}
        onToggle={onToggleCharts}
        icon={BarChart3}
      />
    </div>
  );
}
