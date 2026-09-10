"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Bold,
  CodeXml,
  Eraser,
  Italic,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isHtmlTitleEmpty,
  sanitizeHtmlTitle,
  valueToEditorHtml,
} from "@/lib/html-title";

interface HtmlTitleEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  variant?: "boxed" | "inline";
  tone?: "indigo" | "teal" | "neutral";
  "aria-label"?: string;
}

const FONT_SIZES = [
  { label: "S", value: "2", title: "Small" },
  { label: "M", value: "3", title: "Normal" },
  { label: "L", value: "5", title: "Large" },
] as const;

function emitEditorValue(root: HTMLElement): string {
  return sanitizeHtmlTitle(root.innerHTML);
}

export default function HtmlTitleEditor({
  value,
  onChange,
  placeholder = "Section title",
  error = false,
  variant = "boxed",
  tone = "neutral",
  "aria-label": ariaLabel = "Section title",
}: HtmlTitleEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceValue, setSourceValue] = useState(value);
  const empty = isHtmlTitleEmpty(value);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || sourceMode) {
      return;
    }
    if (document.activeElement === el) {
      return;
    }
    const next = valueToEditorHtml(value);
    if (el.innerHTML !== next) {
      el.innerHTML = next;
    }
  }, [value, sourceMode]);

  const runCommand = useCallback(
    (command: string, commandValue?: string) => {
      const el = editorRef.current;
      if (!el) {
        return;
      }
      el.focus();
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand(command, false, commandValue);
      onChange(emitEditorValue(el));
    },
    [onChange],
  );

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) {
      return;
    }
    onChange(emitEditorValue(el));
  }, [onChange]);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const html = event.clipboardData.getData("text/html");
      const text = event.clipboardData.getData("text/plain");
      const inserted = html
        ? sanitizeHtmlTitle(html)
        : valueToEditorHtml(text);
      document.execCommand("insertHTML", false, inserted || text);
      const el = editorRef.current;
      if (el) {
        onChange(emitEditorValue(el));
      }
    },
    [onChange],
  );

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  const stopToggle = useCallback((event: ReactMouseEvent) => {
    event.stopPropagation();
  }, []);

  const toggleSourceMode = useCallback(() => {
    if (sourceMode) {
      const next = sanitizeHtmlTitle(sourceValue);
      onChange(next);
      setSourceMode(false);
      return;
    }
    setSourceValue(value);
    setSourceMode(true);
  }, [onChange, sourceMode, sourceValue, value]);

  const toolbarButtonClass =
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";

  return (
    <div
      className={cn(
        "form-html-editor w-full min-w-0 flex-1",
        variant === "boxed" &&
          "rounded-lg border bg-background dark:border-white/15",
        variant === "boxed" &&
          (error
            ? "border-red-300 dark:border-red-600/60"
            : "border-slate-300"),
        variant === "inline" && "rounded-md",
        variant === "inline" && error && "ring-1 ring-red-400",
      )}
      onClick={stopToggle}
      onMouseDown={stopToggle}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-0.5 px-1 py-1",
          variant === "boxed" && "border-b border-slate-200 dark:border-white/10",
          variant === "inline" && "rounded-md bg-white/70 dark:bg-slate-950/40",
          tone === "indigo" && variant === "inline" && "bg-indigo-100/50 dark:bg-indigo-950/30",
          tone === "teal" && variant === "inline" && "bg-teal-100/50 dark:bg-teal-950/30",
        )}
      >
        <button
          type="button"
          className={toolbarButtonClass}
          title="Bold"
          disabled={sourceMode}
          onClick={() => runCommand("bold")}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          title="Italic"
          disabled={sourceMode}
          onClick={() => runCommand("italic")}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          title="Underline"
          disabled={sourceMode}
          onClick={() => runCommand("underline")}
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <label
          className={cn(toolbarButtonClass, "relative cursor-pointer")}
          title="Text color"
        >
          <span className="text-[11px] font-bold leading-none">A</span>
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={sourceMode}
            onChange={(event) => runCommand("foreColor", event.target.value)}
            aria-label="Text color"
          />
        </label>
        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/10" />
        {FONT_SIZES.map((size) => (
          <button
            key={size.value}
            type="button"
            className={cn(toolbarButtonClass, "text-[10px] font-bold")}
            title={size.title}
            disabled={sourceMode}
            onClick={() => runCommand("fontSize", size.value)}
          >
            {size.label}
          </button>
        ))}
        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/10" />
        <button
          type="button"
          className={toolbarButtonClass}
          title="Clear formatting"
          disabled={sourceMode}
          onClick={() => runCommand("removeFormat")}
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            toolbarButtonClass,
            sourceMode && "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white",
          )}
          title={sourceMode ? "Visual editor" : "Edit HTML"}
          onClick={toggleSourceMode}
        >
          <CodeXml className="h-3.5 w-3.5" />
        </button>
      </div>

      {sourceMode ? (
        <textarea
          value={sourceValue}
          onChange={(event) => setSourceValue(event.target.value)}
          onBlur={() => onChange(sanitizeHtmlTitle(sourceValue))}
          rows={3}
          className={cn(
            "w-full resize-y bg-transparent px-2 py-1.5 font-mono text-xs text-text-primary outline-none",
            variant === "boxed" && "px-3 py-2",
            tone === "indigo" && "text-indigo-900 dark:text-indigo-100",
            tone === "teal" && "text-teal-900 dark:text-teal-100",
          )}
          placeholder="<p>Section title</p>"
          aria-label={`${ariaLabel} HTML`}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          suppressContentEditableWarning
          data-placeholder={placeholder}
          className={cn(
            "form-html-editor-content relative min-h-9 w-full px-2 py-1.5 text-sm font-semibold outline-none",
            variant === "boxed" && "px-3 py-2 font-normal",
            empty && "is-empty",
            error
              ? "text-red-700 dark:text-red-400"
              : tone === "indigo"
                ? "text-indigo-900 dark:text-indigo-100"
                : tone === "teal"
                  ? "text-teal-900 dark:text-teal-100"
                  : "text-text-primary",
          )}
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
        />
      )}
    </div>
  );
}
