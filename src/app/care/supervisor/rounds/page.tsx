"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import InfoTooltip from "@/components/ui/InfoTooltip";

/**
 * Sprint K — Página dedicada de Rondas de Inspección.
 * Reubicada desde el dashboard del supervisor. El dashboard ahora solo muestra
 * el resumen X/3 rondas completadas + link a esta página.
 */

const FLOORS = [
    { floor: 1, zones: ['Habitaciones 1-10', 'Baños P1', 'Comedor', 'Recepción', 'Pasillo Principal'] },
    { floor: 2, zones: ['Habitaciones 11-20', 'Baños P2', 'Sala de Estar P2', 'Pasillo P2'] },
];
const ROUND_TYPES = [
    { id: 'INICIO', label: 'Ronda 1 — Inicio de Turno', time: '9:00 AM' },
    { id: 'MEDIO', label: 'Ronda 2 — Medio Turno', time: '12:30 PM' },
    { id: 'CIERRE', label: 'Ronda 3 — Cierre', time: '5:30 PM' },
];

type ZoneCheck = { limpieza: boolean; seguridad: boolean; residentes: boolean; equipo: boolean; observations: string };

export default function InspectionRoundsPage() {
    const { user } = useAuth();
    const [selectedRound, setSelectedRound] = useState('INICIO');
    const [selectedFloor, setSelectedFloor] = useState(1);
    const [zoneChecks, setZoneChecks] = useState<Record<string, ZoneCheck>>({});
    const [isSavingRound, setIsSavingRound] = useState(false);
    const [todayInspections, setTodayInspections] = useState<any[]>([]);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    const initZoneChecks = () => {
        const checks: Record<string, ZoneCheck> = {};
        FLOORS.forEach(f => f.zones.forEach(z => {
            checks[`${f.floor}-${z}`] = { limpieza: false, seguridad: false, residentes: false, equipo: false, observations: '' };
        }));
        return checks;
    };

    useEffect(() => { setZoneChecks(initZoneChecks()); }, []);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 3500);
            return () => clearTimeout(t);
        }
    }, [toast]);

    const fetchTodayInspections = async () => {
        if (!user) return;
        try {
            const hqId = (user as any).hqId || (user as any).headquartersId || '';
            const res = await fetch(`/api/care/zone-inspection?hqId=${hqId}`);
            const data = await res.json();
            if (data.success) setTodayInspections(data.inspections || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { if (user) fetchTodayInspections(); }, [user]);

    const handleSaveRound = async () => {
        if (!user) return;
        setIsSavingRound(true);
        const hqId = (user as any).hqId || (user as any).headquartersId || '';
        const currentFloorZones = FLOORS.find(f => f.floor === selectedFloor)?.zones || [];
        let savedCount = 0;
        try {
            for (const zoneName of currentFloorZones) {
                const key = `${selectedFloor}-${zoneName}`;
                const check = zoneChecks[key];
                if (!check) continue;
                const res = await fetch('/api/care/zone-inspection', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        headquartersId: hqId,
                        supervisorId: user.id,
                        roundType: selectedRound,
                        floor: selectedFloor,
                        zoneName,
                        checklistData: { limpieza: check.limpieza, seguridad: check.seguridad, residentes: check.residentes, equipo: check.equipo },
                        observations: check.observations || null,
                    }),
                });
                const data = await res.json();
                if (data.success) savedCount++;
            }
            if (savedCount > 0) {
                setToast({ msg: `Ronda ${selectedRound} Piso ${selectedFloor}: ${savedCount} zonas registradas ✓`, type: 'ok' });
                setZoneChecks(initZoneChecks());
                fetchTodayInspections();
            } else {
                setToast({ msg: 'Error guardando ronda.', type: 'err' });
            }
        } catch (error) {
            console.error(error);
            setToast({ msg: 'Error de conexión.', type: 'err' });
        } finally {
            setIsSavingRound(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 p-6 md:p-8 font-sans">
            <div className="w-full max-w-[1400px] mx-auto flex flex-col gap-6 pb-16">
                <Link href="/care/supervisor" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold text-sm w-max">
                    <ArrowLeft className="w-4 h-4" /> Volver a Mission Control
                </Link>

                <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black text-white flex items-center gap-3 mb-2">
                            <CalendarClock className="w-8 h-8 text-teal-400" /> Rondas de Inspección
                            <InfoTooltip text="3 rondas por turno. Cada zona se evalúa con 4 criterios: Limpieza, Seguridad, Residentes y Equipo. Queda en el log de auditoría con firma electrónica." />
                        </h1>
                        <p className="text-slate-500 font-medium text-sm">
                            3 rondas por turno · Piso 1 y Piso 2 · Checklist de 4 criterios por zona
                        </p>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-sm border border-slate-800">
                    {/* Selector de Ronda */}
                    <div className="flex gap-2 mb-4">
                        {ROUND_TYPES.map(r => {
                            const completedCount = todayInspections.filter(i => i.roundType === r.id).length;
                            return (
                                <button key={r.id} onClick={() => setSelectedRound(r.id)}
                                    className={`flex-1 py-4 rounded-2xl text-xs uppercase tracking-widest font-black transition-all border relative ${selectedRound === r.id ? 'bg-teal-500 border-teal-500 text-slate-900' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                                    {r.label}
                                    <span className="block text-[10px] opacity-70 mt-0.5">{r.time}</span>
                                    {completedCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{completedCount}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Selector de Piso */}
                    <div className="flex gap-2 mb-6">
                        {FLOORS.map(f => (
                            <button key={f.floor} onClick={() => setSelectedFloor(f.floor)}
                                className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${selectedFloor === f.floor ? 'bg-white text-slate-900 border-white' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                                Piso {f.floor} ({f.zones.length} zonas)
                            </button>
                        ))}
                    </div>

                    {/* Checklist por Zona */}
                    <div className="space-y-3 mb-6">
                        {(FLOORS.find(f => f.floor === selectedFloor)?.zones || []).map(zoneName => {
                            const key = `${selectedFloor}-${zoneName}`;
                            const check = zoneChecks[key] || { limpieza: false, seguridad: false, residentes: false, equipo: false, observations: '' };
                            const checkCount = [check.limpieza, check.seguridad, check.residentes, check.equipo].filter(Boolean).length;
                            const alreadyDone = todayInspections.some(i => i.roundType === selectedRound && i.floor === selectedFloor && i.zoneName === zoneName);

                            return (
                                <div key={key} className={`p-4 rounded-2xl border transition-all ${alreadyDone ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-slate-800/50 border-slate-700/50'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-bold text-white flex items-center gap-2">
                                            {alreadyDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                            {zoneName}
                                        </span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${checkCount === 4 ? 'bg-emerald-500/20 text-emerald-400' : checkCount > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-500'}`}>
                                            {checkCount}/4
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 mb-3">
                                        {(['limpieza', 'seguridad', 'residentes', 'equipo'] as const).map(field => (
                                            <button key={field}
                                                onClick={() => setZoneChecks(prev => ({ ...prev, [key]: { ...prev[key], [field]: !prev[key]?.[field] } }))}
                                                className={`py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-black transition-all border ${check[field] ? 'bg-teal-500 border-teal-500 text-slate-900' : 'bg-transparent border-slate-600 text-slate-500 hover:border-slate-400'}`}>
                                                {field.slice(0, 4).toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        value={check.observations}
                                        onChange={(e) => setZoneChecks(prev => ({ ...prev, [key]: { ...prev[key], observations: e.target.value } }))}
                                        placeholder="Observaciones (opcional)"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-teal-500"
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={handleSaveRound}
                        disabled={isSavingRound}
                        className="w-full bg-white hover:bg-slate-200 text-slate-900 font-black py-4 rounded-[2rem] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
                    >
                        {isSavingRound ? <Loader2 className="w-5 h-5 animate-spin" /> : `Firmar Ronda ${selectedRound} — Piso ${selectedFloor}`}
                    </button>
                </div>
            </div>

            {toast && (
                <div
                    className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-[2rem] shadow-xl font-bold text-sm cursor-pointer ${toast.type === 'ok' ? 'bg-teal-900 text-teal-100' : 'bg-rose-900 text-rose-100'}`}
                    onClick={() => setToast(null)}
                >
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
