import * as React from "react";
import { cn } from "./cn";

/**
 * GrupoBadge — chip de color de zonificación clínica.
 *
 * Específico del dominio Zéndity: cada residente pertenece a un Grupo
 * de color que define quién lo atiende durante el turno. En español
 * SIEMPRE — nunca "RED/YELLOW/GREEN/BLUE" en UI.
 *
 * Mapeo:
 *   ROJO     → #D9534F (critical-red)
 *   AMARILLO → #E5A93D (alert-amber)
 *   VERDE    → #22A06B (success-green)
 *   AZUL     → #2563EB
 *
 * Diseño: tinte suave + borde 1px del color base + punto del color +
 * texto del color. NUNCA fondo saturado al 100% — eso "grita" en grids
 * densos. La saturación está en el punto + el borde.
 *
 * Para mapear desde el enum DB (RED/YELLOW/GREEN/BLUE/ALL/UNASSIGNED)
 * a este componente, los consumidores hacen el match — el componente
 * solo acepta español.
 */
export type GrupoColor = "ROJO" | "AMARILLO" | "VERDE" | "AZUL";

interface GrupoStyle {
    bg: string;
    border: string;
    text: string;
    dot: string;
}

const styles: Record<GrupoColor, GrupoStyle> = {
    ROJO: {
        bg: "bg-[#FCEDEC]",
        border: "border-[#F0B5B3]",
        text: "text-[#A23B38]",
        dot: "bg-[#D9534F]",
    },
    AMARILLO: {
        bg: "bg-[#FBF1DA]",
        border: "border-[#EFD18C]",
        text: "text-[#8A6420]",
        dot: "bg-[#E5A93D]",
    },
    VERDE: {
        bg: "bg-[#DDF3E8]",
        border: "border-[#A4DEC0]",
        text: "text-[#1A6E4B]",
        dot: "bg-[#22A06B]",
    },
    AZUL: {
        bg: "bg-[#DDE9FC]",
        border: "border-[#A6C0EE]",
        text: "text-[#1E489E]",
        dot: "bg-[#2563EB]",
    },
};

export interface GrupoBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    grupo: GrupoColor;
    /** Si es false, oculta el texto y solo muestra el punto (útil en chips compactos). */
    showLabel?: boolean;
}

export function GrupoBadge({ grupo, showLabel = true, className, ...rest }: GrupoBadgeProps) {
    const s = styles[grupo];
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
                "text-xs font-semibold leading-5",
                s.bg,
                s.border,
                s.text,
                className,
            )}
            {...rest}
        >
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", s.dot)} aria-hidden />
            {showLabel && grupo}
        </span>
    );
}

export default GrupoBadge;
