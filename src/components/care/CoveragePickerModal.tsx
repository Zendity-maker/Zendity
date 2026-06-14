"use client";

import React, { useMemo, useState, useEffect } from "react";
import { X, Users, AlertTriangle, CheckCircle2, Loader2, Sparkles, Building2 } from "lucide-react";

/**
 * CoverageColorOption — una opción seleccionable del picker. SPRINT
 * MULTI-FLOOR (jun-2026): ahora es per-(color, floor), no solo color.
 *
 * El call site puede emitir el mismo color para varios pisos (ej. RED
 * piso 1 + RED piso 2) y el picker los muestra agrupados por piso.
 *
 * `floor=null` se permite para residentes sin piso asignado (data
 * anomaly cazada por el sentinel de Phase 4); aparecen en una sección
 * "Sin piso" al final del modal.
 */
export interface CoverageColorOption {
    color: string;
    /** Piso del grupo (residentes de este color en este piso). null = sin piso asignado. */
    floor: number | null;
    patientsCount: number;
    status: 'absent' | 'already_redistributed' | 'covered';
    coveredBy?: string | null; // nombre del cuidador que ya lo cubre
    redistributedTo?: string[]; // nombres si ya se repartió entre otros
}

/**
 * Selección emitida por el picker — tupla (color, floor) explícita. El
 * caller agrupa por floor y emite 1 POST de claim-coverage por floor
 * con su targetFloor + (eventualmente) allowCrossFloor.
 */
export interface CoveragePick {
    color: string;
    floor: number | null;
}

interface CoveragePickerModalProps {
    isOpen: boolean;
    title?: string;
    subtitle?: string;
    options: CoverageColorOption[];
    /**
     * Floor habitual del invocador (de User.floor). Si es null (manager
     * dual-rol o data anomaly), NO se marca cross-piso — el picker no
     * tiene base de comparación. Si selectedFloor !== invokerFloor y
     * ambos !== null → cross-floor break-glass: aparece confirmación
     * ámbar y el caller debe pasar allowCrossFloor=true.
     */
    invokerFloor: number | null;
    submitting?: boolean;
    onClose: () => void;
    /**
     * Emitido al confirmar. picks vienen con (color, floor); el caller
     * agrupa por floor y emite 1 claim-coverage por grupo de floor
     * pasando allowCrossFloor=true cuando ese floor !== invokerFloor.
     */
    onSelect: (picks: CoveragePick[], allowCrossFloor: boolean) => void;
}

const COLOR_BG: Record<string, string> = {
    RED: 'bg-red-500',
    YELLOW: 'bg-amber-500',
    GREEN: 'bg-emerald-500',
    BLUE: 'bg-blue-500',
};

const COLOR_LABEL: Record<string, string> = {
    RED: 'Rojo',
    YELLOW: 'Amarillo',
    GREEN: 'Verde',
    BLUE: 'Azul',
};

function floorLabel(floor: number | null): string {
    if (floor === null) return 'Sin piso';
    return `Piso ${floor}`;
}

function pickKey(p: CoveragePick): string {
    return `${p.color}::${p.floor ?? 'null'}`;
}

export default function CoveragePickerModal({
    isOpen,
    title = '¿Qué grupo vas a cubrir hoy?',
    subtitle = 'Selecciona el grupo de residentes que atenderás.',
    options,
    invokerFloor,
    submitting = false,
    onClose,
    onSelect,
}: CoveragePickerModalProps) {
    const [selectedPicks, setSelectedPicks] = useState<CoveragePick[]>([]);
    const [crossFloorConfirmed, setCrossFloorConfirmed] = useState(false);

    // Reset al cerrar/abrir el modal — evitar selecciones huérfanas entre
    // sesiones del picker (caso: usuario cancela y reabre, no debe recordar
    // la confirmación cross-piso anterior).
    useEffect(() => {
        if (!isOpen) {
            setSelectedPicks([]);
            setCrossFloorConfirmed(false);
        }
    }, [isOpen]);

    // Solo mostramos colores ausentes o ya redistribuidos (cobertura genuina).
    const pickableOptions = useMemo(
        () => options.filter(o => o.status === 'absent' || o.status === 'already_redistributed'),
        [options]
    );

    // Pisos presentes en las opciones, ordenados. null al final.
    const floors = useMemo(() => {
        const set = new Set<number | null>();
        for (const o of pickableOptions) set.add(o.floor);
        const arr = Array.from(set);
        arr.sort((a, b) => {
            if (a === null) return 1;
            if (b === null) return -1;
            return a - b;
        });
        return arr;
    }, [pickableOptions]);

    // Floor único de la selección actual. null si no hay nada seleccionado.
    // CONSTRAINT: la selección debe compartir floor — toggle a otra opción
    // de DISTINTO floor LIMPIA la selección previa (1 floor por submit).
    const selectedFloor: number | null | undefined = selectedPicks.length > 0
        ? selectedPicks[0].floor
        : undefined;

    // Cross-floor detection: usuario seleccionó un floor que NO es el suyo,
    // ambos conocidos (!= null). Manager (invokerFloor=null) o residentes
    // sin piso (selectedFloor=null) NO disparan break-glass.
    const isCrossFloor = selectedFloor !== undefined
        && selectedFloor !== null
        && invokerFloor !== null
        && selectedFloor !== invokerFloor;

    if (!isOpen) return null;

    // Función pura para decidir si una opción está LOCKED por la regla
    // "1 piso por submit". Si ya hay selección y el floor de la opción
    // no coincide → locked. Una opción locked se visualiza atenuada y
    // su click es no-op (en vez de wipear silenciosamente la selección
    // del otro piso). Decisión deliberada: la fricción extra al cambiar
    // de piso es preferible a la trampa silenciosa "creí que añadía,
    // borró el piso anterior y solo cubrí este".
    const isOptionLocked = (opt: CoverageColorOption): boolean => {
        if (selectedPicks.length === 0) return false;
        return selectedPicks[0].floor !== opt.floor;
    };

    const toggle = (opt: CoverageColorOption) => {
        // Guard: si la opción está locked (otro piso), no hace nada.
        // El usuario debe deseleccionar el piso actual primero — fricción
        // deliberada vs. wipe silencioso.
        if (isOptionLocked(opt)) return;

        const newPick: CoveragePick = { color: opt.color, floor: opt.floor };
        const newKey = pickKey(newPick);

        setSelectedPicks(prev => {
            // Mismo floor: toggle dentro del grupo
            const existing = prev.findIndex(p => pickKey(p) === newKey);
            if (existing >= 0) {
                const next = [...prev];
                next.splice(existing, 1);
                if (next.length === 0) setCrossFloorConfirmed(false);
                return next;
            }
            return [...prev, newPick];
        });
    };

    const selectAllInFloor = (floor: number | null) => {
        // Guard: solo permite "cubrir todo este piso" si NO hay selección
        // en otro piso. Mismo principio que toggle — no wipear silenciosamente.
        if (selectedPicks.length > 0 && selectedPicks[0].floor !== floor) return;
        const picksForFloor = pickableOptions
            .filter(o => o.floor === floor)
            .map(o => ({ color: o.color, floor: o.floor } as CoveragePick));
        setSelectedPicks(picksForFloor);
    };

    const clearSelection = () => {
        setSelectedPicks([]);
        setCrossFloorConfirmed(false);
    };

    const canSubmit = selectedPicks.length > 0
        && !submitting
        && (!isCrossFloor || crossFloorConfirmed);

    const handleConfirm = () => {
        onSelect(selectedPicks, isCrossFloor && crossFloorConfirmed);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 md:p-8">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-200 flex items-start justify-between bg-gradient-to-br from-teal-50 to-white">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
                            <Sparkles size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 leading-tight">{title}</h2>
                            <p className="text-sm text-slate-500 font-semibold mt-1">{subtitle}</p>
                            {invokerFloor !== null && (
                                <p className="text-xs font-bold text-teal-700 mt-1 inline-flex items-center gap-1">
                                    <Building2 size={12} />
                                    Tu piso: {floorLabel(invokerFloor)}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                        disabled={submitting}
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Lista por piso */}
                <div className="p-6 md:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                    {pickableOptions.length === 0 && (
                        <div className="text-center py-10 text-slate-500">
                            <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" />
                            <p className="font-bold text-slate-700">Todos los grupos están cubiertos</p>
                            <p className="text-sm font-medium text-slate-500 mt-1">No hay residentes sin cuidador asignado.</p>
                        </div>
                    )}

                    {/* Hint visible cuando la regla "1 piso por submit" está actuando:
                        hay selección en un piso, los demás están atenuados. La
                        fricción para cambiar de piso es deliberada — el wipe
                        silencioso era trampa en el camino de emergencia. */}
                    {selectedPicks.length > 0 && floors.length > 1 && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
                            <span className="font-bold text-slate-600">
                                Un piso a la vez. Otros pisos atenuados — deselecciona el actual para cambiar.
                            </span>
                            <button
                                type="button"
                                onClick={clearSelection}
                                disabled={submitting}
                                className="font-bold text-slate-700 hover:text-slate-900 underline decoration-dotted shrink-0"
                            >
                                Deseleccionar
                            </button>
                        </div>
                    )}

                    {floors.map(floor => {
                        const floorOpts = pickableOptions.filter(o => o.floor === floor);
                        if (floorOpts.length === 0) return null;
                        const isOwnFloor = invokerFloor !== null && floor === invokerFloor;
                        const isOtherFloor = invokerFloor !== null && floor !== null && floor !== invokerFloor;
                        // Bloque locked: ya hay selección en OTRO piso. Visual
                        // atenuado y el "cubrir todo este piso" se deshabilita
                        // (mismo principio que las cards individuales).
                        const blockLocked = selectedPicks.length > 0 && selectedPicks[0].floor !== floor;

                        return (
                            <div key={String(floor)} className={`space-y-2 ${blockLocked ? 'opacity-40' : ''}`}>
                                {/* Sub-header del piso */}
                                <div className="flex items-center gap-2 px-1">
                                    <Building2 size={14} className={isOtherFloor ? 'text-amber-600' : 'text-slate-500'} />
                                    <span className={`text-xs font-black uppercase tracking-widest ${isOtherFloor ? 'text-amber-700' : 'text-slate-600'}`}>
                                        {floorLabel(floor)}
                                    </span>
                                    {isOwnFloor && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                                            Tu piso
                                        </span>
                                    )}
                                    {isOtherFloor && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
                                            Cross-piso · break-glass
                                        </span>
                                    )}
                                    {floor === null && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-full">
                                            Sin piso
                                        </span>
                                    )}
                                    {blockLocked && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                            Locked
                                        </span>
                                    )}
                                    {floorOpts.length > 1 && (
                                        <button
                                            onClick={() => selectAllInFloor(floor)}
                                            disabled={submitting || blockLocked}
                                            className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 underline decoration-dotted disabled:no-underline disabled:cursor-not-allowed"
                                        >
                                            Cubrir todo este piso
                                        </button>
                                    )}
                                </div>

                                {/* Cards de colores en este piso */}
                                <div className="space-y-2">
                                    {floorOpts.map(opt => {
                                        const isSelected = selectedPicks.some(p => p.color === opt.color && p.floor === opt.floor);
                                        const wasRedistributed = opt.status === 'already_redistributed';
                                        const optLocked = isOptionLocked(opt);
                                        return (
                                            <button
                                                key={`${opt.color}::${opt.floor ?? 'null'}`}
                                                onClick={() => toggle(opt)}
                                                disabled={submitting || optLocked}
                                                aria-disabled={optLocked || undefined}
                                                title={optLocked ? 'Deselecciona el piso actual para elegir otro' : undefined}
                                                className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                                                    isSelected
                                                        ? isOtherFloor
                                                            ? 'border-amber-500 bg-amber-50 shadow-md'
                                                            : 'border-teal-500 bg-teal-50 shadow-md'
                                                        : optLocked
                                                            ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                                                            : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50'
                                                } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <div className={`w-12 h-12 rounded-2xl ${COLOR_BG[opt.color] || 'bg-slate-400'} shadow-sm shrink-0 flex items-center justify-center text-white font-black text-xs tracking-widest`}>
                                                    {COLOR_LABEL[opt.color]?.charAt(0).toUpperCase() || opt.color.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-black text-slate-900 text-base">{COLOR_LABEL[opt.color] || opt.color}</span>
                                                        {wasRedistributed ? (
                                                            <span className="text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                                                                Redistribuido
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                                                                Sin cuidador
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-600 font-semibold mt-0.5">
                                                        {opt.patientsCount} residente{opt.patientsCount === 1 ? '' : 's'} en este grupo
                                                    </p>
                                                    {wasRedistributed && opt.redistributedTo && opt.redistributedTo.length > 0 && (
                                                        <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                                            Redistribuido entre: <span className="text-slate-700">{Array.from(new Set(opt.redistributedTo)).join(', ')}</span>
                                                            <span className="text-amber-700"> — al seleccionar los tomas de vuelta</span>
                                                        </p>
                                                    )}
                                                </div>
                                                <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                                                    isSelected
                                                        ? (isOtherFloor ? 'bg-amber-600 border-amber-600 text-white' : 'bg-teal-600 border-teal-600 text-white')
                                                        : 'border-slate-300 bg-white'
                                                }`}>
                                                    {isSelected && <CheckCircle2 size={18} strokeWidth={3} />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Confirmación cross-piso — requiere check explícito antes
                        de habilitar el submit. Razón: el picker emite
                        allowCrossFloor=true al backend solo si esto está
                        confirmado, y el endpoint registra audit con
                        emergencyCrossFloorSelfClaim=true. */}
                    {isCrossFloor && selectedPicks.length > 0 && (
                        <label className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={crossFloorConfirmed}
                                onChange={(e) => setCrossFloorConfirmed(e.target.checked)}
                                disabled={submitting}
                                className="mt-0.5 w-4 h-4 accent-amber-600 cursor-pointer"
                            />
                            <div className="flex-1">
                                <p className="font-black text-amber-900 text-sm leading-tight">
                                    Confirmo cobertura cross-piso (break-glass)
                                </p>
                                <p className="text-amber-800 text-xs font-medium mt-0.5 leading-relaxed">
                                    Estás cubriendo {floorLabel(selectedFloor!)} desde {floorLabel(invokerFloor)}. Esto se registra como emergencia y se notifica al supervisor — STOPGAP, no resolución.
                                </p>
                            </div>
                        </label>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 md:px-8 py-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <div className="flex-1 text-[11px] text-slate-500 font-semibold">
                        {selectedPicks.length > 0 && (
                            <>
                                <span className="text-slate-700">{selectedPicks.length}</span> seleccionado{selectedPicks.length === 1 ? '' : 's'}
                                {selectedFloor !== undefined && (
                                    <> · {floorLabel(selectedFloor)}</>
                                )}
                            </>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!canSubmit}
                        className={`px-6 py-3 rounded-xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${
                            canSubmit
                                ? isCrossFloor
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md active:scale-95'
                                    : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md active:scale-95'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        {submitting ? (
                            <><Loader2 size={16} className="animate-spin" /> Asignando...</>
                        ) : isCrossFloor ? (
                            <><AlertTriangle size={16} /> Confirmar break-glass ({selectedPicks.length})</>
                        ) : (
                            <><CheckCircle2 size={16} /> Confirmar cobertura ({selectedPicks.length})</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
