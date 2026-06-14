"use client";

import * as React from "react";
import { CheckCheck, Clock, Timer, Activity } from "lucide-react";
import { RondaCard } from "@/components/ui/RondaCard";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { FloorBadge } from "@/components/ui/FloorBadge";
import type { GrupoColor } from "@/components/ui/GrupoBadge";

/**
 * SupervisorRondaTile — feature component.
 *
 * Tile completo del wall del supervisor con TODA la lógica de dominio:
 * cobertura redistribuida, residentes pendientes, casos sin grupo / grupo
 * vacío, late SLA (>120min sin ronda), drill modal y color picker.
 *
 * Compone <RondaCard> (cáscara), <ProgressBar> y <Badge> (status pills).
 * Los chips de cobertura van con estilos inline aquí (tonos del dominio
 * clínico — rojos/amarillos/azules/verdes).
 *
 * Mapeo enum DB (RED/YELLOW/BLUE/GREEN/ALL) → GrupoColor español vive
 * adentro — el call site solo pasa el objeto `cg` que devuelve
 * /api/care/supervisor/caregiver-rounds. Cero traducción en el page.
 */

const DB_TO_GRUPO: Record<string, GrupoColor> = {
    RED: "ROJO",
    YELLOW: "AMARILLO",
    BLUE: "AZUL",
    GREEN: "VERDE",
};

const GRUPO_SUFFIX: Record<GrupoColor, string> = {
    ROJO: "rojos",
    AMARILLO: "amarillos",
    AZUL: "azules",
    VERDE: "verdes",
};

const GRUPO_CHIP: Record<GrupoColor, string> = {
    ROJO: "bg-[#FCEDEC] text-[#A23B38] border-[#F0B5B3]",
    AMARILLO: "bg-[#FBF1DA] text-[#8A6420] border-[#EFD18C]",
    VERDE: "bg-[#DDF3E8] text-[#1A6E4B] border-[#A4DEC0]",
    AZUL: "bg-[#DDE9FC] text-[#1E489E] border-[#A6C0EE]",
};

// Shape mínimo del item que viene del endpoint — el call site puede pasarnos
// cualquier objeto con estos campos. Sin acoplar al tipo Prisma directamente.
export interface RondaTileData {
    caregiverId: string;
    name: string;
    /** Primer color de `colorGroups` — compat con consumidores que solo lean
     *  el campo singular. Para detectar multi-color, usar `colorGroups`. */
    colorGroup: string | null;
    /** D1 ADITIVO — la UNIÓN completa de colores base de la cuidadora
     *  (roster ∪ ColorAssignments del día). Si length > 1, el tile muestra
     *  un chip por cada color base además del shell del primer color. */
    colorGroups?: string[];
    roundsCompleted: number;
    attendedThisRound: number;
    remainingThisRound: number;
    residentsInGroup: number;
    minutesSinceLastRound: number | null;
    coverageCount: number;
    coverageByColor?: Record<string, number> | null;
    pendingResidents?: { name: string; room: string | number | null }[] | null;
    noColorGroup?: boolean;
    emptyGroup?: boolean;
    /** Multi-floor (jun-2026): piso habitual de la cuidadora. null = manager
     *  dual-rol o data anomaly. El tile muestra FloorBadge en el header. */
    floor?: number | null;
}

export interface SupervisorRondaTileProps {
    cg: RondaTileData;
    /** Click en la card (abre drill modal). */
    onOpenDrill: (cg: RondaTileData) => void;
    /** Click en "cambiar" inline (abre color picker). */
    onOpenColorPicker: (data: { id: string; name: string; currentColor: string | null }) => void;
}

export function SupervisorRondaTile({ cg, onOpenDrill, onOpenColorPicker }: SupervisorRondaTileProps) {
    const pct = cg.residentsInGroup > 0
        ? Math.round((cg.attendedThisRound / cg.residentsInGroup) * 100)
        : 0;

    const isLate = cg.minutesSinceLastRound !== null && cg.minutesSinceLastRound > 120;
    const hasNoRounds = cg.roundsCompleted === 0 && cg.attendedThisRound === 0;

    // Caregiver sin pauta base PERO con overrides activos (SUPERVISOR/CAREGIVER
    // cubriendo redistribución). Si su cobertura es de UN solo color → pinta
    // el tile con ese color + label "Grupo X (cobertura)". Si multi-color o
    // sin cobertura → neutral.
    const coverageColors = cg.coverageByColor
        ? Object.keys(cg.coverageByColor).filter((c) => (cg.coverageByColor as Record<string, number>)[c] > 0)
        : [];
    const singleCoverageColor = coverageColors.length === 1 ? coverageColors[0] : null;
    const isCoverageOnly = !cg.colorGroup && cg.coverageCount > 0;
    const effectiveDbColor = cg.colorGroup || (isCoverageOnly ? singleCoverageColor : null);
    const effectiveGrupo: GrupoColor | null = effectiveDbColor
        ? (DB_TO_GRUPO[effectiveDbColor] || null)
        : null;

    // Label del grupo (override del default de la primitiva)
    let grupoLabel: string | undefined;
    if (cg.colorGroup && DB_TO_GRUPO[cg.colorGroup]) {
        grupoLabel = undefined; // dejar que RondaCard ponga "Grupo {GRUPO}"
    } else if (isCoverageOnly && singleCoverageColor && DB_TO_GRUPO[singleCoverageColor]) {
        grupoLabel = `Grupo ${DB_TO_GRUPO[singleCoverageColor]} (cobertura)`;
    } else if (isCoverageOnly) {
        grupoLabel = "Cobertura redistribuida";
    } else if (!cg.colorGroup) {
        grupoLabel = "Sin grupo";
    }

    // Estado vacío: muestra solo el mensaje italic en el cuerpo
    let emptyMessage: string | null = null;
    if (cg.noColorGroup) {
        emptyMessage =
            isCoverageOnly && singleCoverageColor && DB_TO_GRUPO[singleCoverageColor]
                ? `Cubriendo Grupo ${DB_TO_GRUPO[singleCoverageColor]} por redistribución`
                : isCoverageOnly
                    ? "Cubriendo varios grupos por redistribución"
                    : "Sin grupo de color asignado";
    } else if (cg.emptyGroup) {
        emptyMessage = "Grupo sin residentes activos";
    }

    // D1 — Multi-color: si la cuidadora cubre más de UN color base (ej. base
    // BLUE + ColorAssignment YELLOW), mostramos un chip por cada uno además
    // del shell del primer color. Antes del PASO 2(c) el wall solo mostraba
    // el primero — bug del "primero gana".
    const baseColorsAll = (cg.colorGroups && cg.colorGroups.length > 0
        ? cg.colorGroups
        : (cg.colorGroup ? [cg.colorGroup] : [])
    ).filter((c) => c !== 'ALL');
    const multiColor = baseColorsAll.length > 1;

    // Stat header — rondas completadas (color por umbral)
    const statTone =
        cg.roundsCompleted >= 2 ? "text-emerald-600"
        : cg.roundsCompleted === 1 ? "text-amber-600"
        : "text-slate-400";

    const rightSlot = (
        <div className="text-right">
            <p className={`font-[family-name:var(--font-display)] text-2xl font-semibold leading-none ${statTone}`}>
                {cg.roundsCompleted}
            </p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">Rondas</p>
        </div>
    );

    // Link "cambiar" — stopPropagation propio para no triggear el drill
    const changeSlot = (
        <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
                e.stopPropagation();
                onOpenColorPicker({ id: cg.caregiverId, name: cg.name, currentColor: cg.colorGroup });
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenColorPicker({ id: cg.caregiverId, name: cg.name, currentColor: cg.colorGroup });
                }
            }}
            className="text-[10px] font-semibold text-slate-400 hover:text-[var(--color-zendity-teal)] underline decoration-dotted cursor-pointer"
            title="Cambiar grupo base"
        >
            cambiar
        </span>
    );

    const displayName = cg.name.split(" ").slice(0, 2).join(" ");

    return (
        <RondaCard
            grupo={effectiveGrupo}
            name={displayName}
            grupoLabel={grupoLabel}
            rightSlot={rightSlot}
            changeSlot={changeSlot}
            isLate={isLate}
            onClick={() => onOpenDrill(cg)}
        >
            {/* Multi-floor (jun-2026): badge piso de la cuidadora. El wall
                ya agrupa por sección, pero el badge en el tile da contexto
                inmediato en drill-down + cuando el tile aparece bajo
                "Multi-piso / Sin asignar". CAREGIVER+null → variante alarma. */}
            {(cg.floor !== null && cg.floor !== undefined) ? (
                <div className="mb-2">
                    <FloorBadge floor={cg.floor} />
                </div>
            ) : (
                <div className="mb-2">
                    <FloorBadge floor={null} variant="alarm" />
                </div>
            )}

            {emptyMessage ? (
                <p className="text-xs text-slate-500 italic">{emptyMessage}</p>
            ) : (
                <>
                    {/* D1 — Chips de TODOS los colores base cuando la cuidadora
                        cubre más de UNO (ej. base BLUE del Builder + ColorAssignment
                        YELLOW del supervisor). El shell del tile sigue con el
                        primer color para no romper la grid visual, pero el
                        supervisor ve explícito qué grupos está atendiendo. */}
                    {multiColor && (
                        <div className="flex flex-wrap gap-1.5 items-center mb-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                Grupos:
                            </span>
                            {baseColorsAll.map((dbColor) => {
                                const g = DB_TO_GRUPO[dbColor];
                                if (!g) return null;
                                return (
                                    <span
                                        key={dbColor}
                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${GRUPO_CHIP[g]}`}
                                    >
                                        {g}
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {/* Progreso de ronda actual */}
                    <ProgressBar
                        value={cg.attendedThisRound}
                        max={cg.residentsInGroup}
                        tone={(p) => (p >= 90 ? "success" : p >= 50 ? "warning" : "neutral")}
                        label={`Ronda actual: ${cg.attendedThisRound}/${cg.residentsInGroup}`}
                    />

                    {/* Status pills */}
                    <div className="flex flex-wrap gap-1.5 items-center mt-3">
                        {pct === 100 && (
                            <Badge variant="success">
                                <CheckCheck className="w-3 h-3" /> Ronda completa
                            </Badge>
                        )}
                        {pct < 100 && cg.remainingThisRound > 0 && (
                            <Badge variant="neutral">
                                <Clock className="w-3 h-3" /> {cg.remainingThisRound} pendiente{cg.remainingThisRound > 1 ? "s" : ""}
                            </Badge>
                        )}
                        {isLate && cg.minutesSinceLastRound !== null && (
                            <Badge variant="warning">
                                <Timer className="w-3 h-3" /> +{Math.round(cg.minutesSinceLastRound / 60)}h sin ronda
                            </Badge>
                        )}
                        {hasNoRounds && !cg.noColorGroup && !cg.emptyGroup && (
                            <Badge variant="neutral">
                                <Activity className="w-3 h-3" /> Sin actividad aún
                            </Badge>
                        )}
                    </div>

                    {/* Cobertura adicional (overrides activos) */}
                    {cg.coverageCount > 0 && cg.coverageByColor && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                    + cobertura:
                                </span>
                                {(Object.entries(cg.coverageByColor) as [string, number][])
                                    .filter(([, count]) => count > 0)
                                    .map(([dbColor, count]) => {
                                        const g = DB_TO_GRUPO[dbColor];
                                        if (!g) return null;
                                        return (
                                            <span
                                                key={dbColor}
                                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${GRUPO_CHIP[g]}`}
                                            >
                                                +{count} {GRUPO_SUFFIX[g]}
                                            </span>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* Residentes pendientes */}
                    {cg.pendingResidents && cg.pendingResidents.length > 0 && cg.pendingResidents.length <= 5 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Pendientes:
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {cg.pendingResidents.map((r, i) => (
                                    <span
                                        key={i}
                                        className="text-[10px] font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200"
                                    >
                                        {r.name}
                                        {r.room !== null && r.room !== undefined && (
                                            <span className="text-slate-400"> · Hab {r.room}</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {cg.pendingResidents && cg.pendingResidents.length > 5 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                {cg.pendingResidents.length} residentes pendientes
                            </p>
                        </div>
                    )}

                    {/* Footer: tiempo desde última ronda (no si es late) */}
                    {cg.minutesSinceLastRound !== null && !isLate && (
                        <p className="text-[10px] text-slate-400 font-medium mt-2">
                            Última ronda completada hace {cg.minutesSinceLastRound}m
                        </p>
                    )}
                </>
            )}
        </RondaCard>
    );
}

export default SupervisorRondaTile;
