"use client";

import { Paperclip } from "lucide-react";
import type { EmployeeFormAnswerAttachment } from "@/types/employee-forms";
import {
  formatBytes,
  sortAttachments,
} from "@/app/helpers/attachments";

interface AttachmentListProps {
  attachments: EmployeeFormAnswerAttachment[];
  /** Function that builds the download URL for a given attachment id. */
  buildDownloadUrl: (attachmentId: number) => string;
  /** Compact rendering for table cells. Defaults to false. */
  compact?: boolean;
}

/**
 * Read-only attachment list shared across all assessment modules
 * (Manager 1/2, HR, Board, Super Admin, Direct Assessment, Print).
 *
 * This component never mutates attachments — it only displays them and links
 * to the role-appropriate download endpoint. Reusing it everywhere guarantees
 * identical attachment rendering for every authorised reviewer.
 */
export default function AttachmentList({
  attachments,
  buildDownloadUrl,
  compact = false,
}: AttachmentListProps) {
  const sorted = sortAttachments(attachments);

  if (sorted.length === 0) {
    return <span className="text-slate-400">—</span>;
  }

  if (compact) {
    return (
      <ul className="space-y-0.5">
        {sorted.map((attachment) => (
          <li key={attachment.id}>
            <a
              href={buildDownloadUrl(attachment.id)}
              className="inline-flex min-w-0 max-w-full items-center gap-1 truncate text-[11px] font-medium text-primary hover:underline"
              title={attachment.originalFilename}
            >
              <Paperclip className="size-3 shrink-0" />
              <span className="truncate">{attachment.originalFilename}</span>
              <span className="shrink-0 text-slate-400">
                ({formatBytes(attachment.sizeBytes)})
              </span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-1.5">
      {sorted.map((attachment) => (
        <li
          key={attachment.id}
          className="flex items-start justify-between gap-2 rounded border border-slate-200 px-2 py-1.5 dark:border-white/10"
        >
          <a
            href={buildDownloadUrl(attachment.id)}
            className="min-w-0 flex-1 truncate text-[11px] font-medium text-primary hover:underline"
            title={attachment.originalFilename}
          >
            {attachment.originalFilename}
            <span className="ml-1 text-slate-400">
              ({formatBytes(attachment.sizeBytes)})
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
