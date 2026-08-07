/**
 * Shared required/optional indicator for assessment questions.
 *
 * Renders a "Mandatory" pill badge (red) for required questions and an
 * "Optional" pill badge (slate) for optional questions. Matches the style
 * used in FormTemplateView. Used across all assessment filling flows:
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
        className={`ml-1.5 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300 ${className}`}
        title="Mandatory"
        aria-label="Mandatory"
      >
        Mandatory
      </span>
    );
  }

  return (
    <span
      className={`ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700/40 dark:text-slate-400 ${className}`}
      title="Optional"
      aria-label="Optional"
    >
      Optional
    </span>
  );
}
