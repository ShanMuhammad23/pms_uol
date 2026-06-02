import type { ChangeEventHandler, ReactNode } from "react";

interface InputFieldProps {
  id: string;
  name: string;
  label: string;
  type?: "email" | "password" | "text";
  value: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  icon?: ReactNode;
  error?: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  rightElement?: ReactNode;
}

export function InputField({
  id,
  name,
  label,
  type = "text",
  value,
  placeholder,
  autoComplete,
  required = false,
  icon,
  error,
  onChange,
  rightElement,
}: InputFieldProps) {
  const hasError = Boolean(error);
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[#0F172A]">
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={`h-11 w-full rounded-lg border bg-white text-sm text-[#0F172A] placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2C59] focus-visible:ring-offset-0 ${
            icon ? "pl-10" : "pl-3"
          } ${rightElement ? "pr-10" : "pr-3"} ${
            hasError ? "border-red-400" : "border-slate-300"
          }`}
        />
        {rightElement ? (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightElement}
          </span>
        ) : null}
      </div>
      {hasError ? (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
