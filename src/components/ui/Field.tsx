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
export interface FieldProps {
    label?: React.ReactNode;
    htmlFor?: string;
    helper?: React.ReactNode;
    error?: React.ReactNode;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
}

export function Field({ label, htmlFor, helper, error, required, children, className }: FieldProps) {
    const showError = !!error;
    const messageId = htmlFor ? `${htmlFor}-msg` : undefined;

    return (
        <div className={cn("space-y-1.5", className)}>
            {label && (
                <label
                    htmlFor={htmlFor}
                    className="block text-[11px] font-bold text-slate-600 uppercase tracking-widest"
                >
                    {label}
                    {required && <span className="ml-1 text-rose-500" aria-hidden>*</span>}
                </label>
            )}
            {children}
            {(showError || helper) && (
                <p
                    id={messageId}
                    className={cn(
                        "text-[11px] leading-tight",
                        showError ? "text-rose-600 font-semibold" : "text-slate-500",
                    )}
                    role={showError ? "alert" : undefined}
                >
                    {showError ? error : helper}
                </p>
            )}
        </div>
    );
}

export default Field;
