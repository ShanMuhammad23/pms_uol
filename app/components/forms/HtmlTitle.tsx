"use client";

import { cn } from "@/lib/utils";
import { escapeHtmlText, toSafeHtmlTitle } from "@/lib/html-title";
import {
  getSectionLabelSuffix,
  getSubsectionLabelSuffix,
  type FormTableRow,
} from "@/app/helpers/form-table-rows";

interface HtmlTitleProps {
  html: string | null | undefined;
  className?: string;
}

export function HtmlTitle({ html, className }: HtmlTitleProps) {
  const safe = toSafeHtmlTitle(html);
  if (!safe) {
    return null;
  }

  return (
    <div
      className={cn("form-html-title", className)}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

function HtmlLabel({
  prefix,
  html,
  suffix,
}: {
  prefix: string;
  html: string | null | undefined;
  suffix: string;
}) {
  const title = toSafeHtmlTitle(html);
  const combined = `${escapeHtmlText(prefix)}${title}${escapeHtmlText(suffix)}`;
  if (!combined.trim()) {
    return null;
  }

  return (
    <div
      className="form-html-title"
      dangerouslySetInnerHTML={{ __html: combined }}
    />
  );
}

export function FormHtmlSectionLabel({ row }: { row: FormTableRow }) {
  const prefix =
    row.sectionNumber != null ? `Section ${row.sectionNumber}: ` : "";
  return (
    <HtmlLabel
      prefix={prefix}
      html={row.sectionTitle}
      suffix={getSectionLabelSuffix(row)}
    />
  );
}

export function FormHtmlSubsectionLabel({ row }: { row: FormTableRow }) {
  const prefix = row.subsectionNumber ? `${row.subsectionNumber} ` : "";
  return (
    <HtmlLabel
      prefix={prefix}
      html={row.subsectionTitle}
      suffix={getSubsectionLabelSuffix(row)}
    />
  );
}
