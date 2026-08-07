/**
 * Shared required/optional indicator for assessment questions.
 *
 * Renders a red asterisk (*) for required questions and a muted "(Optional)"
 * label for optional questions. Used across all assessment filling flows:
 * employee self-assessment, manager review, HR/Board review, direct
 * assessment, template preview, and bulk review.
 *
 * The indicator is purely visual — validation logic is unchanged.
 */
export function QuestionRequiredIndicator({
  isRequired,
  className = "",
}: {
  isRequired: boolean;
  className?: string;
}) {
  if (isRequired) {
    return (
      <span
        className={`ml-1 text-red-500 ${className}`}
        title="Required"
        aria-label="Required"
      >
        *
      </span>
    );
  }

  return (
    <span
      className={`ml-1 text-xs font-normal text-slate-400 dark:text-slate-500 ${className}`}
      title="Optional"
      aria-label="Optional"
    >
      (Optional)
    </span>
  );
}
