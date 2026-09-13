"use client";

/**
 * MI DESEMPEÑO — lo que el empleado ve de sí mismo.
 *
 * La pantalla enseña NÚMEROS CON SU REFERENCIA, nunca un número solo. "17
 * reportes" no dice nada; "0.14 por turno, la media de tu turno de noche es
 * 0.04" sí. Sin la referencia, cada quien inventa la suya.
 *
 * Y no hay nota, ni puntuación, ni semáforo. Ver src/lib/desempeno.ts.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, TrendingUp, FileWarning, CalendarRange } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Historia } from "@/lib/desempeno-historia";

interface Medida { etiqueta: string; valor: string; referencia?: string; detalle?: string }
interface Observacion { fecha: string; categoria: string; severidad: string }
interface Desempeno {
    nombre: string; rol: string; dias: number; esPiso: boolean; turno: string | null;
    medidas: Medida[]; observaciones: Observacion[]; sinDatos: string | null;
}

const SEVERIDAD: Record<string, string> = {
    OBSERVATION: 'Observación', WARNING: 'Amonestación',
    SUSPENSION: 'Suspensión', TERMINATION: 'Despido',
};
const CATEGORIA: Record<string, string> = {
    HYGIENE: 'Higiene', PUNCTUALITY: 'Puntualidad', BEHAVIOR: 'Conducta',
    PATIENT_CARE: 'Cuidado del residente', UNIFORM: 'Uniforme', OTHER: 'Otro',
};

const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric' });

export default function MiDesempenoPage() {
    const router = useRouter();
    const [d, setD] = useState<Desempeno | null>(null);
    const [cargando, setCargando] = useState(true);
    const [dias, setDias] = useState(30);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const res = await fetch(`/api/mi-desempeno?dias=${dias}`);
            const json = await res.json();
            if (json.success) setD(json.desempeno);
        } catch { /* la pantalla se queda como está */ }
        finally { setCargando(false); }
    }, [dias]);

    useEffect(() => { cargar(); }, [cargar]);

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-8">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => router.back()}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-teal-600" /> Mi desempeño
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-0.5">
                        {d?.turno ? `Últimos ${dias} días · trabajas sobre todo el turno de ${d.turno}` : `Últimos ${dias} días`}
                    </p>
                </div>
            </div>

            <div className="flex gap-2 mb-6">
                {[30, 60, 90].map(n => (
                    <button key={n} onClick={() => setDias(n)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${dias === n ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                        {n} días
                    </button>
                ))}
            </div>

            {cargando ? (
                <div className="flex items-center gap-3 text-slate-400 py-16 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin" /> Cargando…
                </div>
            ) : !d ? (
                <p className="text-slate-500">No se pudo cargar.</p>
            ) : (
                <div className="space-y-4">
                    {d.sinDatos && (
                        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
                            <p className="text-sm text-amber-900 font-semibold leading-relaxed">{d.sinDatos}</p>
                        </div>
                    )}

                    {d.medidas.map(m => (
                        <div key={m.etiqueta} className="rounded-2xl border-2 border-slate-200 bg-white p-5">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-wide">{m.etiqueta}</p>
                            <p className="text-3xl font-black text-slate-900 mt-1.5 leading-none">{m.valor}</p>
                            {/* La referencia es la mitad del dato. Un numero solo no se puede leer. */}
                            {m.referencia && (
                                <p className="text-sm font-bold text-teal-700 mt-2">{m.referencia}</p>
                            )}
                            {m.detalle && (
                                <p className="text-[13px] text-slate-500 mt-1.5 leading-snug">{m.detalle}</p>
                            )}
                        </div>
                    ))}

                    <HistoriaMensual />

                    {/* APARTE, siempre. No es un punto que se resta: es un proceso
                        con firma y con derecho a contestar. */}
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                            <FileWarning className="w-3.5 h-3.5" /> Observaciones de RRHH
                        </p>
                        {d.observaciones.length === 0 ? (
                            <p className="text-lg font-bold text-emerald-700 mt-2">Ninguna en {d.dias} días.</p>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {d.observaciones.map((o, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200">
                                        <span className="text-sm font-bold text-slate-700">
                                            {CATEGORIA[o.categoria] ?? o.categoria}
                                        </span>
                                        <span className="text-xs text-slate-500 font-semibold">
                                            {SEVERIDAD[o.severidad] ?? o.severidad} · {fecha(o.fecha)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-[13px] text-slate-500 mt-3 leading-snug">
                            Solo las que se aplicaron. Las que se descartaron no aparecen, porque
                            descartada significa que quedaste exonerada.
                        </p>
                    </div>

                    <p className="text-[13px] text-slate-400 leading-snug pt-2">
                        Estos números salen de lo que quedó registrado en Zéndity. No hay nota ni
                        puntuación: son cosas separadas, y cada una se mira aparte. Tu supervisora
                        y dirección ven exactamente lo mismo que tú.
                    </p>
                </div>
            )}
        </div>
    );
}

/**
 * TU HISTORIA, MES A MES.
 *
 * Una sola medida —turnos trabajados y cuántos cerraste con el relevo— porque
 * es la única que existe desde el primer día. Ver la cabecera de
 * src/lib/desempeno-historia.ts para las otras tres y por qué no están.
 *
 * Se dibujan los DOS conteos, no el porcentaje: un mes bajo casi siempre es
 * "viniste menos", no "lo hiciste peor", y una tasa borra esa diferencia.
 * Sin meta, sin semáforo y sin la línea de nadie más.
 */
function HistoriaMensual() {
    const [h, setH] = useState<Historia | null>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/mi-desempeno/historia');
                const json = await res.json();
                if (json.success) setH(json.historia);
            } catch { /* la sección simplemente no aparece */ }
            finally { setCargando(false); }
        })();
    }, []);

    if (cargando || !h) return null;

    const hayParciales = h.meses.some(m => m.parcial);
    const totalForzados = h.meses.reduce((a, m) => a + m.forzados, 0);
    const desde = h.desde
        ? new Date(h.desde).toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    return (
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5" /> Tu historia, mes a mes
            </p>
            {desde && (
                <p className="text-[13px] text-slate-500 mt-1.5">
                    Desde tu primer turno, el {desde}.
                </p>
            )}

            {h.aviso ? (
                <p className="text-sm text-slate-600 mt-3 leading-snug">{h.aviso}</p>
            ) : (
                <>
                    <div className="mt-4 -ml-2">
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={h.meses} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="etiqueta" axisLine={false} tickLine={false}
                                    tick={{ fill: '#64748b', fontWeight: 700, fontSize: 11 }} dy={6} />
                                <YAxis allowDecimals={false} axisLine={false} tickLine={false}
                                    tick={{ fill: '#94a3b8', fontWeight: 600, fontSize: 11 }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '0.85rem', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: 12 }}
                                    labelFormatter={(l: any) => {
                                        const m = h.meses.find(x => x.etiqueta === l);
                                        const nota = m?.parcial === 'mes-en-curso' ? ' — va corriendo'
                                            : m?.parcial === 'primer-mes' ? ' — tu primer mes' : '';
                                        const f = m?.forzados
                                            ? ` · ${m.forzados} lo cerró supervisión`
                                            : '';
                                        return `${l}${nota}${f}`;
                                    }}
                                />
                                {/* Dos categorías, no dos juicios. Nada de verde/rojo. */}
                                <Bar dataKey="turnos" name="Turnos que trabajaste" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="cerrados" name="Cerrados con el relevo" fill="#0F6E56" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1">
                        <span className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500">
                            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> Turnos que trabajaste
                        </span>
                        <span className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500">
                            <span className="w-2.5 h-2.5 rounded-sm bg-[#0F6E56]" /> Cerrados con el relevo
                        </span>
                    </div>

                    {/* Los dos extremos no son comparables con el resto y hay que
                        decirlo: mayo son diez días de registro y el mes en curso
                        va a medias. Sin esta línea, una serie de cinco puntos se
                        lee con una V que no existe. */}
                    {hayParciales && (
                        <p className="text-[13px] text-slate-500 mt-3 leading-snug">
                            Tu primer mes y el mes en curso salen más bajos porque no son meses
                            completos, no porque trabajaras peor.
                        </p>
                    )}
                    {/* Sin esta línea la barra le cuelga a la persona los cierres que
                        hizo otra. Medido el 13-sep-2026: de los 86 turnos sin cerrar
                        del hogar, 60 los forzó supervisión. Neylianne tenía 15 y doce
                        eran forzados — su hueco real son tres. */}
                    {totalForzados > 0 && (
                        <p className="text-[13px] text-slate-500 mt-1.5 leading-snug">
                            En {totalForzados === 1
                                ? 'un turno el cierre lo hizo'
                                : `${totalForzados} turnos el cierre lo hizo`} supervisión, no tú.
                            Ese hueco no cuenta como tuyo.
                        </p>
                    )}
                    {/* Dos frases distintas para dos cosas distintas. A las ocho
                        veteranas su primera barra les sale corta porque el registro
                        arranca ahí; a quien entró en junio, julio o agosto le sale
                        corta porque entró a mitad de mes — y eso es la verdad
                        entera, no le falta nada. Decirles lo mismo a las dos sería
                        una mentira pequeña en sentido contrario. */}
                    {h.truncadaPorElLimiteDeLaBase && (
                        <p className="text-[13px] text-slate-500 mt-1.5 leading-snug">
                            Tu primera barra sale corta porque Zéndity guarda turnos desde el
                            22 de mayo de 2026; lo de antes no está en el sistema.
                        </p>
                    )}
                    <p className="text-[13px] text-slate-500 mt-1.5 leading-snug">
                        Un mes en el que no trabajaste no aparece — no es un cero, es que no estabas.
                    </p>
                </>
            )}
        </div>
    );
}
