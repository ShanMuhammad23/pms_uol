import type {
  FormSubmissionDetail,
  FormSubmissionListItem,
} from "@/types/form-submissions";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchFormSubmissions(): Promise<FormSubmissionListItem[]> {
  const response = await fetch("/api/submissions", { cache: "no-store" });
  return parseResponse<FormSubmissionListItem[]>(response);
}

export async function fetchFormSubmission(
  id: number,
): Promise<FormSubmissionDetail> {
  const response = await fetch(`/api/submissions/${id}`);
  return parseResponse<FormSubmissionDetail>(response);
}
