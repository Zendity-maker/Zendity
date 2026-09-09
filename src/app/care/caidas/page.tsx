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
import { ArrowLeft, Loader2, Plus, ShieldAlert, CalendarClock } from "lucide-react";
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

const GRAVEDAD: Record<string, { texto: string; clase: string }> = {
    SEVERE: { texto: 'Grave',   clase: 'bg-rose-100 text-rose-800 border-rose-200' },
    MILD:   { texto: 'Leve',    clase: 'bg-amber-100 text-amber-800 border-amber-200' },
    NONE:   { texto: 'Sin daño', clase: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-PR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });

/** Se registró después de ocurrir. Más de una hora, para no marcar el papeleo normal. */
const seEscribioDespues = (i: Incidente) =>
    new Date(i.createdAt).getTime() - new Date(i.occurredAt).getTime() > 60 * 60 * 1000;

export default function CaidasPage() {
    const router = useRouter();
    const [incidentes, setIncidentes] = useState<Incidente[]>([]);
    const [residentes, setResidentes] = useState<{ id: string; name: string; roomNumber?: string | null }[]>([]);
    const [cargando, setCargando] = useState(true);
    const [abierto, setAbierto] = useState(false);

    const cargar = useCallback(async () => {
        try {
            // 90 días: menos que eso y el patrón —cada cuánto, a qué hora— no se ve.
            const [ri, rp] = await Promise.all([
                fetch('/api/care/incidents?hoursBack=2160'),
                fetch('/api/patients'),
            ]);
            const di = await ri.json();
            const dp = await rp.json();
            if (di.success) setIncidentes(di.incidents ?? []);
            // /api/patients devuelve el array pelado, no {success, data}.
            setResidentes(Array.isArray(dp) ? dp : []);
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
