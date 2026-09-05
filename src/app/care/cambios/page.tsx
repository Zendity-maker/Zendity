"use client";

/**
 * CAMBIOS DEL PISO
 * ────────────────
 * Lo que la cuidadora notó y todavía no es una emergencia, esperando que
 * enfermería lo mire y diga qué se hizo.
 *
 * POR QUÉ ESTA PANTALLA EXISTE Y NO ES SOLO UNA LISTA. Lo que faltaba nunca fue
 * dónde escribirlo —la bitácora siempre estuvo ahí— sino que alguien lo
 * cerrara. Por eso cada tarjeta tiene una decisión obligatoria y un campo para
 * contestarle a quien lo reportó. Un reporte que se lee y no se contesta enseña
 * a no reportar.
 *
 * Lo más viejo va arriba. A los tres días la tarjeta se pone en ámbar: es la
 * misma lección de las dos observaciones de personal que llevaron 56 y 45 días
 * paradas.
 */
import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Loader2, CheckCircle2, Clock } from "lucide-react";
import { RESULTADOS } from "@/lib/cambios-de-condicion";

interface Cambio {
    id: string;
    areaEtiqueta: string;
    descripcion: string;
    reportadoAt: string;
    reportadoPor: string;
    diasEsperando: number;
    residente: { id: string; nombre: string; habitacion: string | null };
}

export default function CambiosDelPisoPage() {
    const [cambios, setCambios] = useState<Cambio[]>([]);
    const [cargando, setCargando] = useState(true);
    const [abierto, setAbierto] = useState<string | null>(null);
    const [resultado, setResultado] = useState<string | null>(null);
    const [respuesta, setRespuesta] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        try {
            const res = await fetch('/api/care/cambio-condicion');
            const data = await res.json();
            if (data.success) setCambios(data.cambios);
        } catch { /* la pantalla se queda como está */ }
        finally { setCargando(false); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const cerrar = async (id: string) => {
        if (!resultado) return;
        setGuardando(true);
        setError(null);
        try {
            const res = await fetch(`/api/care/cambio-condicion/${id}/revisar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resultado, respuesta: respuesta.trim() }),
            });
            const data = await res.json();
            if (!data.success) { setError(data.error || 'No se pudo cerrar'); return; }
            setAbierto(null); setResultado(null); setRespuesta("");
            await cargar();
        } catch { setError('Error de red'); }
        finally { setGuardando(false); }
    };

    return (
        <AppLayout>
            <div className="max-w-3xl mx-auto p-4 md:p-8">
                <div className="mb-6">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900">Cambios del piso</h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Lo que el personal notó y todavía no es una emergencia. Lo más viejo primero.
                    </p>
                </div>

                {cargando ? (
                    <div className="flex items-center gap-3 text-slate-400 py-16 justify-center">
                        <Loader2 className="w-5 h-5 animate-spin" /> Cargando…
                    </div>
                ) : cambios.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 text-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                        <p className="font-black text-emerald-900">No hay nada esperando.</p>
                        <p className="text-emerald-700/70 text-sm mt-1">Todo lo reportado desde el piso está revisado.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {cambios.map(c => {
                            const viejo = c.diasEsperando >= 3;
                            const estaAbierto = abierto === c.id;
                            return (
                                <div
                                    key={c.id}
                                    className={`bg-white rounded-3xl border shadow-sm overflow-hidden ${viejo ? 'border-amber-300' : 'border-slate-200'}`}
                                >
                                    <div className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-black text-slate-900 leading-tight">
                                                    {c.residente.nombre}
                                                    {c.residente.habitacion && (
                                                        <span className="text-slate-400 font-medium ml-2 text-sm">Hab. {c.residente.habitacion}</span>
                                                    )}
                                                </p>
                                                <span className="inline-block mt-1.5 text-[11px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-[#e1f5ee] text-[#0F6B78]">
                                                    {c.areaEtiqueta}
                                                </span>
                                            </div>
                                            <span className={`shrink-0 flex items-center gap-1 text-xs font-bold ${viejo ? 'text-amber-700' : 'text-slate-400'}`}>
                                                <Clock className="w-3.5 h-3.5" />
                                                {c.diasEsperando === 0 ? 'hoy' : `${c.diasEsperando} día${c.diasEsperando === 1 ? '' : 's'}`}
                                            </span>
                                        </div>

                                        <p className="text-slate-700 text-sm leading-relaxed mt-3 whitespace-pre-wrap">{c.descripcion}</p>
                                        <p className="text-slate-400 text-xs mt-2">Reportado por {c.reportadoPor}</p>

                                        {!estaAbierto && (
                                            <button
                                                onClick={() => { setAbierto(c.id); setResultado(null); setRespuesta(""); setError(null); }}
                                                className="mt-4 w-full min-h-[48px] bg-[#0F6B78] hover:bg-[#0d5a64] text-white font-black rounded-2xl transition-colors"
                                            >
                                                Revisar
                                            </button>
                                        )}
                                    </div>

                                    {estaAbierto && (
                                        <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50/60">
                                            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mt-4 mb-2">¿Qué se hizo?</p>
                                            <div className="space-y-2">
                                                {RESULTADOS.map(r => (
                                                    <button
                                                        key={r.codigo}
                                                        onClick={() => setResultado(r.codigo)}
                                                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                                            resultado === r.codigo
                                                                ? 'bg-[#0F6B78] text-white border-[#0F6B78]'
                                                                : 'bg-white text-slate-700 border-slate-200 hover:border-[#0F6B78]/40'
                                                        }`}
                                                    >
                                                        <span className="block font-black text-sm">{r.etiqueta}</span>
                                                        <span className={`block text-xs mt-0.5 ${resultado === r.codigo ? 'text-white/70' : 'text-slate-400'}`}>
                                                            {r.descripcion}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Le llega a quien lo reportó. Sin esto, reportar se
                                                siente como hablarle a una pared. */}
                                            <textarea
                                                value={respuesta}
                                                onChange={e => setRespuesta(e.target.value)}
                                                rows={3}
                                                maxLength={2000}
                                                placeholder="Respuesta para quien lo reportó (opcional). Le llega como aviso."
                                                className="w-full mt-3 bg-white border-2 border-slate-200 rounded-2xl p-3 text-sm text-slate-800 focus:border-[#0F6B78] outline-none"
                                            />

                                            {error && <p className="text-rose-600 text-sm font-bold mt-2">{error}</p>}

                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={() => { setAbierto(null); setResultado(null); setError(null); }}
                                                    className="px-5 min-h-[48px] bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={() => cerrar(c.id)}
                                                    disabled={!resultado || guardando}
                                                    className="flex-1 min-h-[48px] bg-[#0F6B78] hover:bg-[#0d5a64] disabled:opacity-40 text-white font-black rounded-2xl transition-colors"
                                                >
                                                    {guardando ? 'Guardando…' : 'Cerrar y avisar'}
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
