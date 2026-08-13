"use client";

import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import { useCallback } from "react";
import { buildAskHrGmailUrl } from "@/lib/config";

interface AskHrButtonProps {
  /**
   * Optional non-sensitive identifier appended to the email subject, e.g. the
   * assessment/form title. Sensitive data must not be passed here.
   */
  subjectSuffix?: string;
}

/**
 * Floating "Ask HR" action button.
 *
 * Opens Gmail Web compose in a new browser tab with the configured HR address
 * pre-populated in the To field. This deliberately uses Gmail's web compose URL
 * instead of `mailto:` so the OS default mail client (e.g. Outlook) is not
 * invoked. The application does not send the email — the employee reviews and
 * sends it from their own Gmail account. A prominent notice makes clear that
 * HR's reply will arrive in the employee's email inbox.
 *
 * Rendered as a fixed bottom-right floating button so it stays available while
 * an employee completes an assessment without covering submit/save controls.
 */
export default function AskHrButton({ subjectSuffix }: AskHrButtonProps) {
  const openGmail = useCallback(() => {
    const url = buildAskHrGmailUrl({
      subject: subjectSuffix ? `Ask HR - ${subjectSuffix}` : undefined,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }, [subjectSuffix]);

  return (
    <div className="no-print pointer-events-none fixed bottom-6 right-16 z-40 flex cursor-pointer flex-col items-end gap-1.5 sm:bottom-28 sm:right-8">
      <motion.button
        type="button"
        onClick={openGmail}
        aria-label="Ask HR — opens Gmail in a new tab. HR will reply to your email inbox."
        title="Ask HR — HR will reply to your email inbox"
        whileHover={{ scale: 1.04, y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-blue-400 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10 transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary dark:bg-amber-600 dark:text-white dark:hover:bg-amber-500 dark:focus-visible:ring-amber-500"
      >
        <Mail className="size-5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Ask HR</span>
      </motion.button>
      <p className="pointer-events-none max-w-[13rem] text-right text-[11px] font-medium leading-snug bg-white rounded text-blue-800 dark:text-slate-400 sm:max-w-[15rem] sm:text-xs">
        HR will reply to your email inbox.
      </p>
    </div>
  );
}
