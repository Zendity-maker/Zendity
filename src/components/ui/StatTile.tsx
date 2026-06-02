import * as React from "react";
import { Card } from "./Card";
import { cn } from "./cn";

/**
 * StatTile — KPI atómico: valor grande + label corto, opcional con icono.
 *
 * Tercer consumidor del patrón "valor + label" en el producto. Antes se
 * componía inline 8+ veces con el mismo Card compact + texto tematizado.
 * Aquí se canoniza:
 *
 *   • value: el dato fuerte (font-display 32px). Acepta ReactNode para
 *           permitir formateo (porcentaje, "—", etc.).
 *   • label: la etiqueta seca debajo (uppercase 10-11px, tracking ancho).
 *   • tone:  fija el conjunto (fondo + bordes + tints de value/label/icon).
 *            Default 'neutral' (slate). Los tonos siguen las decisiones
 *            globales del DS — no son ad-hoc por call site.
 *   • icon:  opcional, render encima del valor, centrado.
 *
 * Composición: Card padding="compact" como cáscara, layout vertical
 * centrado. El call site decide cuándo cambiar de tono (ej. incidentes
 * pasa a 'danger' cuando hay > 0).
 */
export type StatTileTone = "neutral" | "teal" | "success" | "warning" | "danger";

export interface StatTileProps {
    value: React.ReactNode;
    label: string;
    tone?: StatTileTone;
    icon?: React.ReactNode;
    /** Slot opcional a la derecha del label (ej. InfoTooltip). */
    helper?: React.ReactNode;
    className?: string;
}

interface ToneSpec {
    surface: string;
    icon: string;
    value: string;
    label: string;
    pulse?: boolean;
}

const tones: Record<StatTileTone, ToneSpec> = {
    neutral: {
        surface: "bg-white border-slate-200",
        icon: "text-slate-500",
        value: "text-slate-800",
        label: "text-slate-500",
    },
    teal: {
        surface: "bg-teal-50 border-teal-200",
        icon: "text-teal-600",
        value: "text-teal-700",
        label: "text-teal-600",
    },
    success: {
        surface: "bg-emerald-50 border-emerald-200",
        icon: "text-emerald-600",
        value: "text-emerald-700",
        label: "text-emerald-600",
    },
    warning: {
        surface: "bg-amber-50 border-amber-200",
        icon: "text-amber-600",
        value: "text-amber-700",
        label: "text-amber-600",
    },
    danger: {
        surface: "bg-rose-50 border-rose-300",
        icon: "text-rose-600",
        value: "text-rose-700",
        label: "text-rose-600",
        pulse: true,
    },
};

export function StatTile({ value, label, tone = "neutral", icon, helper, className }: StatTileProps) {
    const t = tones[tone];
    return (
        <Card
            variant="flat"
            padding="compact"
            className={cn(
                "flex flex-col items-center justify-center text-center gap-0",
                t.surface,
                className,
            )}
        >
            {icon && (
                <div className={cn("mb-2 inline-flex items-center justify-center", t.icon, tone === "danger" && t.pulse && "animate-pulse")}>
                    {icon}
                </div>
            )}
            <p className={cn("font-[family-name:var(--font-display)] text-3xl md:text-4xl font-semibold leading-none tracking-tight", t.value)}>
                {value}
            </p>
            <div className="mt-2 flex items-center justify-center gap-1">
                <span className={cn("text-[10px] font-bold uppercase tracking-[0.14em]", t.label)}>
                    {label}
                </span>
                {helper}
            </div>
        </Card>
    );
}

export default StatTile;
