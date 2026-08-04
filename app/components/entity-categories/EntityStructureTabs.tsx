"use client";

import { Building2, List, Network } from "lucide-react";
import { useState } from "react";
import EntitiesManager from "./EntitiesManager";
import EntityCategoriesManager from "./EntityCategoriesManager";
import OrganizationTree from "./OrganizationTree";

type TabId = "categories" | "entities" | "tree";

const tabs: Array<{ id: TabId; label: string; icon: typeof List }> = [
  { id: "categories", label: "Level Categories", icon: List },
  { id: "entities", label: "Organization Levels", icon: Building2 },
  { id: "tree", label: "Organization Tree", icon: Network },
];

export default function EntityStructureTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("categories");

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-300/80 dark:border-white/15">
        <nav
          aria-label="Entity management tabs"
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

      {activeTab === "categories" ? <EntityCategoriesManager /> : null}
      {activeTab === "entities" ? <EntitiesManager /> : null}
      {activeTab === "tree" ? <OrganizationTree /> : null}
    </div>
  );
}
