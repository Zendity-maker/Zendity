import * as React from "react";
import { cn } from "./cn";

/**
 * Input — primitiva atómica de form. Reemplaza el patrón heterogéneo
 * `w-full bg-white p-X rounded-lg border ...` que vive duplicado en
 * 100+ archivos.
 *
 * Toma todos los atributos nativos de <input>. Para flujos con label,
 * helper o error, envuélvelo en <Field>.
 *
 * Estados:
 *   - idle    : border-slate-200, ring teal en focus
 *   - invalid : border-rose-300, ring rose en focus, aria-invalid=true
 *   - disabled: opacidad reducida, fondo slate-50
 *
 * Acepta leftAddon / rightAddon para iconos o texto adyacente (ej. $).
 */
export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
    inputSize?: InputSize;
    invalid?: boolean;
    leftAddon?: React.ReactNode;
    rightAddon?: React.ReactNode;
}

const sizeClasses: Record<InputSize, string> = {
    sm: "py-1.5 px-2.5 text-sm",
    md: "py-2.5 px-3 text-[15px]",
    lg: "py-3 px-4 text-base",
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    function Input({ inputSize = "md", invalid, leftAddon, rightAddon, className, disabled, ...rest }, ref) {
        const hasAddons = Boolean(leftAddon != null || rightAddon != null);
        const ring = invalid
            ? "focus:ring-[var(--color-critical-red)]/30 focus:border-[var(--color-critical-red)]"
            : "focus:ring-[var(--color-zendity-teal)]/25 focus:border-[var(--color-zendity-teal)]";
        const border = invalid ? "border-rose-300" : "border-slate-200";

        const inputEl = (
            <input
                ref={ref}
                disabled={disabled}
                aria-invalid={invalid || undefined}
                className={cn(
                    "w-full rounded-lg border bg-white text-slate-800",
                    "placeholder:text-slate-400",
                    "outline-none transition-colors focus:ring-2",
                    sizeClasses[inputSize],
                    border,
                    ring,
                    disabled && "opacity-60 cursor-not-allowed bg-slate-50",
                    hasAddons && "flex-1",
                    !hasAddons && className,
                )}
                {...rest}
            />
        );

        if (!hasAddons) return inputEl;

        // Layout con addons: contenedor único con focus-within para visualizar el ring
        return (
            <div className={cn(
                "flex items-stretch w-full rounded-lg border bg-white overflow-hidden",
                "focus-within:ring-2 transition-colors",
                border,
                invalid
                    ? "focus-within:ring-[var(--color-critical-red)]/30 focus-within:border-[var(--color-critical-red)]"
                    : "focus-within:ring-[var(--color-zendity-teal)]/25 focus-within:border-[var(--color-zendity-teal)]",
                disabled && "opacity-60",
                className,
            )}>
                {leftAddon && (
                    <span className={cn("flex items-center px-3 text-slate-500 bg-slate-50 border-r border-slate-200 text-sm")}>
                        {leftAddon}
                    </span>
                )}
                {React.cloneElement(inputEl, {
                    className: cn(
                        "w-full bg-white text-slate-800 placeholder:text-slate-400 outline-none border-0",
                        sizeClasses[inputSize],
                        disabled && "cursor-not-allowed",
                    ),
                })}
                {rightAddon && (
                    <span className={cn("flex items-center px-3 text-slate-500 bg-slate-50 border-l border-slate-200 text-sm")}>
                        {rightAddon}
                    </span>
                )}
            </div>
        );
    }
);

export default Input;
