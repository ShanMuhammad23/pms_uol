import type { CampusRecord, CreateCampusInput } from "@/types/campuses";

export async function fetchCampuses(): Promise<CampusRecord[]> {
  const response = await fetch("/api/campuses", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load campuses.");
  }
  return data as CampusRecord[];
}

export async function createCampus(
  input: CreateCampusInput,
): Promise<CampusRecord> {
  const response = await fetch("/api/campuses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to create campus.");
  }
  return data as CampusRecord;
}
