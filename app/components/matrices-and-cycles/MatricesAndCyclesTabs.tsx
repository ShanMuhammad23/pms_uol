"use client";

import { CalendarRange, Grid3X3, Percent, TrendingUp } from "lucide-react";
import { useState } from "react";
import FinancialYearsManager from "./FinancialYearsManager";
import IncrementMatrixManager from "./IncrementMatrixManager";
import InstitutionalQuotaManager from "./InstitutionalQuotaManager";
import PerformanceMatricesManager from "./PerformanceMatricesManager";

type TabId =
  | "financial-year"
  | "matrices"
  | "increment-matrix"
  | "institutional-quota";

const tabs: Array<{
  id: TabId;
  label: string;
  description: string;
  icon: typeof CalendarRange;
}> = [
  { id: "financial-year", label: "Financial Year", description: "Cycle dates", icon: CalendarRange },
  { id: "matrices", label: "Matrices", description: "Levels & quartiles", icon: Grid3X3 },
  { id: "increment-matrix", label: "Increment Matrix", description: "Sub-category %", icon: TrendingUp },
  { id: "institutional-quota", label: "Institutional Quota", description: "Allocation caps", icon: Percent },
];

export default function MatricesAndCyclesTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("financial-year");

  return (
    <div className="space-y-6">
      <nav
        aria-label="Matrices and cycles tabs"
        className="flex gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-white/10 dark:bg-white/5"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`group flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-left transition-colors ${
                isActive
                  ? "bg-primary text-white"
                  : "text-foreground/70 hover:bg-primary/5 hover:text-text-primary"
              }`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "bg-primary/10 text-primary group-hover:bg-primary/15"
                }`}
              >
                <Icon className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold leading-tight">{tab.label}</span>
                <span
                  className={`text-[11px] leading-tight ${
                    isActive ? "text-white/70" : "text-foreground/50"
                  }`}
                >
                  {tab.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="h-1 w-full bg-secondary" />
        <div className="p-5 sm:p-6">
          {activeTab === "financial-year" ? <FinancialYearsManager /> : null}
          {activeTab === "matrices" ? <PerformanceMatricesManager /> : null}
          {activeTab === "increment-matrix" ? <IncrementMatrixManager /> : null}
          {activeTab === "institutional-quota" ? <InstitutionalQuotaManager /> : null}
        </div>
      </div>
    </div>
  );
}