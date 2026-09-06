"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { TIPOS_UPP, MOTIVOS_CAMBIO, MOTIVOS_CIERRE, puedeRegistrar, type TipoRegistroUpp } from "@/lib/upp";
import {
    AlertTriangle, Clock, CheckCircle2, AlertOctagon, Loader2, RefreshCw,
    Bandage, ShieldAlert, Activity, Bed, Heart, ArrowLeft, Building2, HelpCircle,
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
 *   FUERA   (en hospital) → gris, fuera del conteo: no se puede girar a quien
 *                           no esta en el edificio
 *
 * El endpoint /api/care/nursing/rotation enforza role gate
 * (NURSE/SUPERVISOR/DIRECTOR/ADMIN) — esta página confía en el endpoint
 * y muestra mensaje de acceso restringido si recibe 403.
 *
 * Ordenamiento: severity descendente (OVERDUE → DUE → NEVER → OK), después
 * por roomNumber asc dentro de cada tier — la enfermera ve primero lo que
 * arde.
 */

type Tier = 'OK' | 'DUE' | 'OVERDUE' | 'NEVER' | 'FUERA' | 'SIN_ORDEN';

interface ActiveUlcer {
    id: string;
    bodyLocation: string;
    stage: number;
    status: string;
    identifiedAt: string;
    /** El plan del home care. Se enseña EN el formulario, no en otra pantalla. */
    planTratamiento: string | null;
    planEstablecidoPor: string | null;
    /** Reloj 1: cuando se aplico el TRATAMIENTO del plan. */
    ultimaCuracionAt: string;
    ultimoTratamiento: string | null;
    diasSinCuracion: number;
    /** Reloj 2: cuando MIRO alguien con criterio clinico (curacion o valoracion). */
    ultimaValoracionAt: string;
    diasSinValoracion: number;
    /** Lo que hace el piso entre visitas de la enfermera. No mueve ningun reloj. */
    ultimoCambioAposito: { at: string; motivo: string | null } | null;
    cambiosEnUnDia: number;
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

const TIER_ORDER: Tier[] = ['OVERDUE', 'DUE', 'NEVER', 'OK', 'SIN_ORDEN', 'FUERA'];

const TIER_META: Record<Tier, { label: string; icon: any; bg: string; border: string; text: string; ring: string; chipBg: string; chipText: string }> = {
    OVERDUE: { label: 'Vencido',       icon: AlertOctagon, bg: 'bg-red-50',     border: 'border-red-300',     text: 'text-red-800',     ring: 'ring-red-400',     chipBg: 'bg-red-600',     chipText: 'text-white' },
    DUE:     { label: 'En ventana',    icon: Clock,        bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-800',   ring: 'ring-amber-400',   chipBg: 'bg-amber-500',   chipText: 'text-white' },
    NEVER:   { label: 'Sin registro',  icon: AlertTriangle,bg: 'bg-rose-50',    border: 'border-rose-300',    text: 'text-rose-800',    ring: 'ring-rose-300',    chipBg: 'bg-rose-700',    chipText: 'text-white' },
    OK:      { label: 'A tiempo',      icon: CheckCircle2, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', ring: 'ring-emerald-300', chipBg: 'bg-emerald-600', chipText: 'text-white' },
    // Gris a proposito: no es una tarea ni una falta, es que no esta aqui.
    // Indigo, no rojo ni gris: pide una decision de enfermeria, no una tarea.
    SIN_ORDEN: { label: 'Riesgo Norton — sin orden', icon: HelpCircle, bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', ring: 'ring-indigo-300', chipBg: 'bg-indigo-500', chipText: 'text-white' },
    FUERA:   { label: 'En hospital',   icon: Building2,    bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-600',   ring: 'ring-slate-300',   chipBg: 'bg-slate-500',   chipText: 'text-white' },
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
    // Se llega aqui desde el inbox del supervisor, que enlaza al residente
    // concreto cuya rotacion esta vencida. Sin esto el enlace abriria la lista
    // sin señalar a nadie — un parametro que la pantalla ignora es
    // exactamente el tipo de promesa vacia que venimos retirando.
    const paramsBusqueda = useSearchParams();
    const residenteDestacado = paramsBusqueda.get('patientId');
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [decidiendo, setDecidiendo] = useState<string | null>(null);

    /**
     * CURAR UNA ULCERA SIN SALIR DE AQUI.
     *
     * Esta pantalla enseñaba "UPP Sacral E4" como etiqueta y no daba ninguna
     * forma de actuar: sus unicos botones activaban o desactivaban la rotacion.
     * Para anotar una curacion habia que ir a /corporate/medical/patients/[id],
     * pestaña "upps" — que no esta enlazada desde ninguna pantalla de
     * enfermeria— y alli tampoco se podia, porque la API no tenia el endpoint.
     *
     * Resultado en Cupey: cuatro ulceras, una curacion cada una, la del dia en
     * que se abrieron. La mas grave lleva 77 dias asi.
     */
    const [curando, setCurando] = useState<{ ulcera: ActiveUlcer; residente: string } | null>(null);
    const [tratamiento, setTratamiento] = useState("");
    const [medida, setMedida] = useState("");
    const [notaCura, setNotaCura] = useState("");
    const [estadioNuevo, setEstadioNuevo] = useState<number | null>(null);
    /** '' = no cerrar · 'SANO' = sanó · 'SIN_RESOLVER' = dejó de seguirse. */
    const [cierre, setCierre] = useState<'' | 'SANO' | 'SIN_RESOLVER'>('');
    const [motivoCierre, setMotivoCierre] = useState('');
    const [guardandoCura, setGuardandoCura] = useState(false);
    const [errorCura, setErrorCura] = useState<string | null>(null);

    /**
     * QUÉ SE ESTÁ REGISTRANDO. Ver src/lib/upp.ts.
     *
     * Una cuidadora solo ve CAMBIO_APOSITO, y su formulario NO le pregunta qué
     * aplicó: ella limpia y tapa hasta que venga la enfermera. Preguntárselo la
     * obligaría a inventarse una respuesta.
     */
    const [tipoRegistro, setTipoRegistro] = useState<TipoRegistroUpp>('CURACION');
    const [motivo, setMotivo] = useState<string>('');

    // El plan del home care: enfermería y dirección lo escriben, la cuidadora
    // lo lee. Se edita aquí mismo porque es donde se echa en falta.
    const [editandoPlan, setEditandoPlan] = useState(false);
    const [planTexto, setPlanTexto] = useState('');
    const [planQuien, setPlanQuien] = useState('');
    const [guardandoPlan, setGuardandoPlan] = useState(false);

    const rolesDelUsuario = [user?.role ?? '', ...(user?.secondaryRoles ?? [])];
    const tiposDisponibles = (Object.keys(TIPOS_UPP) as TipoRegistroUpp[])
        .filter(t => puedeRegistrar(t, rolesDelUsuario));
    const def = TIPOS_UPP[tipoRegistro];

    const abrirCuracion = (ulcera: ActiveUlcer, residente: string) => {
        setCurando({ ulcera, residente });
        setTratamiento(""); setMedida(""); setNotaCura(""); setMotivo("");
        // El primero que su rol permita. Una cuidadora abre directamente en
        // "Cambié el apósito" sin tener que escoger nada.
        setTipoRegistro(tiposDisponibles[0] ?? 'CAMBIO_APOSITO');
        setEstadioNuevo(ulcera.stage); setCierre(''); setMotivoCierre(''); setErrorCura(null);
        setEditandoPlan(false);
        setPlanTexto(ulcera.planTratamiento ?? '');
        setPlanQuien(ulcera.planEstablecidoPor ?? '');
    };

    const guardarPlan = async () => {
        if (!curando) return;
        setGuardandoPlan(true);
        try {
            const res = await fetch(`/api/care/upp/${curando.ulcera.id}/plan`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planTratamiento: planTexto.trim(), planEstablecidoPor: planQuien.trim() }),
            });
            const d = await res.json();
            if (!d.success) { setErrorCura(d.error || 'No se pudo guardar el plan'); return; }
            // El modal sigue abierto con el plan ya escrito: quien lo acaba de
            // poner suele venir justo a registrar algo sobre esa úlcera.
            setCurando(c => c && { ...c, ulcera: { ...c.ulcera, planTratamiento: planTexto.trim() || null, planEstablecidoPor: planQuien.trim() || null } });
            setEditandoPlan(false);
            fetchData();
        } catch {
            setErrorCura('Error de red');
        } finally {
            setGuardandoPlan(false);
        }
    };

    const cerrando = cierre !== '';
    const listoParaGuardar = !!curando
        // Cerrar no exige inventarse una curación: es un acto en sí mismo.
        && (cerrando || !def.pideTratamiento || !!tratamiento.trim())
        && (cerrando || !def.pideMotivo || !!motivo)
        && !(!cerrando && motivo === 'OTRO' && !notaCura.trim())
        && !(cierre === 'SIN_RESOLVER' && !motivoCierre)
        && !(cierre === 'SIN_RESOLVER' && motivoCierre === 'OTRO' && !notaCura.trim());

    const guardarCuracion = async () => {
        if (!curando || !listoParaGuardar) return;
        setGuardandoCura(true);
        setErrorCura(null);
        try {
            const res = await fetch(`/api/care/upp/${curando.ulcera.id}/curacion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: tipoRegistro,
                    motivo: def.pideMotivo ? motivo : undefined,
                    treatmentApplied: def.pideTratamiento ? tratamiento.trim() : undefined,
                    woundSize: medida.trim(),
                    notes: notaCura.trim(),
                    stage: def.puedeCambiarEstadio ? estadioNuevo : undefined,
                    status: cierre === 'SANO' ? 'RESOLVED'
                        : cierre === 'SIN_RESOLVER' ? 'CERRADA_SIN_RESOLVER' : undefined,
                    motivoCierre: cierre === 'SIN_RESOLVER' ? motivoCierre : undefined,
                }),
            });
            const data = await res.json();
            if (!data.success) { setErrorCura(data.error || 'No se pudo registrar'); return; }
            setCurando(null);
            fetchData();
        } catch {
            setErrorCura('Error de red');
        } finally {
            setGuardandoCura(false);
        }
    };

    /**
     * Enfermería decide si un residente enrolado SOLO por Norton necesita
     * rotación de verdad, o no.
     *
     * Usa /api/corporate/patients/[id]/rotation-protocol, que existía con
     * auditoría y confirmación explícita desde hace meses y al que NO llamaba
     * ninguna pantalla. Por eso Teresa Rivera —silla de ruedas, se moviliza
     * sola— llevaba semanas apareciendo en cambios posturales sin que nadie
     * pudiera sacarla.
     *
     * "No hace falta" pone requiresPosturalChanges en false. El residente
     * SIGUE en la lista mientras tenga Norton positivo, pero como
     * "Riesgo Norton — sin orden": visible, sin contar como vencido y sin
     * generar penalidades. No se le quita el riesgo; se le quita la tarea que
     * nadie mandó.
     */
    const decidirRotacion = async (patientId: string, nombre: string, requiere: boolean) => {
        const msg = requiere
            ? `¿Confirmar que ${nombre.trim()} necesita rotación postural cada 2 horas?`
            : `¿Confirmar que ${nombre.trim()} NO necesita rotación programada? Seguirá visible por su riesgo Norton, pero dejará de contar como vencido.`;
        if (!confirm(msg)) return;
        setDecidiendo(patientId);
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/rotation-protocol`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requiresPosturalChanges: requiere, confirmed: true }),
            });
            const d = await res.json();
            if (!d.success) { alert(d.error || 'No se pudo guardar.'); return; }
            await fetchData();
        } catch {
            alert('Error de conexión.');
        } finally {
            setDecidiendo(null);
        }
    };
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastFetched, setLastFetched] = useState<Date | null>(null);
    // Señales clínicas: el cruce de vitales, eMAR, ingesta y piel que antes
    // nadie hacía. Se carga aparte de la rotación para no retrasar la pantalla
    // principal si el análisis tarda.
    const [senales, setSenales] = useState<any[] | null>(null);
    const [senalesAbiertas, setSenalesAbiertas] = useState(true);

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
        fetch('/api/care/nursing/senales', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => { if (d.success) setSenales(d.residentes); })
            .catch(() => { /* la rotación es lo principal; esto es adicional */ });
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

    const counts = data?.counts ?? { OK: 0, DUE: 0, OVERDUE: 0, NEVER: 0, FUERA: 0, SIN_ORDEN: 0 };
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
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
            <div className="max-w-6xl mx-auto px-6 pt-6">
                {senales !== null && senales.length > 0 && (
                    <section className="mb-6 bg-white border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
                        <button
                            onClick={() => setSenalesAbiertas(v => !v)}
                            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-amber-50/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <span className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                                    {senales.length}
                                </span>
                                <div>
                                    <p className="font-bold text-slate-800 leading-tight">
                                        {senales.length === 1 ? 'Un residente conviene mirarlo' : `${senales.length} residentes conviene mirarlos`}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Patrones de los últimos 7 días. No son diagnósticos.
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-slate-400">{senalesAbiertas ? 'Ocultar' : 'Ver'}</span>
                        </button>

                        {senalesAbiertas && (
                            <div className="border-t border-amber-100 divide-y divide-slate-100">
                                {senales.map((r: any) => (
                                    <div key={r.patientId} className="px-5 py-4">
                                        <p className="font-bold text-slate-800 text-sm mb-2">{r.nombre}</p>
                                        <ul className="space-y-2">
                                            {r.senales.map((sn: any, i: number) => (
                                                <li key={i} className="flex gap-2.5">
                                                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-none ${sn.gravedad === 'REVISAR' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                                                    <div>
                                                        <p className="text-sm text-slate-700 leading-snug">{sn.titulo}</p>
                                                        {/* La evidencia va siempre: sin ella no se puede verificar. */}
                                                        {sn.evidencia.map((e: string, j: number) => (
                                                            <p key={j} className="text-xs text-slate-500 mt-0.5">{e}</p>
                                                        ))}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

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
                                <div
                                    key={p.patientId}
                                    ref={p.patientId === residenteDestacado
                                        ? (el) => { el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                                        : undefined}
                                    className={`bg-white rounded-2xl border-2 ${meta.border} p-4 flex flex-col md:flex-row md:items-center gap-3 ${pulse ? 'shadow-md' : 'shadow-sm'} ${p.patientId === residenteDestacado ? 'ring-2 ring-teal-500 ring-offset-2' : ''}`}
                                >
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
                                        {/* Una etiqueta por ulcera, y cada una ABRE la curacion.
                                            Antes era una sola etiqueta muerta que ademas escondia
                                            las demas detras de un "+1". Los dias sin curacion van
                                            en la etiqueta porque son el dato que decide si hay algo
                                            que hacer hoy; a partir de 7 se pinta en ambar. */}
                                        {p.activeUlcers.map(u => (
                                            <button
                                                key={u.id}
                                                onClick={() => abrirCuracion(u, p.name)}
                                                title={`Última curación hace ${u.diasSinCuracion} día(s). Toca para registrar una.`}
                                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full inline-flex items-center gap-1 border transition-colors ${
                                                    u.diasSinCuracion >= 7
                                                        ? 'text-amber-900 bg-amber-50 border-amber-300 hover:bg-amber-100'
                                                        : 'text-rose-800 bg-rose-50 border-rose-200 hover:bg-rose-100'
                                                }`}
                                            >
                                                <Bandage className="w-3 h-3" />
                                                UPP {u.bodyLocation} E{u.stage}
                                                <span className="opacity-60">· {u.diasSinCuracion}d</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Salida del estado "Riesgo Norton — sin orden".
                                        Sin esto el tier era un callejon: Norton
                                        metia al residente en la lista y el toggle
                                        de rotation-protocol no lo llamaba ninguna
                                        pantalla, asi que no habia forma de decidir. */}
                                    {p.tier === 'SIN_ORDEN' && (
                                        <div className="w-full md:w-auto md:border-l md:pl-3 border-indigo-100 flex flex-col gap-1.5 shrink-0">
                                            <p className="text-[10px] font-bold text-indigo-700 leading-snug md:max-w-[15rem]">
                                                Norton dice que hay riesgo. ¿Necesita rotación cada 2 h?
                                            </p>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => decidirRotacion(p.patientId, p.name, true)}
                                                    disabled={decidiendo === p.patientId}
                                                    className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors"
                                                >
                                                    Sí, rotarlo
                                                </button>
                                                <button
                                                    onClick={() => decidirRotacion(p.patientId, p.name, false)}
                                                    disabled={decidiendo === p.patientId}
                                                    className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 transition-colors"
                                                >
                                                    No hace falta
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── CURACION ──────────────────────────────────────────────────
                Lo minimo que hace falta para que quede constancia: que se
                aplico. Todo lo demas es opcional a proposito — obligar a medir
                una lesion que no se midio produciria una medida inventada. */}
            {curando && (
                <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm">
                    <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
                        <div className="p-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-black text-slate-900 text-lg leading-tight">{curando.residente}</p>
                                    <p className="text-sm text-slate-500 font-medium">
                                        {curando.ulcera.bodyLocation} · estadio {curando.ulcera.stage}
                                    </p>
                                </div>
                                <button onClick={() => setCurando(null)} className="text-slate-400 hover:text-slate-600 shrink-0 text-2xl leading-none px-2">×</button>
                            </div>
                            {/* Los DOS relojes, separados. "Sin curar" y "sin
                                mirar" se resuelven distinto: lo primero espera a
                                la enfermera de servicios externos, lo segundo lo
                                puede hacer Celia hoy. */}
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
                                <span className={curando.ulcera.diasSinCuracion >= 7 ? 'text-rose-700' : 'text-slate-400'}>
                                    Curada hace {curando.ulcera.diasSinCuracion}d
                                    {curando.ulcera.ultimoTratamiento && ` — ${curando.ulcera.ultimoTratamiento}`}
                                </span>
                                <span className={curando.ulcera.diasSinValoracion >= 7 ? 'text-amber-700' : 'text-slate-400'}>
                                    Vista hace {curando.ulcera.diasSinValoracion}d
                                </span>
                                {curando.ulcera.cambiosEnUnDia > 0 && (
                                    <span className="text-slate-500">
                                        {curando.ulcera.cambiosEnUnDia} cambio{curando.ulcera.cambiosEnUnDia === 1 ? '' : 's'} de apósito en 24h
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="p-5 space-y-4">

                            {/* QUÉ SE ESTÁ REGISTRANDO. Una cuidadora ve un solo
                                tipo y no tiene que escoger nada; enfermería y
                                dirección ven los tres. */}
                            {tiposDisponibles.length > 1 && (
                                <div className="grid grid-cols-3 gap-1.5">
                                    {tiposDisponibles.map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setTipoRegistro(t)}
                                            className={`py-2.5 px-2 rounded-xl text-xs font-black border-2 leading-tight transition-colors ${
                                                tipoRegistro === t
                                                    ? 'bg-slate-900 text-white border-slate-900'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                            }`}
                                        >{TIPOS_UPP[t].etiqueta}</button>
                                    ))}
                                </div>
                            )}

                            {/* La frase que marca la raya. Va SIEMPRE, no detrás
                                de un icono de ayuda: es la única capacitación que
                                alguien va a leer a las 3 de la mañana. */}
                            <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                                {def.queEs}
                            </p>

                            {/* EL PLAN DEL HOME CARE. Pedirle a alguien que actúe
                                y guardar la instrucción en otra pantalla es
                                pedirle que actúe de memoria. */}
                            {editandoPlan ? (
                                <div className="rounded-xl border-2 border-teal-300 bg-teal-50 p-3 space-y-2">
                                    <p className="text-[10px] font-black text-teal-800 uppercase tracking-wider">Plan del home care</p>
                                    <textarea
                                        value={planTexto}
                                        onChange={e => setPlanTexto(e.target.value)}
                                        rows={3}
                                        maxLength={4000}
                                        placeholder="Qué mandó el home care: producto, frecuencia, cuidados…"
                                        className="w-full p-2.5 border-2 border-teal-200 rounded-lg text-sm outline-none focus:border-teal-500 bg-white"
                                    />
                                    <input
                                        type="text"
                                        value={planQuien}
                                        onChange={e => setPlanQuien(e.target.value)}
                                        maxLength={120}
                                        placeholder="Quién lo estableció — ej. Metro Pavia Home Care"
                                        className="w-full p-2.5 border-2 border-teal-200 rounded-lg text-sm outline-none focus:border-teal-500 bg-white"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={guardarPlan} disabled={guardandoPlan}
                                            className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white text-sm font-black rounded-lg transition-colors">
                                            {guardandoPlan ? 'Guardando…' : 'Guardar plan'}
                                        </button>
                                        <button onClick={() => setEditandoPlan(false)}
                                            className="px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-600 text-sm font-bold rounded-lg">
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            ) : curando.ulcera.planTratamiento ? (
                                <div className="rounded-xl border-2 border-teal-200 bg-teal-50 px-3 py-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-[10px] font-black text-teal-800 uppercase tracking-wider mb-1">
                                            Plan del home care{curando.ulcera.planEstablecidoPor ? ` · ${curando.ulcera.planEstablecidoPor}` : ''}
                                        </p>
                                        {def.puedeCambiarEstadio && (
                                            <button onClick={() => setEditandoPlan(true)} className="text-[10px] font-black text-teal-700 underline shrink-0">Cambiar</button>
                                        )}
                                    </div>
                                    <p className="text-sm text-teal-900 font-medium leading-snug whitespace-pre-line">
                                        {curando.ulcera.planTratamiento}
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2.5">
                                    <p className="text-sm text-amber-900 font-bold leading-snug">
                                        Esta úlcera no tiene el plan del home care escrito.
                                        <span className="block text-xs font-medium text-amber-800/80 mt-0.5">
                                            Sin él, quien cambie el apósito no sabe qué manda el tratamiento.
                                        </span>
                                    </p>
                                    {/* Solo quien puede escribirlo ve el botón. A una
                                        cuidadora no se le pide que rellene un plan
                                        que no es suyo — se le dice que falta. */}
                                    {def.puedeCambiarEstadio && (
                                        <button onClick={() => setEditandoPlan(true)}
                                            className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg transition-colors">
                                            Escribir el plan
                                        </button>
                                    )}
                                </div>
                            )}

                            {def.pideMotivo && (
                                <div>
                                    <label className="text-xs font-black text-slate-600 uppercase tracking-wide block mb-1.5">
                                        ¿Por qué hubo que cambiarlo?
                                    </label>
                                    <div className="space-y-1.5">
                                        {MOTIVOS_CAMBIO.map(m => (
                                            <button
                                                key={m.codigo}
                                                onClick={() => setMotivo(m.codigo)}
                                                className={`w-full text-left px-3 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                                                    motivo === m.codigo
                                                        ? 'bg-rose-600 text-white border-rose-700'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
                                                }`}
                                            >{m.etiqueta}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {def.pideTratamiento && (
                                <div>
                                    <label className="text-xs font-black text-slate-600 uppercase tracking-wide block mb-1.5">
                                        ¿Qué se aplicó?
                                    </label>
                                    <input
                                        type="text"
                                        value={tratamiento}
                                        onChange={e => setTratamiento(e.target.value)}
                                        maxLength={500}
                                        placeholder="Ej. limpieza con salina + apósito hidrocoloide"
                                        className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-rose-400"
                                    />
                                </div>
                            )}

                            <div className={def.puedeCambiarEstadio ? "grid grid-cols-2 gap-3" : ""}>
                                <div>
                                    <label className="text-xs font-black text-slate-600 uppercase tracking-wide block mb-1.5">
                                        Medida <span className="font-medium normal-case text-slate-400">(opcional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={medida}
                                        onChange={e => setMedida(e.target.value)}
                                        maxLength={60}
                                        placeholder="2x3 cm"
                                        className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-rose-400"
                                    />
                                </div>
                                {/* Cambiar el estadio es clasificar, y eso es de
                                    enfermeria o direccion. Una cuidadora que
                                    limpia y tapa no reclasifica una herida. */}
                                {def.puedeCambiarEstadio && (
                                <div>
                                    <label className="text-xs font-black text-slate-600 uppercase tracking-wide block mb-1.5">Estadio</label>
                                    <div className="grid grid-cols-4 gap-1">
                                        {[1, 2, 3, 4].map(e => (
                                            <button
                                                key={e}
                                                onClick={() => setEstadioNuevo(e)}
                                                className={`py-3 rounded-xl text-sm font-black border-2 transition-colors ${
                                                    estadioNuevo === e
                                                        ? 'bg-rose-600 text-white border-rose-700'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'
                                                }`}
                                            >{e}</button>
                                        ))}
                                    </div>
                                </div>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-black text-slate-600 uppercase tracking-wide block mb-1.5">
                                    Cómo la viste{' '}
                                    <span className="font-medium normal-case text-slate-400">
                                        {motivo === 'OTRO' ? '(escribe qué pasó)' : '(opcional)'}
                                    </span>
                                </label>
                                <textarea
                                    value={notaCura}
                                    onChange={e => setNotaCura(e.target.value)}
                                    rows={3}
                                    maxLength={2000}
                                    placeholder="Bordes, exudado, olor, dolor al curar…"
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-rose-400"
                                />
                            </div>

                            {/* Cerrar una ulcera tenia que ser posible: dos de las cuatro
                                de Cupey son de un residente que fallecio hace 84 dias y
                                seguian abiertas porque nada podia cerrarlas. */}
                            {/* CERRAR UNA ÚLCERA: DOS COSAS DISTINTAS.
                                Antes solo se podía "dar por resuelta", así que
                                cerrar la úlcera de alguien que falleció obligaba
                                a escribir en el expediente que la herida sanó.
                                Wilfredo Matos murió y las suyas llevaban 85 días
                                abiertas porque nadie quiso escribir esa mentira. */}
                            {def.puedeCambiarEstadio && (
                            <div className="space-y-2 pt-1">
                                <p className="text-xs font-black text-slate-600 uppercase tracking-wide">Cerrar esta úlcera</p>
                                <button
                                    onClick={() => setCierre(cierre === 'SANO' ? '' : 'SANO')}
                                    className={`w-full text-left px-3 py-3 rounded-xl border-2 transition-colors ${
                                        cierre === 'SANO' ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:border-emerald-400'
                                    }`}
                                >
                                    <span className="text-sm font-bold block">Sanó</span>
                                    <span className={`text-xs font-medium block mt-0.5 ${cierre === 'SANO' ? 'text-emerald-100' : 'text-emerald-700/80'}`}>
                                        La herida cerró. Deja de contar como activa.
                                    </span>
                                </button>
                                <button
                                    onClick={() => setCierre(cierre === 'SIN_RESOLVER' ? '' : 'SIN_RESOLVER')}
                                    className={`w-full text-left px-3 py-3 rounded-xl border-2 transition-colors ${
                                        cierre === 'SIN_RESOLVER' ? 'bg-slate-800 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-400'
                                    }`}
                                >
                                    <span className="text-sm font-bold block">Se cerró sin sanar</span>
                                    <span className={`text-xs font-medium block mt-0.5 ${cierre === 'SIN_RESOLVER' ? 'text-slate-300' : 'text-slate-500'}`}>
                                        El residente falleció, salió del hogar o pasó al hospital.
                                    </span>
                                </button>

                                {cierre === 'SIN_RESOLVER' && (
                                    <div className="space-y-1.5 pl-1">
                                        {MOTIVOS_CIERRE.map(m => (
                                            <button
                                                key={m.codigo}
                                                onClick={() => setMotivoCierre(m.codigo)}
                                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold border-2 transition-colors ${
                                                    motivoCierre === m.codigo
                                                        ? 'bg-slate-700 text-white border-slate-800'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                                                }`}
                                            >{m.etiqueta}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            )}

                            {errorCura && <p className="text-rose-600 text-sm font-bold">{errorCura}</p>}

                            <button
                                onClick={guardarCuracion}
                                disabled={guardandoCura || !listoParaGuardar}
                                className="w-full min-h-[52px] bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl transition-colors"
                            >
                                {guardandoCura ? 'Guardando…'
                                    : cierre === 'SANO' ? 'Cerrar: sanó'
                                    : cierre === 'SIN_RESOLVER' ? 'Cerrar sin resolver'
                                    : `Registrar: ${def.etiqueta.toLowerCase()}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
