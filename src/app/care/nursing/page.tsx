"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
    AlertTriangle, Clock, CheckCircle2, AlertOctagon, Loader2, RefreshCw,
    Bandage, ShieldAlert, Activity, Bed, Heart, ArrowLeft,
} from "lucide-react";

/**
 * /care/nursing — Dashboard agregado de rotación postural / UPP para enfermería.
 *
 * Pacientes "enrolled" (requiresPosturalChanges OR nortonRisk OR active ulcer)
 * con su tier de compliance computed desde timestamps:
 *   OVERDUE (>135 min)  → rojo, pulse
 *   DUE     (120–135)   → amber
 *   NEVER   (sin log)   → slate-rojo (alarma — paciente sin trazabilidad)
 *   OK      (≤120 min)  → emerald
 *
 * El endpoint /api/care/nursing/rotation enforza role gate
 * (NURSE/SUPERVISOR/DIRECTOR/ADMIN) — esta página confía en el endpoint
 * y muestra mensaje de acceso restringido si recibe 403.
 *
 * Ordenamiento: severity descendente (OVERDUE → DUE → NEVER → OK), después
 * por roomNumber asc dentro de cada tier — la enfermera ve primero lo que
 * arde.
 */

type Tier = 'OK' | 'DUE' | 'OVERDUE' | 'NEVER';

interface ActiveUlcer {
    id: string;
    bodyLocation: string;
    stage: number;
    status: string;
    identifiedAt: string;
}
interface PatientRow {
    patientId: string;
    name: string;
    roomNumber: string | null;
    status: string;
    requiresPosturalChanges: boolean;
    nortonRisk: boolean;
    enrolledBy: { flag: boolean; norton: boolean; ulcer: boolean };
    activeUlcers: ActiveUlcer[];
    lastRotation: {
        performedAt: string;
        position: string;
        nurseId: string | null;
        nurseName: string | null;
    } | null;
    minutesSince: number | null;
    tier: Tier;
}
interface ApiResponse {
    success: boolean;
    error?: string;
    generatedAt?: string;
    hqId?: string;
    thresholdsMin?: { target: number; breach: number };
    counts?: Record<Tier, number>;
    total?: number;
    patients?: PatientRow[];
}

const TIER_ORDER: Tier[] = ['OVERDUE', 'DUE', 'NEVER', 'OK'];

const TIER_META: Record<Tier, { label: string; icon: any; bg: string; border: string; text: string; ring: string; chipBg: string; chipText: string }> = {
    OVERDUE: { label: 'Vencido',       icon: AlertOctagon, bg: 'bg-red-50',     border: 'border-red-300',     text: 'text-red-800',     ring: 'ring-red-400',     chipBg: 'bg-red-600',     chipText: 'text-white' },
    DUE:     { label: 'En ventana',    icon: Clock,        bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-800',   ring: 'ring-amber-400',   chipBg: 'bg-amber-500',   chipText: 'text-white' },
    NEVER:   { label: 'Sin registro',  icon: AlertTriangle,bg: 'bg-rose-50',    border: 'border-rose-300',    text: 'text-rose-800',    ring: 'ring-rose-300',    chipBg: 'bg-rose-700',    chipText: 'text-white' },
    OK:      { label: 'A tiempo',      icon: CheckCircle2, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', ring: 'ring-emerald-300', chipBg: 'bg-emerald-600', chipText: 'text-white' },
};

function fmtRelative(minutesSince: number | null): string {
    if (minutesSince === null) return '—';
    if (minutesSince < 60) return `hace ${minutesSince} min`;
    const h = Math.floor(minutesSince / 60);
    const m = minutesSince % 60;
    return `hace ${h}h ${m > 0 ? `${m}min` : ''}`.trim();
}
function fmtTime(iso: string | undefined | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
}

export default function NursingRotationPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastFetched, setLastFetched] = useState<Date | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/care/nursing/rotation', { cache: 'no-store' });
            const json: ApiResponse = await res.json();
            if (res.status === 403) {
                setError('Acceso restringido — solo enfermería/supervisión.');
                setData(null);
            } else if (!json.success) {
                setError(json.error || 'Error cargando dashboard');
            } else {
                setData(json);
                setError(null);
                setLastFetched(new Date());
            }
        } catch (e: any) {
            setError(e.message || 'Error de red');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { router.push('/login'); return; }
        fetchData();
        const id = setInterval(() => { setRefreshing(true); fetchData(); }, 60_000);
        return () => clearInterval(id);
    }, [authLoading, user, router, fetchData]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="max-w-2xl mx-auto mt-12 bg-white border border-rose-200 rounded-2xl p-6 shadow-sm">
                    <ShieldAlert className="w-10 h-10 text-rose-500 mb-3" />
                    <h1 className="text-xl font-black text-slate-800 mb-2">No se puede cargar el dashboard</h1>
                    <p className="text-sm text-slate-600 font-medium">{error}</p>
                    <button onClick={() => { setLoading(true); fetchData(); }} className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" /> Reintentar
                    </button>
                </div>
            </div>
        );
    }

    const counts = data?.counts ?? { OK: 0, DUE: 0, OVERDUE: 0, NEVER: 0 };
    const patients = data?.patients ?? [];
    const total = data?.total ?? 0;

    // Ordenar: severity desc → roomNumber asc
    const sorted = [...patients].sort((a, b) => {
        const ta = TIER_ORDER.indexOf(a.tier);
        const tb = TIER_ORDER.indexOf(b.tier);
        if (ta !== tb) return ta - tb;
        const ra = a.roomNumber ?? 'zz';
        const rb = b.roomNumber ?? 'zz';
        return ra.localeCompare(rb);
    });

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                                    <Bed className="w-6 h-6 text-teal-600" /> Rotación Postural
                                </h1>
                                <p className="text-xs text-slate-500 font-semibold">
                                    {total} residente{total === 1 ? '' : 's'} bajo protocolo · umbral {data?.thresholdsMin?.target}/{data?.thresholdsMin?.breach} min
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-400 font-medium">
                                {lastFetched ? `Actualizado ${fmtTime(lastFetched.toISOString())}` : ''}
                            </span>
                            <button
                                onClick={() => { setRefreshing(true); fetchData(); }}
                                disabled={refreshing}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                                Actualizar
                            </button>
                        </div>
                    </div>

                    {/* Chips de counts por tier */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {TIER_ORDER.map((t) => {
                            const meta = TIER_META[t];
                            const Icon = meta.icon;
                            const n = counts[t] ?? 0;
                            return (
                                <div key={t} className={`rounded-xl border ${meta.border} ${meta.bg} p-3 flex items-center gap-3`}>
                                    <div className={`w-9 h-9 rounded-lg ${meta.chipBg} ${meta.chipText} flex items-center justify-center`}>
                                        <Icon className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-2xl font-black ${meta.text} leading-none`}>{n}</p>
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${meta.text} opacity-80 mt-1`}>{meta.label}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Patient list */}
            <div className="max-w-6xl mx-auto px-6 py-6">
                {sorted.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                        <Heart className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                        <p className="font-bold text-slate-700">Sin residentes bajo protocolo</p>
                        <p className="text-xs text-slate-500 mt-1">
                            Ningún paciente activo está marcado como encamado, en escala Norton positiva, ni tiene UPP activa.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {sorted.map((p) => {
                            const meta = TIER_META[p.tier];
                            const Icon = meta.icon;
                            const pulse = p.tier === 'OVERDUE';
                            return (
                                <div key={p.patientId} className={`bg-white rounded-2xl border-2 ${meta.border} p-4 flex flex-col md:flex-row md:items-center gap-3 ${pulse ? 'shadow-md' : 'shadow-sm'}`}>
                                    {/* Left: tier badge + name + room */}
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={`w-12 h-12 rounded-xl ${meta.chipBg} ${meta.chipText} flex items-center justify-center shrink-0 ${pulse ? 'animate-pulse' : ''}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-black text-slate-900 truncate">{p.name}</p>
                                                {p.roomNumber && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                                        Cuarto {p.roomNumber}
                                                    </span>
                                                )}
                                                <span className={`text-[10px] font-black uppercase tracking-wider ${meta.chipBg} ${meta.chipText} px-2 py-0.5 rounded-full`}>
                                                    {meta.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-1 flex-wrap">
                                                {p.lastRotation ? (
                                                    <>
                                                        <Clock className="w-3 h-3" />
                                                        <span>Última: <span className="text-slate-700">{p.lastRotation.position}</span> · {fmtRelative(p.minutesSince)}</span>
                                                        {p.lastRotation.nurseName && (
                                                            <span className="text-slate-400">por {p.lastRotation.nurseName}</span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="font-bold text-rose-600">Sin rotación registrada</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: enrollment badges + ulcers */}
                                    <div className="flex items-center gap-2 flex-wrap md:flex-nowrap shrink-0">
                                        {p.enrolledBy.flag && (
                                            <span title="Marcado encamado por el clínico" className="text-[10px] font-bold uppercase tracking-wider text-orange-800 bg-orange-100 border border-orange-200 px-2 py-1 rounded-full inline-flex items-center gap-1">
                                                <Bed className="w-3 h-3" /> Encamado
                                            </span>
                                        )}
                                        {p.enrolledBy.norton && (
                                            <span title="Escala Norton positiva (riesgo de úlceras)" className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-full inline-flex items-center gap-1">
                                                <Activity className="w-3 h-3" /> Norton
                                            </span>
                                        )}
                                        {p.enrolledBy.ulcer && p.activeUlcers[0] && (
                                            <span title={`${p.activeUlcers.length} úlcera${p.activeUlcers.length === 1 ? '' : 's'} activa${p.activeUlcers.length === 1 ? '' : 's'}`} className="text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-50 border border-rose-200 px-2 py-1 rounded-full inline-flex items-center gap-1">
                                                <Bandage className="w-3 h-3" />
                                                UPP {p.activeUlcers[0].bodyLocation} E{p.activeUlcers[0].stage}
                                                {p.activeUlcers.length > 1 && <span>+{p.activeUlcers.length - 1}</span>}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
