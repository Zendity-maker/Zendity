import * as React from "react";
import { cn } from "./cn";
import type { GrupoColor } from "./GrupoBadge";

/**
 * RondaCard — card de cuidadora/ronda en el wall del supervisor.
 *
 * Card blanca con borde izquierdo 4px del color de grupo + punto + nombre +
 * label + slots opcionales para stats, progreso, status pills, cobertura,
 * pendientes, footer y alerta.
 *
 * Carácter visual: la saturación vive en el borde izquierdo y el punto. El
 * fondo es BLANCO — esto era el bug histórico: tiles con fondos saturados
 * al 100% fatigaban la vista en grids densos. Aquí cada tile compite por
 * atención con borde + punto + tipografía, no con color de fondo.
 *
 * Slots (todos opcionales — el uso simple sigue siendo de 3-4 props):
 *   - stat:          conteo grande arriba a la derecha del header
 *   - progress:      barra "X/Y" con % al lado
 *   - statusBadges:  array de status pills debajo del progreso
 *   - coverage:      sección "+ cobertura:" con chips de grupo
 *   - pending:       sección "Pendientes:" con chips de residentes
 *   - footer:        texto pequeño al pie ("Última ronda hace X min")
 *   - emptyMessage:  texto italic en el cuerpo (omite progreso/status)
 *   - alert:         envuelve la card con ring amber (SLA expirado)
 *   - onChangeGroup: si se pasa, añade link "cambiar" inline tras el label
 *
 * `grupo: GrupoColor | null` — null pinta neutral (gris). Cubre el caso
 * "Sin grupo asignado pero con cobertura redistribuida multi-color".
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

const grupoChip: Record<GrupoColor, string> = {
    ROJO: "bg-[#FCEDEC] text-[#A23B38] border-[#F0B5B3]",
    AMARILLO: "bg-[#FBF1DA] text-[#8A6420] border-[#EFD18C]",
    VERDE: "bg-[#DDF3E8] text-[#1A6E4B] border-[#A4DEC0]",
    AZUL: "bg-[#DDE9FC] text-[#1E489E] border-[#A6C0EE]",
};

const NEUTRAL_BORDER = "border-l-slate-300";
const NEUTRAL_DOT = "bg-slate-400";
const NEUTRAL_TEXT = "text-slate-500";

// ── Tipos de slots ──────────────────────────────────────────────────────

export type StatTone = "success" | "warning" | "neutral";

export interface StatSlot {
    /** Valor grande (típicamente número, ej. rondas completadas). */
    value: React.ReactNode;
    /** Label corto debajo del valor, ej. "Rondas". */
    label: string;
    /** Color del valor. Default: neutral (slate). */
    tone?: StatTone;
}

export interface ProgressSlot {
    /** Numerador. Ej. attendedThisRound. */
    current: number;
    /** Denominador. Ej. residentsInGroup. */
    total: number;
    /** Texto opcional antes de "X/Y". Default: "Ronda actual". */
    label?: string;
}

export type StatusVariant = "success" | "warning" | "danger" | "neutral";

export interface StatusPill {
    variant: StatusVariant;
    icon?: React.ReactNode;
    label: string;
}

export interface CoverageChip {
    grupo: GrupoColor;
    count: number;
    /** Texto post-count, ej. "rojos" / "amarillos". */
    suffix?: string;
}

export interface CoverageSlot {
    /** Default: "+ cobertura:" */
    label?: string;
    chips: CoverageChip[];
}

export interface PendingItem {
    label: string;
    /** Sub-label, ej. "Hab 2-03". */
    sub?: string;
}

export interface PendingSlot {
    /** Default: "Pendientes:" */
    label?: string;
    items: PendingItem[];
    /** Si la lista real es más larga, muestra "N residentes pendientes" en su lugar. */
    overflowAt?: number;
    /** Total real (para el mensaje overflow). */
    totalCount?: number;
}

// ── Props del componente ────────────────────────────────────────────────

export interface RondaCardProps {
    grupo: GrupoColorOrNull;
    name: string;
    /** Override del label completo del grupo. Sin esto: "Grupo {GRUPO}" o "Sin grupo" si null. */
    grupoLabel?: string;
    /** Si se pasa, añade link "cambiar" inline después del label, con stopPropagation propio. */
    onChangeGroup?: () => void;
    /** Stat grande arriba a la derecha del header (ej. rondas completadas). */
    stat?: StatSlot;
    /** Bloque de progreso "X/Y" + barra + %. */
    progress?: ProgressSlot;
    /** Status pills (ronda completa, pendientes, late, etc.). */
    statusBadges?: StatusPill[];
    /** Cobertura adicional (overrides activos). */
    coverage?: CoverageSlot;
    /** Residentes pendientes. */
    pending?: PendingSlot;
    /** Texto pequeño al pie (ej. "Última ronda hace 15m"). */
    footer?: React.ReactNode;
    /** Si se pasa, oculta progreso/status/coverage/pending y muestra solo este mensaje italic. */
    emptyMessage?: React.ReactNode;
    /** Ring amber alrededor (SLA expirado / retraso). */
    alert?: boolean;
    /** Click en la card. Si está presente, la card es interactiva (button). */
    onClick?: () => void;
    /** Espresivo: legacy del UI kit. Si se pasa SIN progress, muestra número grande a la derecha. */
    percent?: number | null;
    className?: string;
}

// ── Helpers internos ────────────────────────────────────────────────────

const statTone: Record<StatTone, string> = {
    success: "text-emerald-600",
    warning: "text-amber-600",
    neutral: "text-slate-400",
};

const statusVariantClasses: Record<StatusVariant, string> = {
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-rose-50 text-rose-700",
    neutral: "bg-slate-100 text-slate-700",
};

function percentColor(pct: number): string {
    if (pct >= 90) return "text-[#1A6E4B]";
    if (pct >= 70) return "text-slate-700";
    if (pct >= 50) return "text-[#8A6420]";
    return "text-[#A23B38]";
}

function progressBarColor(pct: number): string {
    if (pct >= 100) return "bg-[#22A06B]";
    if (pct >= 50) return "bg-[#E5A93D]";
    return "bg-slate-300";
}

// ── Componente principal ─────────────────────────────────────────────────

export function RondaCard({
    grupo,
    name,
    grupoLabel,
    onChangeGroup,
    stat,
    progress,
    statusBadges,
    coverage,
    pending,
    footer,
    emptyMessage,
    alert,
    onClick,
    percent,
    className,
}: RondaCardProps) {
    const interactive = typeof onClick === "function";

    // Estilos derivados de grupo (con fallback neutral si null)
    const borderClass = grupo ? grupoBorder[grupo] : NEUTRAL_BORDER;
    const dotClass = grupo ? grupoDot[grupo] : NEUTRAL_DOT;
    const labelTextClass = grupo ? grupoText[grupo] : NEUTRAL_TEXT;

    // Label por defecto
    const resolvedLabel = grupoLabel ?? (grupo ? `Grupo ${grupo}` : "Sin grupo");

    const containerClass = cn(
        "w-full rounded-2xl bg-white border border-slate-200 border-l-4",
        "p-4 text-left",
        "transition-colors duration-150",
        borderClass,
        alert && "ring-2 ring-amber-400/40",
        interactive && "hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-zendity-teal)]",
        className,
    );

    // Computar percent del bloque progress
    const progressPct = progress
        ? progress.total > 0
            ? Math.round((progress.current / progress.total) * 100)
            : 0
        : null;

    // Resolver pending (con overflow)
    const pendingOverflowCount =
        pending && pending.overflowAt !== undefined && pending.totalCount !== undefined && pending.totalCount > pending.overflowAt
            ? pending.totalCount
            : null;

    const body = (
        <>
            {/* HEADER: punto + nombre + label + cambiar + stat */}
            <div className="flex items-start gap-3 mb-3">
                <div className={cn("flex-shrink-0 w-2.5 h-2.5 rounded-full mt-1.5", dotClass)} aria-hidden />
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 leading-tight truncate">{name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                        <span className={cn("font-bold tracking-wide", labelTextClass)}>{resolvedLabel}</span>
                        {onChangeGroup && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChangeGroup();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onChangeGroup();
                                    }
                                }}
                                className="text-[10px] font-semibold text-slate-400 hover:text-[var(--color-zendity-teal)] underline decoration-dotted cursor-pointer"
                                title="Cambiar grupo base"
                            >
                                cambiar
                            </span>
                        )}
                    </div>
                </div>
                {stat && (
                    <div className="flex-shrink-0 text-right">
                        <p className={cn("font-[family-name:var(--font-display)] text-2xl font-semibold leading-none", statTone[stat.tone || "neutral"])}>
                            {stat.value}
                        </p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{stat.label}</p>
                    </div>
                )}
                {/* Fallback legacy del UI kit: percent grande a la derecha solo si NO hay progress ni stat */}
                {percent !== null && percent !== undefined && !progress && !stat && (
                    <div className="flex-shrink-0 text-right">
                        <p className={cn("font-[family-name:var(--font-display)] text-2xl font-semibold leading-none", percentColor(percent))}>
                            {Math.round(percent)}
                            <span className="text-base">%</span>
                        </p>
                    </div>
                )}
            </div>

            {emptyMessage ? (
                <p className="text-xs text-slate-500 italic">{emptyMessage}</p>
            ) : (
                <>
                    {/* PROGRESS */}
                    {progress && progressPct !== null && (
                        <div className="mb-3">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-bold text-slate-600">
                                    {progress.label || "Ronda actual"}: {progress.current}/{progress.total}
                                </span>
                                <span className={cn("text-[11px] font-bold", progressPct === 100 ? "text-emerald-600" : progressPct >= 50 ? "text-amber-600" : "text-slate-500")}>
                                    {progressPct}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full transition-all duration-500", progressBarColor(progressPct))}
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* STATUS BADGES */}
                    {statusBadges && statusBadges.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 items-center">
                            {statusBadges.map((b, i) => (
                                <span
                                    key={i}
                                    className={cn(
                                        "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                                        statusVariantClasses[b.variant],
                                    )}
                                >
                                    {b.icon && <span className="inline-flex shrink-0">{b.icon}</span>}
                                    {b.label}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* COVERAGE */}
                    {coverage && coverage.chips.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                    {coverage.label || "+ cobertura:"}
                                </span>
                                {coverage.chips.map((c, i) => (
                                    <span key={i} className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", grupoChip[c.grupo])}>
                                        +{c.count} {c.suffix ?? ""}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PENDING */}
                    {pending && pending.items.length > 0 && pendingOverflowCount === null && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                {pending.label || "Pendientes:"}
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {pending.items.map((p, i) => (
                                    <span key={i} className="text-[10px] font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                                        {p.label}
                                        {p.sub && <span className="text-slate-400"> · {p.sub}</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {pendingOverflowCount !== null && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                {pendingOverflowCount} residentes pendientes
                            </p>
                        </div>
                    )}

                    {/* FOOTER */}
                    {footer && <p className="text-[10px] text-slate-400 font-medium mt-2">{footer}</p>}
                </>
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
