import { cn } from "@/lib/utils";

interface FormDescriptionProps {
  description: string | null | undefined;
  className?: string;
}

export function FormDescription({ description, className }: FormDescriptionProps) {
  const text = description?.trim();
  if (!text) {
    return null;
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
