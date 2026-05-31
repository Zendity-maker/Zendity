import * as React from "react";
import { cn } from "./cn";

/**
 * Badge — pill chip para etiquetar estado, categoría o conteo.
 *
 * Tinte suave + texto oscuro del mismo matiz. 12px/600. Radio pill.
 * Opcional: `dot` (punto del color del variant a la izquierda) — útil
 * para indicadores de estado vivo (online, pendiente, etc.).
 *
 * Variantes:
 *   - neutral (default) — slate
 *   - success — verde (#22A06B)
 *   - warning — amber  (#E5A93D)
 *   - danger  — rojo   (#D9534F)
 *   - info    — azul   (#3B82F6)
 *
 * Para badges con color de grupo (rojo/amarillo/verde/azul de zonificación
 * clínica), usar <GrupoBadge> — semántica distinta.
 */
export type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

const tintClasses: Record<BadgeVariant, string> = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-rose-50 text-rose-700",
    info: "bg-blue-50 text-blue-700",
};

const dotColor: Record<BadgeVariant, string> = {
    neutral: "bg-slate-400",
    success: "bg-[var(--color-success-green)]",
    warning: "bg-[var(--color-alert-amber)]",
    danger: "bg-[var(--color-critical-red)]",
    info: "bg-[var(--color-info-blue)]",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    /** Muestra un punto del color del variant a la izquierda. */
    dot?: boolean;
}

export function Badge({ variant = "neutral", dot = false, className, children, ...rest }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
                "text-xs font-semibold leading-5",
                tintClasses[variant],
                className,
            )}
            {...rest}
        >
            {dot && <span className={cn("inline-block w-1.5 h-1.5 rounded-full", dotColor[variant])} aria-hidden />}
            {children}
        </span>
    );
}

export default Badge;
