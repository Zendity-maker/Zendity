import * as React from "react";
import { cn } from "./cn";

/**
 * Select — primitiva atómica del <select> nativo. Mismo set de sizes
 * y estados que Input/Textarea. Mantiene comportamiento nativo del
 * browser (accesibilidad real, sin combobox custom).
 *
 * Para selects con búsqueda / multi / async, esperamos a un Sprint A.5
 * con Combobox dedicado — no se mezcla con esta primitiva.
 */
export type SelectSize = "sm" | "md" | "lg";
export type SelectVariant = "light" | "dark";

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
    inputSize?: SelectSize;
    variant?: SelectVariant;
    invalid?: boolean;
}

const sizeClasses: Record<SelectSize, string> = {
    sm: "py-1.5 pl-2.5 pr-8 text-sm",
    md: "py-2.5 pl-3 pr-9 text-[15px]",
    lg: "py-3 pl-4 pr-10 text-base",
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    function Select({ inputSize = "md", variant = "light", invalid, className, disabled, children, ...rest }, ref) {
        const isDark = variant === "dark";

        // Caret SVG inline — colorado distinto en dark (slate-300) vs light (slate-500)
        const caretLight = "bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2020%2020%22%20fill=%22%2364748b%22%3E%3Cpath%20fill-rule=%22evenodd%22%20d=%22M5.23%207.21a.75.75%200%201%201%201.06-1.02L10%209.94l3.71-3.75a.75.75%200%201%201%201.06%201.06l-4.24%204.28a.75.75%200%200%201-1.06%200L5.23%207.21z%22%20clip-rule=%22evenodd%22/%3E%3C/svg%3E')]";
        const caretDark  = "bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2020%2020%22%20fill=%22%23cbd5e1%22%3E%3Cpath%20fill-rule=%22evenodd%22%20d=%22M5.23%207.21a.75.75%200%201%201%201.06-1.02L10%209.94l3.71-3.75a.75.75%200%201%201%201.06%201.06l-4.24%204.28a.75.75%200%200%201-1.06%200L5.23%207.21z%22%20clip-rule=%22evenodd%22/%3E%3C/svg%3E')]";

        const surface = isDark ? "bg-slate-700 text-white" : "bg-white text-slate-800";
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
            <select
                ref={ref}
                disabled={disabled}
                aria-invalid={invalid || undefined}
                className={cn(
                    "w-full appearance-none rounded-lg border",
                    "outline-none transition-colors focus:ring-2",
                    isDark ? caretDark : caretLight,
                    "bg-[length:20px_20px] bg-[position:right_0.5rem_center] bg-no-repeat",
                    sizeClasses[inputSize],
                    surface,
                    border,
                    ring,
                    disabled && disabledClass,
                    className,
                )}
                {...rest}
            >
                {children}
            </select>
        );
    }
);

export default Select;
