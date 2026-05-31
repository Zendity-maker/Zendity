import * as React from "react";
import { cn } from "./cn";

/**
 * Card — primitive del design system Zéndity.
 *
 * Superficie blanca con radio 16px (rounded-2xl) y borde 1px slate-200.
 * Es el contenedor canónico de información del producto: dashboards,
 * paneles, listas. Reemplaza el patrón "bg-white rounded-2xl border…"
 * inline repetido en 80+ archivos del codebase.
 *
 * Variantes:
 *   - flat (default): solo borde, sin sombra. Para grids densos.
 *   - elevated: borde + shadow-card. Para destacar piezas individuales.
 *
 * Paddings:
 *   - default (24px): contenido respira. Para cards principales.
 *   - compact (16px): para cards en grids o métricas pequeñas.
 *
 * Convención: la marca del producto (teal #0F6B78) NO vive en el chrome
 * de la card — vive en los acentos (botones, badges) dentro de ella.
 */
export type CardVariant = "flat" | "elevated";
export type CardPadding = "default" | "compact";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: CardVariant;
    padding?: CardPadding;
    /** Si lo necesitas como otro tag (article, section). Default 'div'. */
    as?: React.ElementType;
}

const variantClasses: Record<CardVariant, string> = {
    flat: "border border-slate-200 bg-white",
    elevated: "border border-slate-200 bg-white shadow-[var(--shadow-card)]",
};

const paddingClasses: Record<CardPadding, string> = {
    default: "p-6",
    compact: "p-4",
};

export function Card({
    variant = "flat",
    padding = "default",
    as: Tag = "div",
    className,
    children,
    ...rest
}: CardProps) {
    return (
        <Tag
            className={cn("rounded-2xl", variantClasses[variant], paddingClasses[padding], className)}
            {...rest}
        >
            {children}
        </Tag>
    );
}

export default Card;
