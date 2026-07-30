export async function fetchUniqueDesignations(): Promise<string[]> {
  const response = await fetch("/api/designations", { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load designations.");
  }

  return data as string[];
}
