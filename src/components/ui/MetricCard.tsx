import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "./Card";
import { cn } from "./cn";
import { tonePalette, type Tone } from "./tone-tokens";

/**
 * MetricCard — primitiva del idioma "overview".
 *
 * Hermana de StatTile, pero distinta a propósito:
 *   - StatTile  : surface entero tematizado (bg + border + value + label + caption
 *                 todo en el mismo tono). Para dashboards operacionales (supervisor,
 *                 billing). Énfasis fuerte por tono.
 *   - MetricCard: idioma "overview" del landing. surface puede ser neutro o soft;
 *                 el value es el que carga el color. Icono chico en píldora o
 *                 inline. Soporta clickeable (Link + ArrowRight hover).
 *
 * Consume `tonePalette` central — no decide sus propios colores. "warning" significa
 * amber en MetricCard porque significa amber en el catálogo.
 *
 * Condicionales (alert > 0 vs = 0, etc.) SIEMPRE en el call site:
 *   tone={count > 0 ? "danger" : "success"}
 */

export type MetricCardSurface = "neutral" | "soft";
export type MetricCardIconStyle = "pill" | "inline";

export interface MetricCardProps {
    value: React.ReactNode;
    label: string;
    /** Default 'neutral'. */
    tone?: Tone;
    /** 'neutral' = bg-white; 'soft' = bg-{tone}-50/60. Default 'neutral'. */
    surface?: MetricCardSurface;
    icon?: React.ReactNode;
    /** Default: 'pill' si surface='soft', 'inline' si surface='neutral'. */
    iconStyle?: MetricCardIconStyle;
    /**
     * Color del value:
     *   - 'match'   (default): value usa el tono — strong en surface='soft', medium en 'neutral'.
     *   - 'neutral': value siempre slate-800. Útil cuando el chrome ya carga el color
     *                (Live Stats: card teal, label teal, value queda neutral para legibilidad).
     */
    valueTone?: "match" | "neutral";
    caption?: React.ReactNode;
    /** Si lo pasas, la card renderiza como `<Link>` con ArrowRight en hover. */
    href?: string;
    /** Si lo pasas, la card renderiza como `<button>`. */
    onClick?: () => void;
    className?: string;
}

export function MetricCard({
    value,
    label,
    tone = "neutral",
    surface = "neutral",
    icon,
    iconStyle,
    valueTone = "match",
    caption,
    href,
    onClick,
    className,
}: MetricCardProps) {
    const t = tonePalette[tone];
    const effectiveIconStyle: MetricCardIconStyle = iconStyle ?? (surface === "soft" ? "pill" : "inline");

    // Surface
    const surfaceClass = surface === "soft"
        ? cn(t.soft.bg, t.soft.border)
        : "bg-white border-slate-200";

    // Label color: en soft se tinta con el tono fuerte; en neutral queda slate
    const labelClass = surface === "soft" ? t.text.strong : "text-slate-500";

    // Value color:
    //   - valueTone='neutral' → siempre slate-800 (Live Stats: chrome teal con value neutral)
    //   - surface='soft'      → tono fuerte (Alertas/Estado: indigo-700, rose-700, etc.)
    //   - surface='neutral'   → tono medio cuando hay tono; slate-800 cuando tone='neutral'
    //                           (Social: rose-600, amber-600, emerald-600, o slate-800)
    const valueClass = valueTone === "neutral"
        ? "text-slate-800"
        : surface === "soft"
            ? t.text.strong
            : (tone === "neutral" ? "text-slate-800" : t.text.medium);

    // Caption color:
    //   - soft con landing usa slate-500 (neutro), no el tono. Es lo que vimos en /:
    //     "En residencia" slate-500. Aplica también para Live Stats ("En piso ahora" slate-500).
    //   - soft + alertas usa el tono (rose-500 "Requiere revisión" / emerald-600 "Sin alertas")
    //     → ese matiz lo decide el call site pasando ya el texto; aquí mantenemos slate-500
    //     como baseline neutro. En Alertas usamos slate-500 igual — el contraste rose vs
    //     emerald lo carga la card entera, no el caption.
    //   - neutral → slate-400.
    const captionClass = surface === "soft" ? "text-slate-500" : "text-slate-400";

    const isClickable = !!(href || onClick);

    // Layout del cuerpo
    const body = (
        <>
            {/* Header: icon + label */}
            {(icon || label) && (
                <div className="flex items-center gap-2 mb-2">
                    {icon && effectiveIconStyle === "pill" && (
                        <div className={cn("inline-flex items-center justify-center p-1.5 rounded-md", t.pill.bg, t.pill.fg)}>
                            {icon}
                        </div>
                    )}
                    {icon && effectiveIconStyle === "inline" && (
                        <div className={cn("inline-flex items-center justify-center", t.inline)}>
                            {icon}
                        </div>
                    )}
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", labelClass)}>
                        {label}
                    </p>
                </div>
            )}

            {/* Value */}
            <p className={cn("text-3xl font-black leading-none", valueClass)}>
                {value}
            </p>

            {/* Caption (+ ArrowRight si clickeable) */}
            {(caption || isClickable) && (
                <p className={cn("text-[10px] font-semibold mt-1 flex items-center gap-1", captionClass)}>
                    {caption}
                    {isClickable && (
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </p>
            )}
        </>
    );

    const sharedClassName = cn(
        "rounded-xl p-4 block",
        isClickable && "group transition-all hover:shadow-sm",
        className,
    );

    if (href) {
        return (
            <Link
                href={href}
                className={cn(
                    sharedClassName,
                    "border",
                    surfaceClass,
                )}
            >
                {body}
            </Link>
        );
    }

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    sharedClassName,
                    "border text-left w-full",
                    surfaceClass,
                )}
            >
                {body}
            </button>
        );
    }

    return (
        <Card
            variant="flat"
            padding="default"
            className={cn(
                "p-4 rounded-xl",
                surfaceClass,
                className,
            )}
        >
            {body}
        </Card>
    );
}

export default MetricCard;
