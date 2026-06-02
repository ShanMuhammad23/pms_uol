import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "social";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#0F2C59] text-white hover:bg-[#12366d] focus-visible:ring-[#0F2C59] border border-transparent",
  outline:
    "bg-white text-[#0F2C59] border border-[#0F2C59] hover:bg-[#0F2C59]/5 focus-visible:ring-[#0F2C59]",
  social:
    "bg-white text-[#0F172A] border border-slate-300 hover:bg-slate-50 focus-visible:ring-[#0F2C59]",
};

export function Button({
  variant = "primary",
  isLoading = false,
  icon,
  children,
  disabled,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  );
}
