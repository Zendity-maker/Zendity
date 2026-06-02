import * as React from "react";
import { cn } from "./cn";

/**
 * HeroCard — la firma visual del producto Zéndity.
 *
 * Tarjeta con fondo navy (gradiente #0F1B2E → #16243B) para destacar
 * la pieza canónica de un dashboard: prólogo del turno, briefing del día,
 * KPI principal de la pantalla.
 *
 * REGLA DE CONTRASTE OBLIGATORIA — el bug histórico fue texto gris-sobre-gris
 * (ilegible). Aquí los colores son explícitos:
 *   - title:     #FFFFFF (font-display)
 *   - subtitle:  #AEBCD0 (secundario)
 *   - children:  #D2DBEA (cuerpo legible)
 *   - eyebrow:   #2FB3A6 (teal-on-dark) con punto a la izquierda
 *
 * No mezcla con el token --brand-primary del tenant. El navy es producto
 * Zéndity puro, igual en Vivid, Bristol o cualquier sede.
 */
export interface HeroCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    /** Etiqueta corta arriba del título, con punto teal-on-dark. Ej: "PRÓLOGO". */
    eyebrow?: string;
    /** Icono opcional a la izquierda del bloque title/subtitle. Acento de identidad
     *  (ej. ShieldAlert en Mission Control). Si lo omites, el bloque ocupa todo el ancho. */
    icon?: React.ReactNode;
    /** Título principal (font-display, 24-32px). */
    title: React.ReactNode;
    /** Subtítulo opcional debajo del título. */
    subtitle?: React.ReactNode;
    /** Slot a la derecha del header (botones, métricas, badge). */
    actions?: React.ReactNode;
}

export function HeroCard({ eyebrow, icon, title, subtitle, actions, className, children, ...rest }: HeroCardProps) {
    return (
        <div
            className={cn(
                "relative rounded-2xl p-6 md:p-7",
                "border border-[var(--color-navy-line)]",
                "bg-gradient-to-br from-[var(--color-navy)] to-[var(--color-navy-2)]",
                "text-[#D2DBEA]",
                className,
            )}
            {...rest}
        >
            <div className="flex items-start gap-4 flex-wrap">
                {icon && <div className="flex-shrink-0 mt-1">{icon}</div>}
                <div className="flex-1 min-w-0">
                    {eyebrow && (
                        <div className="inline-flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-teal-on-dark)]">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-teal-on-dark)]" aria-hidden />
                            {eyebrow}
                        </div>
                    )}
                    <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl font-semibold tracking-tight text-white leading-tight">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="mt-2 text-sm text-[#AEBCD0] leading-relaxed">{subtitle}</p>
                    )}
                </div>
                {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
            </div>
            {children && (
                <div className="mt-5 text-[15px] leading-relaxed text-[#D2DBEA]">{children}</div>
            )}
        </div>
    );
}

export default HeroCard;
