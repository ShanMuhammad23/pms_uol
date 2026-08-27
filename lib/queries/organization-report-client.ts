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
  assessedByManagers: number;
  hrAlignment: number;
  boardApproval: number;
  children: OrgReportNode[];
}

export async function fetchOrganizationReport(): Promise<OrgReportNode[]> {
  const response = await fetch("/api/reports/organization-hierarchy");
  if (!response.ok) {
    throw new Error("Failed to load organization report.");
  }
  const data = await response.json();
  return data.tree as OrgReportNode[];
}
