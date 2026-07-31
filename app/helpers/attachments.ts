import type { EmployeeFormAnswerAttachment } from "@/types/employee-forms";

/** Human-readable file size, e.g. `12.3 KB`. Shared across all attachment UIs. */
export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Download URL for an attachment scoped to a submission detail view.
 *
 * Access is authorised through the same RBAC as the submission detail page,
 * so every reviewer role (Manager 1/2, HR, Board, Super Admin) can download
 * attachments uploaded by the employee.
 */
export function getSubmissionAttachmentDownloadUrl(
  submissionId: number,
  attachmentId: number,
): string {
  return `/api/submissions/${submissionId}/attachments/${attachmentId}`;
}

/** Sort attachments by upload time then id (stable, matches DB ordering). */
export function sortAttachments(
  attachments: EmployeeFormAnswerAttachment[],
): EmployeeFormAnswerAttachment[] {
  return [...attachments].sort((a, b) => {
    const timeA = Date.parse(a.createdAt ?? "");
    const timeB = Date.parse(b.createdAt ?? "");
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
      return timeA - timeB;
    }
    return a.id - b.id;
  });
}
