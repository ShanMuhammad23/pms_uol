"use client";

import Image from "next/image";

export interface PrintDocumentMetaItem {
  label: string;
  value: string | number | null | undefined;
}

interface PrintDocumentHeaderProps {
  title: string;
  description?: string | null;
  systemName?: string;
  logoSrc?: string;
  metaItems?: PrintDocumentMetaItem[];
}

export default function PrintDocumentHeader({
  title,
  description,
  systemName = "Performance Management System — University of Lahore",
  logoSrc = "/logo.png",
  metaItems = [],
}: PrintDocumentHeaderProps) {
  const printDate = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="print-only" style={{ display: "none" }}>
      <div className="print-doc-header">
        {logoSrc ? (
          <Image
            src={logoSrc}
            alt="Logo"
            width={120}
            height={50}
            className="print-doc-logo"
            priority
          />
        ) : null}
        <div className="print-doc-title-block">
          <p className="print-doc-system-name">{systemName}</p>
          <p className="print-doc-title">{title}</p>
          {description?.trim() ? (
            <p className="print-doc-description">{description.trim()}</p>
          ) : null}
        </div>
      </div>
      <div className="print-doc-meta">
        {metaItems.map((item) => (
          <span key={item.label} className="print-doc-meta-item">
            <span className="print-doc-meta-label">{item.label}:</span>
            <span>{item.value ?? "—"}</span>
          </span>
        ))}
        <span className="print-doc-meta-item">
          <span className="print-doc-meta-label">Printed:</span>
          <span>{printDate}</span>
        </span>
      </div>
    </div>
  );
}
