"use client";

export interface OrgReportNode {
  id: number;
  name: string;
  categoryCode: string;
  parentEntityId: number | null;
  directStaffCount: number;
  subtreeStaffCount: number;
  eligible: number;
  formsAssigned: number;
  formsNotAssigned: number;
  directScoreEntry: number;
  managerDirectAssessment: number;
  performanceMatrixAssigned: number;
  incrementMatrixAssigned: number;
  selfAssessed: number;
  assessedByManager1: number;
  assessedByManager2: number;
  hrAlignment: number;
  boardApproval: number;
  children: OrgReportNode[];
}

export async function fetchOrganizationReport(): Promise<OrgReportNode[]> {
  const url = "/api/reports/organization-hierarchy";
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load organization report.");
  }
  const data = await response.json();
  return data.tree as OrgReportNode[];
}
