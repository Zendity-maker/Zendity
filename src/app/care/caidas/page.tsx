"use client";

/**
 * CAÍDAS E INCIDENTES CLÍNICOS — el cuarto, no la puerta.
 *
 * POR QUÉ EXISTE. Hasta hoy la caída se podía reportar desde la tableta (la
 * cuidadora, en el momento) y desde /corporate/incidents. Enfermería no tenía
 * por dónde: la pantalla de enfermería es "Piel, úlceras y rotación", y una
 * caída no es piel.
 *
 * Lo medido el 09-sep-2026 contra producción:
 *   - 8 caídas: 7 desde la tableta, 1 desde el traslado al hospital.
 *   - 0 desde /corporate/incidents en cuatro meses.
 *   - 0 errores de medicación registrados, en total.
 *   - /corporate/medical/fall-risk existe y está comentado fuera del menú:
 *     nadie puede llegar.
 *
 * Ese cero no dice que no haga falta. Dice que estaba en el sitio equivocado.
 * Un error de medicación lo levanta enfermería, no dirección.
 *
 * LA TABLETA NO SE TOCA. 7 de 8 caídas entraron por ahí y ese es el camino
 * bueno: quien la presencia la reporta en el momento. Esta pantalla es para lo
 * que se escribe después — y por eso lo primero que pregunta el formulario es
 * cuándo ocurrió.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, ShieldAlert, CalendarClock, ChevronDown } from "lucide-react";
import RegistrarIncidente from "@/components/care/RegistrarIncidente";

interface Incidente {
    id: string;
    type: string;
    severity: string;
    patientName: string;
    roomNumber: string | null;
    description: string | null;
    location: string | null;
    occurredAt: string;
    createdAt: string;
}

interface EnRiesgo {
    id: string;
    nombre: string;
    habitacion: string | null;
    nivel: 'HIGH' | 'MODERATE' | 'LOW' | null;   // null = nadie lo ha evaluado
    evaluadoEl: string | null;
    caidas90d: number;
    ultimaCaida: string | null;
}

/**
 * SIN EVALUAR va primero y es su propia categoría.
 *
 * Un residente al que nadie ha evaluado no es de riesgo bajo: es un residente
 * del que no se sabe. Meterlo en "bajo" da un número que tranquiliza sin
 * sostener nada.
 */
const NIVELES: { clave: EnRiesgo['nivel']; texto: string; chip: string; punto: string }[] = [
    { clave: null,       texto: 'Sin evaluar', chip: 'bg-slate-100 text-slate-700 border-slate-300', punto: 'bg-slate-400' },
    { clave: 'HIGH',     texto: 'Alto',        chip: 'bg-rose-100 text-rose-800 border-rose-300',    punto: 'bg-rose-500' },
    { clave: 'MODERATE', texto: 'Moderado',    chip: 'bg-amber-100 text-amber-800 border-amber-300', punto: 'bg-amber-500' },
    { clave: 'LOW',      texto: 'Bajo',        chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', punto: 'bg-emerald-500' },
];

/** Una evaluación de hace más de 90 días ya no describe a nadie. */
const VENCE_A_LOS_DIAS = 90;

const GRAVEDAD: Record<string, { texto: string; clase: string }> = {
    SEVERE: { texto: 'Grave',   clase: 'bg-rose-100 text-rose-800 border-rose-200' },
    MILD:   { texto: 'Leve',    clase: 'bg-amber-100 text-amber-800 border-amber-200' },
    NONE:   { texto: 'Sin daño', clase: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-PR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });

const diasDesde = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

/** Se registró después de ocurrir. Más de una hora, para no marcar el papeleo normal. */
const seEscribioDespues = (i: Incidente) =>
    new Date(i.createdAt).getTime() - new Date(i.occurredAt).getTime() > 60 * 60 * 1000;

export default function CaidasPage() {
    const router = useRouter();
    const [incidentes, setIncidentes] = useState<Incidente[]>([]);
    const [residentes, setResidentes] = useState<{ id: string; name: string; roomNumber?: string | null }[]>([]);
    const [enRiesgo, setEnRiesgo] = useState<EnRiesgo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [abierto, setAbierto] = useState(false);
    // Por defecto solo se abren los dos grupos que piden trabajo.
    const [verTodos, setVerTodos] = useState(false);

    const cargar = useCallback(async () => {
        try {
            // 90 días: menos que eso y el patrón —cada cuánto, a qué hora— no se ve.
            const [ri, rp, rr] = await Promise.all([
                fetch('/api/care/incidents?hoursBack=2160'),
                fetch('/api/patients'),
                fetch('/api/care/fall-risk'),
            ]);
            const di = await ri.json();
            const dp = await rp.json();
            const dr = await rr.json();
            if (di.success) setIncidentes(di.incidents ?? []);
            // /api/patients devuelve el array pelado, no {success, data}.
            setResidentes(Array.isArray(dp) ? dp : []);
            if (dr.success) setEnRiesgo(dr.residentes ?? []);
        } catch { /* la pantalla se queda como está */ }
        finally { setCargando(false); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8">
            <div className="flex items-start justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()}
                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                            <ShieldAlert className="w-6 h-6 text-rose-600" /> Caídas
                        </h1>
                        <p className="text-slate-500 font-medium text-sm mt-0.5">
                            Últimos 90 días. La cuidadora las reporta desde la tableta; aquí se
                            registran las que se escriben después.
                        </p>
                    </div>
                </div>
                <button onClick={() => setAbierto(true)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-black rounded-xl transition-colors">
                    <Plus className="w-4 h-4" /> Registrar
                </button>
            </div>

            {/* RIESGO DE CAÍDA.
                Estaba en /corporate/medical/fall-risk, comentada fuera del menú:
                existía y nadie podía llegar. El sistema calcula el nivel solo
                (cada caída crea un FallRiskAssessment) y nadie lo miraba. */}
            {!cargando && enRiesgo.length > 0 && (
                <div className="mb-6 rounded-3xl border-2 border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="font-black text-slate-900">Riesgo de caída</p>
                        <button onClick={() => setVerTodos(v => !v)}
                            className="text-xs font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                            {verTodos ? 'Ver solo lo que pide trabajo' : 'Ver los 4 grupos'}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${verTodos ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-4">
                        {NIVELES.map(n => (
                            <div key={n.texto} className={`rounded-xl border px-3 py-2.5 ${n.chip}`}>
                                <div className="text-2xl font-black leading-none">
                                    {enRiesgo.filter(r => r.nivel === n.clave).length}
                                </div>
                                <div className="text-[11px] font-bold uppercase tracking-wide mt-1 opacity-80">{n.texto}</div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4">
                        {NIVELES
                            // Sin evaluar y Alto siempre; los otros dos solo si se piden.
                            .filter(n => verTodos || n.clave === null || n.clave === 'HIGH')
                            .map(n => {
                                const gente = enRiesgo.filter(r => r.nivel === n.clave);
                                if (gente.length === 0) return null;
                                return (
                                    <div key={n.texto}>
                                        <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${n.punto}`} />
                                            {n.texto} · {gente.length}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {gente.map(r => {
                                                const vencida = r.evaluadoEl && diasDesde(r.evaluadoEl) > VENCE_A_LOS_DIAS;
                                                return (
                                                    <span key={r.id}
                                                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border ${n.chip}`}>
                                                        {r.nombre}
                                                        {r.habitacion && <span className="opacity-60"> · {r.habitacion}</span>}
                                                        {r.caidas90d > 0 && (
                                                            <span className="opacity-80"> · {r.caidas90d} caída{r.caidas90d === 1 ? '' : 's'} en 90 días</span>
                                                        )}
                                                        {/* Una evaluación de hace medio año no describe
                                                            a nadie. Decirlo es más útil que el nivel. */}
                                                        {vencida && (
                                                            <span className="opacity-60"> · evaluado hace {diasDesde(r.evaluadoEl!)} días</span>
                                                        )}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {cargando ? (
                <div className="flex items-center gap-3 text-slate-400 py-16 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin" /> Cargando…
                </div>
            ) : incidentes.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center">
                    <p className="font-black text-slate-700">Sin caídas registradas en 90 días.</p>
                    <p className="text-slate-500 text-sm mt-1">
                        Si sabes de alguna que no está, regístrala con la fecha en que ocurrió.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {incidentes.map(i => {
                        const g = GRAVEDAD[i.severity] ?? GRAVEDAD.NONE;
                        return (
                            <div key={i.id} className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-black text-slate-900 leading-tight">
                                            {i.patientName}
                                            {i.roomNumber && <span className="text-slate-400 font-bold"> · Hab. {i.roomNumber}</span>}
                                        </p>
                                        <p className="text-sm text-slate-500 font-semibold mt-0.5">{fmt(i.occurredAt)}</p>
                                    </div>
                                    <span className={`shrink-0 text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border ${g.clase}`}>
                                        {g.texto}
                                    </span>
                                </div>

                                {i.location && (
                                    <p className="text-sm text-slate-600 font-medium mt-2">{i.location}</p>
                                )}
                                {i.description && (
                                    <p className="text-sm text-slate-600 mt-1 leading-snug">{i.description}</p>
                                )}

                                {/* Decir que se escribió después no es un reproche: es lo que
                                    permite leer el patrón sin creer que la caída pasó el día
                                    en que alguien tuvo tiempo de teclearla. */}
                                {seEscribioDespues(i) && (
                                    <p className="text-xs text-slate-400 font-semibold mt-2 flex items-center gap-1.5">
                                        <CalendarClock className="w-3.5 h-3.5" />
                                        Registrada el {fmt(i.createdAt)}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {abierto && (
                <RegistrarIncidente
                    residentes={residentes}
                    onCerrar={() => setAbierto(false)}
                    onGuardado={() => { setAbierto(false); setCargando(true); cargar(); }}
                />
            )}
        </div>
    );
}
