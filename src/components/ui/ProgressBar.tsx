import * as React from "react";
import { cn } from "./cn";

/**
 * ProgressBar — primitiva de barra de progreso.
 *
 * Diseñada para ser el consumidor común de cualquier barra del producto:
 * Score Cumplimiento, Vitales de Entrada 4h, ronda actual del wall, etc.
 *
 * Acento por defecto: teal de Zéndity. NO usa --brand-primary
 * (re-tematizable por inquilino). El chrome del producto es estable.
 *
 * Inputs:
 *   - percent  (0-100 ya calculado)  o
 *   - value + max  (la primitiva calcula y clampa)
 *
 * Color por umbral — el call site decide su política sin contaminar la
 * primitiva. Dos formas:
 *   - tone: ProgressTone        → color fijo
 *   - tone: (pct) => ProgressTone → función que mapea el porcentaje a tono
 *
 * Track:
 *   - "slate" (default)  → fondo slate-100. Para barras sobre superficie blanca.
 *   - "white"            → fondo white/60. Para barras DENTRO de cards
 *                          tintadas (Score: la card cambia a emerald-50/
 *                          amber-50/rose-50 según umbral, y el track gris
 *                          se vería sucio sobre ese tinte).
 */
export type ProgressTone = "teal" | "success" | "warning" | "danger" | "neutral" | "navy";
export type ToneSpec = ProgressTone | ((pct: number) => ProgressTone);
export type TrackTone = "slate" | "white";

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

const trackClasses: Record<TrackTone, string> = {
    slate: "bg-slate-100",
    white: "bg-white/60",
};

export interface ProgressBarProps {
    /** Porcentaje ya calculado (0-100). Tiene precedencia sobre value/max. */
    percent?: number;
    /** Valor numerador. Usado con `max`. */
    value?: number;
    /** Denominador. Default 100. Si max ≤ 0, la barra es 0. */
    max?: number;
    /** Color de la barra. Fijo o función pct → tono. Default 'teal'. */
    tone?: ToneSpec;
    /** Color del track. Default 'slate'. */
    trackTone?: TrackTone;
    /** Label a la izquierda de la fila superior. Si se omite ambos labels, no hay fila. */
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

function resolveTone(spec: ToneSpec | undefined, pct: number): ProgressTone {
    if (!spec) return "teal";
    return typeof spec === "function" ? spec(pct) : spec;
}

export function ProgressBar({
    percent,
    value,
    max = 100,
    tone,
    trackTone = "slate",
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

    const resolvedTone = resolveTone(tone, pct);
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
            <div
                className={cn("w-full h-1.5 rounded-full overflow-hidden", trackClasses[trackTone])}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className={cn("h-full rounded-full transition-all duration-500", fillByTone[resolvedTone])}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

export default ProgressBar;
