"use client";

export interface OrgReportNode {
  id: number;
  name: string;
  categoryCode: string;
  parentEntityId: number | null;
  campusName: string | null;
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
  manager1Assigned: number;
  manager2Assigned: number;
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

export interface OrgReportRecord {
  userId: number;
  employeeId: string;
  employeeName: string;
  email: string | null;
  orgLevel1Name: string | null;
  orgLevel2Name: string | null;
  manager1Name: string | null;
  manager2Name: string | null;
  status: string | null;
}

export async function fetchOrganizationReportRecords(
  entityId: number | null,
  column: string,
): Promise<OrgReportRecord[]> {
  const params = new URLSearchParams({ column });
  if (entityId != null) params.set("entityId", String(entityId));
  const response = await fetch(
    `/api/reports/organization-hierarchy/records?${params.toString()}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error("Failed to load report records.");
  }
  const data = await response.json();
  return data.records as OrgReportRecord[];
}
