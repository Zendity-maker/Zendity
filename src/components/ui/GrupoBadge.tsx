import * as React from "react";
import { cn } from "./cn";
import { COLORES_DE_GRUPO, type NombreMayusDeColor } from "@/lib/colores-de-grupo";

/**
 * GrupoBadge — chip de color de zonificación clínica.
 *
 * Específico del dominio Zéndity: cada residente pertenece a un Grupo
 * de color que define quién lo atiende durante el turno. En español
 * SIEMPRE — nunca "RED/YELLOW/GREEN/BLUE" en UI.
 *
 * Los colores, sus hex y sus tintes salen de `@/lib/colores-de-grupo`. Este
 * componente era la unica definicion visual canonica que habia, y por eso el
 * 02-oct-2026 la lista se mudo alla ENTERA en vez de copiarse otra vez. Abrir
 * un color nuevo no toca este fichero.
 *
 * Diseño: tinte suave + borde 1px del color base + punto del color +
 * texto del color. NUNCA fondo saturado al 100% — eso "grita" en grids
 * densos. La saturación está en el punto + el borde.
 *
 * Para mapear desde el enum DB (RED/YELLOW/GREEN/BLUE/ALL/UNASSIGNED)
 * a este componente, los consumidores hacen el match — el componente
 * solo acepta español.
 */
export type GrupoColor = NombreMayusDeColor;

interface GrupoStyle {
    bg: string;
    border: string;
    text: string;
    dot: string;
}

const styles: Record<GrupoColor, GrupoStyle> = Object.fromEntries(
    COLORES_DE_GRUPO.map(c => [c.nombreMayus, c.insignia]),
) as Record<GrupoColor, GrupoStyle>;

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
