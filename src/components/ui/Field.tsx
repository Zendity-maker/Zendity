import * as React from "react";
import { cn } from "./cn";

/**
 * Field — wrapper presentacional para label + control + helper/error.
 *
 * Decisión arquitectónica:
 *   - NO conoce form libs (zod, react-hook-form, etc.).
 *   - NO lee contexto. Es 100% presentación.
 *   - El call site pasa `error={...}` cuando hay error; el call site
 *     también es responsable de pasar `invalid` al control (Input,
 *     Textarea, Select). Explícito, sin magia de cloneElement.
 *
 * Si pasas `error`, se muestra en lugar de `helper` (no se duplican).
 * Si pasas `required`, aparece un asterisco rose junto al label.
 *
 * Layout: label arriba (uppercase tracking-widest, slate-600),
 * control en medio (children), helper/error abajo.
 */
export type FieldVariant = "light" | "dark";

export interface FieldProps {
    label?: React.ReactNode;
    htmlFor?: string;
    helper?: React.ReactNode;
    error?: React.ReactNode;
    required?: boolean;
    /** Default 'light'. 'dark' = label slate-400, helper slate-500, error rose-400
     *  (más visible sobre dark que rose-600). El control adentro lo decide el call
     *  site con variant="dark" en Input/Textarea/Select. */
    variant?: FieldVariant;
    children: React.ReactNode;
    className?: string;
}

export function Field({ label, htmlFor, helper, error, required, variant = "light", children, className }: FieldProps) {
    const showError = !!error;
    const messageId = htmlFor ? `${htmlFor}-msg` : undefined;
    const isDark = variant === "dark";

    const labelClass = isDark
        ? "text-slate-400"
        : "text-slate-600";

    const messageClass = showError
        ? (isDark ? "text-rose-400 font-semibold" : "text-rose-600 font-semibold")
        : (isDark ? "text-slate-500" : "text-slate-500");

    const requiredClass = isDark ? "text-rose-400" : "text-rose-500";

    return (
        <div className={cn("space-y-1.5", className)}>
            {label && (
                <label
                    htmlFor={htmlFor}
                    className={cn("block text-[11px] font-bold uppercase tracking-widest", labelClass)}
                >
                    {label}
                    {required && <span className={cn("ml-1", requiredClass)} aria-hidden>*</span>}
                </label>
            )}
            {children}
            {(showError || helper) && (
                <p
                    id={messageId}
                    className={cn("text-[11px] leading-tight", messageClass)}
                    role={showError ? "alert" : undefined}
                >
                    {showError ? error : helper}
                </p>
            )}
        </div>
    );
}

export default Field;
