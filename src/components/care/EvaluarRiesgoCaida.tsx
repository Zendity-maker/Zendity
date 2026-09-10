"use client";

/**
 * EVALUAR RIESGO DE CAÍDA — índice de Downton.
 *
 * Once sí/no y un puntaje. Nada de escalas deslizantes ni de campos de texto
 * obligatorios: son 28 evaluaciones a repartir entre tres personas en tres o
 * cuatro días, y cada segundo de fricción se multiplica por 28.
 *
 * El puntaje y el nivel se calculan MIENTRAS responde, a la vista. Quien evalúa
 * tiene que poder ver que la escala hace lo que dice; un formulario que se
 * traga las respuestas y devuelve un veredicto es justo lo que acabamos de
 * quitar de esta app.
 */
import { useMemo, useState } from "react";
import { X, ShieldAlert, Printer, Check } from "lucide-react";
import { generarHojaDownton, nombreDeArchivo } from "@/lib/downton-pdf";
import {
    ITEMS, GRUPOS, puntuar, nivelDe, CORTE_RIESGO_ALTO,
    MESES_ENTRE_EVALUACIONES, CONFIRMADA_POR_ENFERMERIA, type Respuestas,
} from "@/lib/downton";

const NIVEL: Record<string, { texto: string; clase: string }> = {
    HIGH: { texto: 'Riesgo alto', clase: 'bg-rose-100 text-rose-800 border-rose-300' },
    MODERATE: { texto: 'Riesgo moderado', clase: 'bg-amber-100 text-amber-800 border-amber-300' },
    LOW: { texto: 'Riesgo bajo', clase: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
};

export default function EvaluarRiesgoCaida({ residente, onCerrar, onGuardado }: {
    residente: { id: string; nombre: string; habitacion?: string | null };
    onCerrar: () => void;
    onGuardado: () => void;
}) {
    const [respuestas, setRespuestas] = useState<Respuestas>({});
    const [nota, setNota] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    // Se guarda el resultado en vez de cerrar de golpe: quien acaba de evaluar
    // es quien va a querer el papel, y mandarle a buscarlo en otra pantalla es
    // como no tenerlo. Andrés la pidió "por si fuera necesario", y lo necesario
    // suele ser en el momento.
    const [guardado, setGuardado] = useState<any>(null);

    const puntaje = useMemo(() => puntuar(respuestas), [respuestas]);
    const nivel = nivelDe(puntaje);
    const meta = NIVEL[nivel];

    const guardar = async () => {
        setGuardando(true); setError('');
        try {
            const res = await fetch('/api/care/fall-risk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId: residente.id, respuestas, nota }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'No se pudo guardar.'); setGuardando(false); return;
            }
            setGuardando(false);
            setGuardado(data.paraImprimir ?? null);
            if (!data.paraImprimir) onGuardado();   // sin datos de impresión, se cierra como antes
        } catch { setError('Error de conexión.'); setGuardando(false); }
    };

    const imprimir = () => {
        if (!guardado) return;
        const doc = generarHojaDownton({
            residente: guardado.residente,
            habitacion: guardado.habitacion,
            sede: guardado.sede,
            evaluacion: guardado.evaluacion,
            evaluadoPor: guardado.evaluadoPor,
            evaluadoEl: new Date(guardado.evaluadoEl),
            proximaRevision: null,
        });
        doc.save(nombreDeArchivo(guardado.residente, new Date(guardado.evaluadoEl)));
    };

    if (guardado) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <Check className="w-7 h-7 text-emerald-700" />
                    </div>
                    <p className="font-black text-slate-900 text-lg">Evaluación guardada</p>
                    <p className="text-sm text-slate-500 mt-1 leading-snug">
                        {guardado.residente} · {puntaje} puntos · {meta.texto.toLowerCase()}
                    </p>
                    <div className="flex flex-col gap-2 mt-6">
                        <button onClick={imprimir}
                            className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 inline-flex items-center justify-center gap-2">
                            <Printer className="w-4 h-4" /> Imprimir la hoja
                        </button>
                        <button onClick={onGuardado}
                            className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black">
                            Seguir con el siguiente
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
                <div className="shrink-0 bg-gradient-to-r from-teal-700 to-teal-600 p-5 text-white flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-black flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5" /> Riesgo de caída
                        </h3>
                        <p className="text-teal-100 text-sm mt-0.5">
                            {residente.nombre}{residente.habitacion ? ` · Hab. ${residente.habitacion}` : ''}
                        </p>
                    </div>
                    <button onClick={onCerrar} className="text-teal-100 hover:text-white p-1 rounded-full hover:bg-white/20">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex-1 min-h-0 overflow-y-auto">
                    {/* Mientras enfermería no haya revisado la hoja, quien evalúa
                        tiene derecho a saberlo. Ver src/lib/downton.ts. */}
                    {!CONFIRMADA_POR_ENFERMERIA && (
                        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="text-[13px] text-amber-900 leading-snug">
                                Estos son los ítems del índice de Downton publicado. Si alguno no
                                corresponde a la hoja que usa el hogar, dilo antes de seguir — se
                                corrige en un minuto.
                            </p>
                        </div>
                    )}

                    {GRUPOS.map(grupo => (
                        <div key={grupo} className="mb-5">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">{grupo}</p>
                            <div className="space-y-2">
                                {ITEMS.filter(i => i.grupo === grupo).map(item => {
                                    const marcado = !!respuestas[item.clave];
                                    return (
                                        <button key={item.clave} type="button"
                                            onClick={() => setRespuestas(r => ({ ...r, [item.clave]: !r[item.clave] }))}
                                            className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center gap-3 ${marcado ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                            <span className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center ${marcado ? 'border-teal-600 bg-teal-600' : 'border-slate-300'}`}>
                                                {marcado && <span className="text-white text-xs font-black">✓</span>}
                                            </span>
                                            <span className={`text-sm font-bold ${marcado ? 'text-teal-900' : 'text-slate-600'}`}>
                                                {item.texto}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">
                            Nota <span className="font-medium normal-case text-slate-400">(opcional)</span>
                        </label>
                        <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
                            placeholder="Algo que la escala no recoge…"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-300" />
                    </div>

                    {error && <p className="text-sm text-rose-700 font-bold bg-rose-50 rounded-xl px-4 py-2 mt-4">{error}</p>}
                </div>

                <div className="shrink-0 p-5 border-t border-slate-100 bg-white">
                    {/* El resultado, a la vista, mientras responde. */}
                    <div className={`rounded-xl border px-4 py-3 mb-3 flex items-center justify-between gap-3 ${meta.clase}`}>
                        <div>
                            <p className="text-2xl font-black leading-none">{puntaje}<span className="text-sm font-bold opacity-60"> / {ITEMS.length}</span></p>
                            <p className="text-xs font-bold uppercase tracking-wide mt-1">{meta.texto}</p>
                        </div>
                        <p className="text-[12px] font-semibold opacity-80 text-right leading-snug">
                            Desde {CORTE_RIESGO_ALTO} es riesgo alto.<br />
                            Se repite en {MESES_ENTRE_EVALUACIONES} meses.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onCerrar}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
                            Cancelar
                        </button>
                        <button onClick={guardar} disabled={guardando}
                            className="flex-1 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black disabled:opacity-50">
                            {guardando ? 'Guardando…' : 'Guardar evaluación'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
