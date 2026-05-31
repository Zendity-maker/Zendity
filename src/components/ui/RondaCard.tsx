import * as React from "react";
import { cn } from "./cn";
import type { GrupoColor } from "./GrupoBadge";

/**
 * RondaCard — cáscara visual del tile del wall del supervisor.
 *
 * Es una primitiva DELGADA, intencionalmente. No conoce nada del dominio
 * (rondas, cobertura, pendientes). Solo provee la estructura visual:
 * borde izquierdo 4px del color de grupo + punto + nombre + label +
 * stat opcional a la derecha + link "cambiar" opcional + cuerpo libre.
 *
 * Carácter visual canónico: fondo blanco, borde slate-200, border-left-4
 * del color de grupo. La saturación vive en el borde y el punto, NO en el
 * fondo (eso fatigaba la vista en grids densos del wall).
 *
 * Para tiles con lógica densa (status pills, progreso, cobertura,
 * pendientes), componer en un FEATURE component encima de esta cáscara
 * — ver SupervisorRondaTile en src/components/.
 *
 * Props:
 *   - grupo: GrupoColor | null  (null = neutral gris para "Sin grupo")
 *   - name
 *   - grupoLabel?: override del label "Grupo X"
 *   - rightSlot?: nodo en la esquina superior derecha (stat, percent, etc.)
 *   - changeSlot?: nodo inline tras el label (típicamente link "cambiar"
 *     con su propio stopPropagation, no lo asumimos aquí)
 *   - isLate?: ring amber alrededor de la card (alerta visual)
 *   - onClick?: si está, la card es interactiva (button)
 *   - children: cuerpo del tile, libre
 */
export type GrupoColorOrNull = GrupoColor | null;

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

const NEUTRAL_BORDER = "border-l-slate-300";
const NEUTRAL_DOT = "bg-slate-400";
const NEUTRAL_TEXT = "text-slate-500";

export interface RondaCardProps {
    grupo: GrupoColorOrNull;
    name: string;
    /** Sobreescribe el label automático "Grupo {GRUPO}" / "Sin grupo". */
    grupoLabel?: string;
    /** Slot a la derecha del header (stat, %, métrica destacada). */
    rightSlot?: React.ReactNode;
    /** Slot inline tras el label (típicamente el link "cambiar"). */
    changeSlot?: React.ReactNode;
    /** Resalta la card con ring amber (alerta visual: SLA expirado, retraso, etc.). */
    isLate?: boolean;
    /** Click en la card. Si está presente, la card se renderiza como button. */
    onClick?: () => void;
    /** Cuerpo libre del tile. */
    children?: React.ReactNode;
    className?: string;
}

export function RondaCard({
    grupo,
    name,
    grupoLabel,
    rightSlot,
    changeSlot,
    isLate,
    onClick,
    children,
    className,
}: RondaCardProps) {
    const interactive = typeof onClick === "function";

    const borderClass = grupo ? grupoBorder[grupo] : NEUTRAL_BORDER;
    const dotClass = grupo ? grupoDot[grupo] : NEUTRAL_DOT;
    const labelTextClass = grupo ? grupoText[grupo] : NEUTRAL_TEXT;
    const resolvedLabel = grupoLabel ?? (grupo ? `Grupo ${grupo}` : "Sin grupo");

    const containerClass = cn(
        "w-full rounded-2xl bg-white border border-slate-200 border-l-4 p-4 text-left",
        "transition-colors duration-150",
        borderClass,
        isLate && "ring-2 ring-amber-400/40",
        interactive && "hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-zendity-teal)]",
        className,
    );

    const header = (
        <div className="flex items-start gap-3">
            <div className={cn("flex-shrink-0 w-2.5 h-2.5 rounded-full mt-1.5", dotClass)} aria-hidden />
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 leading-tight truncate">{name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                    <span className={cn("font-bold tracking-wide", labelTextClass)}>{resolvedLabel}</span>
                    {changeSlot}
                </div>
            </div>
            {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
        </div>
    );

    const content = (
        <>
            {header}
            {children && <div className="mt-3">{children}</div>}
        </>
    );

    if (interactive) {
        return (
            <button type="button" onClick={onClick} className={containerClass}>
                {content}
            </button>
        );
    }
    return <div className={containerClass}>{content}</div>;
}

export default RondaCard;
