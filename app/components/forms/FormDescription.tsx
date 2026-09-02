import { cn } from "@/lib/utils";

interface FormDescriptionProps {
  description: string | null | undefined;
  className?: string;
  compact?: boolean;
}

export function FormDescription({
  description,
  className,
  compact = false,
}: FormDescriptionProps) {
  const text = description?.trim();
  if (!text) {
    return null;
  }

  if (compact) {
    return (
      <details
        className={cn(
          "group w-fit max-w-full rounded-md border border-indigo-200 bg-indigo-50/90 px-2.5 py-1.5 md:max-w-xl dark:border-indigo-500/30 dark:bg-indigo-950/35",
          className,
        )}
      >
        <summary className="cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
            Form description
          </span>
          <p
            className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-700 group-open:line-clamp-none group-open:whitespace-pre-wrap dark:text-slate-200"
            title={text}
          >
            {text}
          </p>
        </summary>
      </details>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-indigo-200 bg-indigo-50/90 px-4 py-3 dark:border-indigo-500/30 dark:bg-indigo-950/35",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
        Form description
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {text}
      </p>
    </div>
  );
}
