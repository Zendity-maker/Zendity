"use client";

/**
 * LO QUE ZENDI ENCONTRÓ
 * ─────────────────────
 * Cada tarjeta es una pregunta, no una afirmación. Por eso la frase original va
 * PRIMERO y en grande, y lo que Zendi cree haber notado va debajo: se lee la
 * frase, se decide, y no hace falta fiarse del modelo.
 *
 * Descartar pide una razón. Confirmar no — confirmar ya viene con la evidencia
 * al lado. El porqué completo está en src/lib/hallazgos-zendi.ts.
 */
import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Loader2, CheckCircle2, Sparkles, Clock } from "lucide-react";
import { ETIQUETA_TIPO_LARGA, type TipoHallazgo } from "@/lib/hallazgos-zendi";

interface Hallazgo {
    id: string;
    tipo: string;
    tipoEtiqueta: string;
    resumen: string;
    evidencia: string;
    sugerencia: string | null;
    fuente: string | null;
    diasEsperando: number;
    residente: { id: string; nombre: string; habitacion: string | null } | null;
}

const COLOR: Record<string, string> = {
    SIN_CAMPO: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    CONTRADICCION: 'bg-amber-50 text-amber-900 border-amber-200',
    ALERTA_NO_ESCALADA: 'bg-rose-50 text-rose-800 border-rose-200',
};

export default function HallazgosPage() {
    const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [abierto, setAbierto] = useState<string | null>(null);
    const [nota, setNota] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        try {
            const res = await fetch('/api/care/hallazgos');
            const data = await res.json();
            if (data.success) setHallazgos(data.hallazgos);
        } catch { /* la pantalla se queda como está */ }
        finally { setCargando(false); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const resolver = async (id: string, estado: 'CONFIRMADO' | 'DESCARTADO') => {
        setGuardando(true); setError(null);
        try {
            const res = await fetch(`/api/care/hallazgos/${id}/resolver`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado, nota: nota.trim() }),
            });
            const data = await res.json();
            if (!data.success) { setError(data.error || 'No se pudo guardar'); return; }
            setAbierto(null); setNota("");
            await cargar();
        } catch { setError('Error de red'); }
        finally { setGuardando(false); }
    };

    return (
        <AppLayout>
            <div className="max-w-3xl mx-auto p-4 md:p-8">
                <div className="mb-6">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-[#0F6B78]" /> Lo que Zendi encontró
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 leading-relaxed">
                        Zendi lee las notas de la semana y señala lo que le llama la atención.
                        <strong className="text-slate-700"> No son hechos: son preguntas.</strong> Lee la frase original y decide.
                    </p>
                </div>

                {cargando ? (
                    <div className="flex items-center gap-3 text-slate-400 py-16 justify-center">
                        <Loader2 className="w-5 h-5 animate-spin" /> Cargando…
                    </div>
                ) : hallazgos.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 text-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                        <p className="font-black text-emerald-900">Nada por revisar.</p>
                        <p className="text-emerald-700/70 text-sm mt-1">
                            Zendi lee cada lunes. Si no encontró nada, no encontró nada — es lo normal.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {hallazgos.map(h => {
                            const estaAbierto = abierto === h.id;
                            return (
                                <div key={h.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-5">
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${COLOR[h.tipo] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                {h.tipoEtiqueta}
                                            </span>
                                            <span className="flex items-center gap-1 text-xs font-bold text-slate-400 shrink-0">
                                                <Clock className="w-3.5 h-3.5" />
                                                {h.diasEsperando === 0 ? 'hoy' : `${h.diasEsperando}d`}
                                            </span>
                                        </div>

                                        {h.residente && (
                                            <p className="font-black text-slate-900 leading-tight mb-2">
                                                {h.residente.nombre}
                                                {h.residente.habitacion && (
                                                    <span className="text-slate-400 font-medium ml-2 text-sm">Hab. {h.residente.habitacion}</span>
                                                )}
                                            </p>
                                        )}

                                        {/* LA FRASE VA PRIMERO Y EN GRANDE. Es lo que permite
                                            decidir sin fiarse del modelo. */}
                                        <blockquote className="border-l-4 border-slate-300 pl-4 py-1 my-3">
                                            <p className="text-slate-800 text-[15px] leading-relaxed italic">“{h.evidencia}”</p>
                                        </blockquote>

                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            <span className="font-bold text-slate-500">Zendi nota:</span> {h.resumen}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">{ETIQUETA_TIPO_LARGA[h.tipo as TipoHallazgo]}</p>
                                        {h.sugerencia && (
                                            <p className="text-sm text-[#0F6B78] bg-[#e1f5ee] border border-[#0F6B78]/15 rounded-xl px-3 py-2 mt-3">
                                                {h.sugerencia}
                                            </p>
                                        )}

                                        {!estaAbierto && (
                                            <div className="flex gap-2 mt-4">
                                                <button
                                                    onClick={() => { setAbierto(h.id); setNota(""); setError(null); }}
                                                    className="flex-1 min-h-[48px] bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-colors"
                                                >
                                                    No aplica
                                                </button>
                                                <button
                                                    onClick={() => resolver(h.id, 'CONFIRMADO')}
                                                    disabled={guardando}
                                                    className="flex-1 min-h-[48px] bg-[#0F6B78] hover:bg-[#0d5a64] disabled:opacity-40 text-white font-black rounded-2xl transition-colors"
                                                >
                                                    Sí, es real
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {estaAbierto && (
                                        <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50/60">
                                            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mt-4 mb-2">
                                                ¿Por qué no aplica?
                                            </p>
                                            {/* Sin razón, dentro de dos meses nadie sabrá si se
                                                descartó porque era falso o porque no había tiempo. */}
                                            <textarea
                                                value={nota}
                                                onChange={e => setNota(e.target.value)}
                                                rows={3}
                                                maxLength={2000}
                                                placeholder="Ej. Ya está registrado en el plan de cuido, Zendi no lo vio."
                                                className="w-full bg-white border-2 border-slate-200 rounded-2xl p-3 text-sm text-slate-800 focus:border-[#0F6B78] outline-none"
                                            />
                                            {error && <p className="text-rose-600 text-sm font-bold mt-2">{error}</p>}
                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={() => { setAbierto(null); setError(null); }}
                                                    className="px-5 min-h-[48px] bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={() => resolver(h.id, 'DESCARTADO')}
                                                    disabled={guardando || nota.trim().length < 10}
                                                    className="flex-1 min-h-[48px] bg-slate-700 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl transition-colors"
                                                >
                                                    {guardando ? 'Guardando…' : 'Descartar'}
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
        </AppLayout>
    );
}
