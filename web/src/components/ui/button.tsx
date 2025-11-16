import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline";
}

const base =
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none px-4 py-2";

const variants: Record<string, string> = {
  default: "bg-sky-600 text-white hover:bg-sky-700 focus-visible:ring-sky-500",
  outline:
    "border border-slate-300 text-slate-900 bg-white hover:bg-slate-50 focus-visible:ring-sky-500"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    const variantClass = variants[variant] ?? variants.default;
    return (
      <button
        ref={ref}
        className={`${base} ${variantClass} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
