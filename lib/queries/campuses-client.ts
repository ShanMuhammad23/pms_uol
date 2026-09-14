import type { CampusRecord, CreateCampusInput, UpdateCampusInput } from "@/types/campuses";

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

export async function updateCampus(
  id: number,
  input: UpdateCampusInput,
): Promise<CampusRecord> {
  const response = await fetch(`/api/campuses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to update campus.");
  }
  return data as CampusRecord;
}

export async function deleteCampus(id: number): Promise<void> {
  const response = await fetch(`/api/campuses/${id}`, {
    method: "DELETE",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to delete campus.");
  }
}
