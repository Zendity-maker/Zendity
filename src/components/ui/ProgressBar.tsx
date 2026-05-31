import * as React from "react";
import { cn } from "./cn";

/**
 * ProgressBar — primitiva de barra de progreso.
 *
 * Track slate-100, fill 6px (h-1.5) con esquinas redondeadas, transición de
 * ancho 500ms. Color por defecto: teal de Zéndity. Se puede pasar otro tono.
 *
 * Acepta dos modos de input — eliges el que sea más natural en el call site:
 *   - percent: número 0-100 ya calculado
 *   - value + max: la primitiva calcula y clampa
 *
 * Casos de uso conocidos:
 *   - Tile del wall del supervisor: ronda actual X/Y
 *   - Score Cumplimiento: barra 0-100 del compliance score
 *   - Vitales de Entrada: ventana 4h restante
 *
 * Si `label` o `valueLabel` se pasan, renderiza una fila superior con el label
 * a la izquierda y el valor a la derecha. Si no, solo la barra.
 */
export type ProgressTone = "teal" | "success" | "warning" | "danger" | "neutral" | "navy";

const fillByTone: Record<ProgressTone, string> = {
    teal: "bg-[var(--color-zendity-teal)]",
    success: "bg-[var(--color-success-green)]",
    warning: "bg-[var(--color-alert-amber)]",
    danger: "bg-[var(--color-critical-red)]",
    neutral: "bg-slate-300",
    navy: "bg-[var(--color-navy)]",
};

const textByTone: Record<ProgressTone, string> = {
    teal: "text-[var(--color-zendity-teal)]",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-rose-700",
    neutral: "text-slate-600",
    navy: "text-slate-800",
};

export interface ProgressBarProps {
    /** Porcentaje ya calculado (0-100). Tiene precedencia sobre value/max. */
    percent?: number;
    /** Valor numerador. Se usa con `max`. */
    value?: number;
    /** Denominador. Default 100. */
    max?: number;
    /** Color de la barra. Default 'teal'. */
    tone?: ProgressTone;
    /** Si dynamic=true, la primitiva escoge tone automáticamente por umbrales:
     *  >=90 success, >=50 warning, <50 neutral. Override de `tone`. */
    dynamic?: boolean;
    /** Label a la izquierda de la fila superior (si se omite ambos labels, no hay fila). */
    label?: React.ReactNode;
    /** Valor mostrado a la derecha. Default: el porcentaje. */
    valueLabel?: React.ReactNode;
    /** Oculta la fila superior aunque haya label. */
    hideLabelRow?: boolean;
    className?: string;
}

function clamp(n: number, min = 0, max = 100): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(min, Math.min(max, n));
}

function dynamicTone(pct: number): ProgressTone {
    if (pct >= 90) return "success";
    if (pct >= 50) return "warning";
    return "neutral";
}

export function ProgressBar({
    percent,
    value,
    max = 100,
    tone = "teal",
    dynamic,
    label,
    valueLabel,
    hideLabelRow,
    className,
}: ProgressBarProps) {
    // Resolver porcentaje
    let pct: number;
    if (typeof percent === "number") {
        pct = clamp(Math.round(percent));
    } else if (typeof value === "number" && max > 0) {
        pct = clamp(Math.round((value / max) * 100));
    } else {
        pct = 0;
    }

    const resolvedTone: ProgressTone = dynamic ? dynamicTone(pct) : tone;
    const showLabelRow = !hideLabelRow && (label !== undefined || valueLabel !== undefined);

    return (
        <div className={cn("w-full", className)}>
            {showLabelRow && (
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-600">{label}</span>
                    <span className={cn("text-[11px] font-bold", textByTone[resolvedTone])}>
                        {valueLabel ?? `${pct}%`}
                    </span>
                </div>
            )}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div
                    className={cn("h-full rounded-full transition-all duration-500", fillByTone[resolvedTone])}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

export default ProgressBar;
