import * as React from "react";
import { cn } from "./cn";

/**
 * Textarea — hermana de Input para texto multilínea. Misma API de
 * estados (idle/invalid/disabled) y mismo set de sizes.
 */
export type TextareaSize = "sm" | "md" | "lg";
export type TextareaVariant = "light" | "dark";

export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
    inputSize?: TextareaSize;
    variant?: TextareaVariant;
    invalid?: boolean;
}

const sizeClasses: Record<TextareaSize, string> = {
    sm: "py-1.5 px-2.5 text-sm",
    md: "py-2.5 px-3 text-[15px]",
    lg: "py-3 px-4 text-base",
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    function Textarea({ inputSize = "md", variant = "light", invalid, className, disabled, rows = 3, ...rest }, ref) {
        const isDark = variant === "dark";

        const surface = isDark
            ? "bg-slate-700 text-white placeholder:text-slate-400"
            : "bg-white text-slate-800 placeholder:text-slate-400";

        const border = invalid
            ? (isDark ? "border-rose-400" : "border-rose-300")
            : (isDark ? "border-slate-600" : "border-slate-200");

        const ring = invalid
            ? "focus:ring-[var(--color-critical-red)]/30 focus:border-[var(--color-critical-red)]"
            : isDark
                ? "focus:ring-[var(--color-teal-on-dark)]/40 focus:border-[var(--color-teal-on-dark)]"
                : "focus:ring-[var(--color-zendity-teal)]/25 focus:border-[var(--color-zendity-teal)]";

        const disabledClass = isDark
            ? "opacity-60 cursor-not-allowed bg-slate-800"
            : "opacity-60 cursor-not-allowed bg-slate-50";

        return (
            <textarea
                ref={ref}
                rows={rows}
                disabled={disabled}
                aria-invalid={invalid || undefined}
                className={cn(
                    "w-full rounded-lg border",
                    "outline-none transition-colors focus:ring-2 resize-y",
                    sizeClasses[inputSize],
                    surface,
                    border,
                    ring,
                    disabled && disabledClass,
                    className,
                )}
                {...rest}
            />
        );
    }
);

export default Textarea;
