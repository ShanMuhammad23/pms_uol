"use client";

interface PrintFooterProps {
  text?: string;
}

export default function PrintFooter({
  text = "This document is digitally verified and does not require signatures.",
}: PrintFooterProps) {
  return (
    <div className="print-only" style={{ display: "none" }}>
      <div className="print-doc-footer">{text}</div>
    </div>
  );
}
