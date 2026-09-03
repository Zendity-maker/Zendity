"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Puesta en marcha — qué le falta a esta sede para operar.
 *
 * Cada paso se calcula contra la realidad: nadie marca casillas. Si alguien
 * registra una cuidadora, el paso se completa solo. Nadie tiene que acordarse
 * de tachar nada, y por lo tanto nadie puede tacharlo sin haberlo hecho.
 */
export default function PuestaEnMarchaPage() {
    const [d, setD] = useState<any>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        fetch("/api/corporate/puesta-en-marcha")
            .then(r => r.json())
            .then(j => { if (j.success) setD(j); })
            .finally(() => setCargando(false));
    }, []);

    if (cargando) return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">Cargando…</div>;
    if (!d) return <div className="p-10 text-center font-bold text-rose-600">No se pudo cargar</div>;

    const pct = Math.round((d.completados / d.total) * 100);
    const faltanBloqueantes = d.pasos.filter((p: any) => p.bloqueante && !p.hecho);

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6 pb-16">
            <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Puesta en marcha</p>
                <h1 className="text-3xl font-black text-slate-800 mt-1">{d.sede}</h1>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-baseline justify-between mb-3">
                    <p className="text-sm font-bold text-slate-500">
                        <span className="text-3xl font-black text-[#0F6E56]">{d.completados}</span>
                        <span className="text-slate-400"> de {d.total} listos</span>
                    </p>
                    {d.puedeOperar
                        ? <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700">Puede operar</span>
                        : <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-rose-100 text-rose-700">Falta lo esencial</span>}
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="bg-[#0F6E56] h-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                {faltanBloqueantes.length > 0 && (
                    <p className="text-[13px] font-bold text-rose-700 mt-3">
                        Sin {faltanBloqueantes.map((p: any) => p.titulo.toLowerCase()).join(" y ")}, esta sede no puede recibir residentes.
                    </p>
                )}
            </div>

            <div className="space-y-2.5">
                {d.pasos.map((p: any) => (
                    <div
                        key={p.clave}
                        className={`rounded-2xl border p-4 flex items-start gap-4 ${
                            p.hecho ? "bg-white border-slate-200"
                                : p.bloqueante ? "bg-rose-50 border-rose-200"
                                : "bg-white border-slate-200"
                        }`}
                    >
                        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black ${
                            p.hecho ? "bg-[#0F6E56] text-white"
                                : p.bloqueante ? "bg-rose-500 text-white"
                                : "bg-slate-200 text-slate-500"
                        }`}>
                            {p.hecho ? "✓" : p.bloqueante ? "!" : "·"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-black ${p.hecho ? "text-slate-800" : "text-slate-900"}`}>{p.titulo}</p>
                                {p.bloqueante && !p.hecho && (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-200 text-rose-800">
                                        Imprescindible
                                    </span>
                                )}
                                {p.detalle && <span className="text-[12px] font-bold text-slate-400">{p.detalle}</span>}
                            </div>
                            <p className="text-[13px] text-slate-500 leading-snug mt-1">{p.porque}</p>
                        </div>
                        {!p.hecho && p.ruta && (
                            <Link
                                href={p.ruta}
                                className="shrink-0 text-xs font-bold px-3 py-2 rounded-lg bg-white border border-slate-200 text-[#0F6E56] hover:bg-[#e1f5ee] transition-colors"
                            >
                                Resolver
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
