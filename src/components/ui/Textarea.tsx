import * as React from "react";
import { cn } from "./cn";

/**
 * Textarea — hermana de Input para texto multilínea. Misma API de
 * estados (idle/invalid/disabled) y mismo set de sizes.
 */
export type TextareaSize = "sm" | "md" | "lg";

export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
    inputSize?: TextareaSize;
    invalid?: boolean;
}

const sizeClasses: Record<TextareaSize, string> = {
    sm: "py-1.5 px-2.5 text-sm",
    md: "py-2.5 px-3 text-[15px]",
    lg: "py-3 px-4 text-base",
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    function Textarea({ inputSize = "md", invalid, className, disabled, rows = 3, ...rest }, ref) {
        const ring = invalid
            ? "focus:ring-[var(--color-critical-red)]/30 focus:border-[var(--color-critical-red)]"
            : "focus:ring-[var(--color-zendity-teal)]/25 focus:border-[var(--color-zendity-teal)]";
        const border = invalid ? "border-rose-300" : "border-slate-200";

        return (
            <textarea
                ref={ref}
                rows={rows}
                disabled={disabled}
                aria-invalid={invalid || undefined}
                className={cn(
                    "w-full rounded-lg border bg-white text-slate-800",
                    "placeholder:text-slate-400",
                    "outline-none transition-colors focus:ring-2 resize-y",
                    sizeClasses[inputSize],
                    border,
                    ring,
                    disabled && "opacity-60 cursor-not-allowed bg-slate-50",
                    className,
                )}
                {...rest}
            />
        );
    }
);

export default Textarea;
