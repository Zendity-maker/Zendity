import * as React from "react";
import { cn } from "./cn";
import type { GrupoColor } from "./GrupoBadge";

/**
 * RondaCard — card de cuidadora/ronda en el wall del supervisor.
 *
 * Card blanca con borde izquierdo 4px del color de grupo + punto + nombre
 * + label de grupo + meta opcional + % alineado a la derecha.
 *
 * NO usa fondo saturado al 100% del color — eso fatigaba la vista en el
 * wall del supervisor con 8 cards al mismo tiempo. La saturación vive en
 * el borde izquierdo y el punto. El fondo es blanco; el % se enfatiza
 * con tamaño y peso.
 *
 * Props:
 *   - grupo: color de grupo (en español)
 *   - name: nombre de la cuidadora
 *   - grupoLabel: opcional, override del label que va al lado del punto.
 *     Por defecto se muestra el `grupo` (ej. "ROJO"). Útil para mostrar
 *     "Cobertura ROJO" u otros matices.
 *   - meta: texto secundario debajo del nombre (ej. "8/10 atendidos hoy")
 *   - percent: número 0-100, se muestra grande a la derecha
 *   - onClick: opcional, hace la card interactiva (hover sutil + cursor)
 */
const grupoBorder: Record<GrupoColor, string> = {
    ROJO: "border-l-[#D9534F]",
    AMARILLO: "border-l-[#E5A93D]",
    VERDE: "border-l-[#22A06B]",
    AZUL: "border-l-[#2563EB]",
};

const grupoDot: Record<GrupoColor, string> = {
    ROJO: "bg-[#D9534F]",
    AMARILLO: "bg-[#E5A93D]",
    VERDE: "bg-[#22A06B]",
    AZUL: "bg-[#2563EB]",
};

const grupoText: Record<GrupoColor, string> = {
    ROJO: "text-[#A23B38]",
    AMARILLO: "text-[#8A6420]",
    VERDE: "text-[#1A6E4B]",
    AZUL: "text-[#1E489E]",
};

export interface RondaCardProps {
    grupo: GrupoColor;
    name: string;
    grupoLabel?: string;
    meta?: React.ReactNode;
    /** 0–100. Si es null/undefined, no se renderiza el bloque del %. */
    percent?: number | null;
    /** Si se pasa, la card se vuelve clickeable (button-like). */
    onClick?: () => void;
    className?: string;
}

function percentColor(pct: number): string {
    if (pct >= 90) return "text-[#1A6E4B]";        // verde profundo
    if (pct >= 70) return "text-slate-700";
    if (pct >= 50) return "text-[#8A6420]";         // amber profundo
    return "text-[#A23B38]";                         // rojo profundo
}

export function RondaCard({
    grupo,
    name,
    grupoLabel,
    meta,
    percent,
    onClick,
    className,
}: RondaCardProps) {
    const interactive = typeof onClick === "function";

    const containerClass = cn(
        "w-full rounded-2xl bg-white border border-slate-200 border-l-4",
        "p-4 flex items-center gap-4 text-left",
        "transition-colors duration-150",
        grupoBorder[grupo],
        interactive && "hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-zendity-teal)]",
        className,
    );

    const body = (
        <>
            {/* Punto de color de grupo */}
            <div className={cn("flex-shrink-0 w-2.5 h-2.5 rounded-full", grupoDot[grupo])} aria-hidden />

            {/* Cuerpo */}
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 leading-tight truncate">{name}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                    <span className={cn("font-bold tracking-wide", grupoText[grupo])}>
                        {grupoLabel ?? `Grupo ${grupo}`}
                    </span>
                    {meta && (
                        <>
                            <span className="text-slate-300" aria-hidden>·</span>
                            <span className="text-slate-500 truncate">{meta}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Porcentaje */}
            {percent !== null && percent !== undefined && (
                <div className="flex-shrink-0 text-right">
                    <p className={cn("font-[family-name:var(--font-display)] text-2xl font-semibold leading-none", percentColor(percent))}>
                        {Math.round(percent)}<span className="text-base">%</span>
                    </p>
                </div>
            )}
        </>
    );

    if (interactive) {
        return (
            <button type="button" onClick={onClick} className={containerClass}>
                {body}
            </button>
        );
    }
    return <div className={containerClass}>{body}</div>;
}

export default RondaCard;
