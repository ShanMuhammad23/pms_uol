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

const tabs: Array<{ id: TabId; label: string; icon: typeof CalendarRange }> = [
  { id: "financial-year", label: "Financial Year", icon: CalendarRange },
  { id: "matrices", label: "Matrices", icon: Grid3X3 },
  { id: "increment-matrix", label: "Increment Matrix", icon: TrendingUp },
  { id: "institutional-quota", label: "Institutional Quota", icon: Percent },
];

export default function MatricesAndCyclesTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("financial-year");

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-300/80 dark:border-white/15">
        <nav
          aria-label="Matrices and cycles tabs"
          className="-mb-px flex gap-1 overflow-x-auto"
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
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground/70 hover:border-primary/40 hover:text-text-primary"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === "financial-year" ? <FinancialYearsManager /> : null}
      {activeTab === "matrices" ? <PerformanceMatricesManager /> : null}
      {activeTab === "increment-matrix" ? <IncrementMatrixManager /> : null}
      {activeTab === "institutional-quota" ? <InstitutionalQuotaManager /> : null}
    </div>
  );
}
