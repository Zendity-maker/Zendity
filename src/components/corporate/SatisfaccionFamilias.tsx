"use client";

import { useEffect, useState } from "react";
import { Star, MessageSquareWarning, Send, Heart, BellRing, MessageSquare } from "lucide-react";

/**
 * Satisfacción de las familias — trimestral, por sede.
 *
 * Va en el dashboard del director junto al resto del estado, no en una
 * pantalla aparte: una métrica que hay que ir a buscar no se mira.
 *
 * Muestra la TASA DE RESPUESTA además del promedio, y eso es deliberado. Un
 * 4.8 de dos respuestas sobre diecinueve invitaciones no dice nada del hogar
 * — dice que diecisiete familias no contestaron, que es la noticia real.
 */
export default function SatisfaccionFamilias({ hqId }: { hqId?: string }) {
    const [s, setS] = useState<any>(null);
    const [enviando, setEnviando] = useState(false);
    // Pestaña. Andres: "que ver las respuestas sea una pestaña, no que esten
    // ahi visibles en todo momento." El resumen es lo que se mira de pasada;
    // las respuestas se leen cuando uno se sienta a leerlas.
    const [pestana, setPestana] = useState<"resumen" | "respuestas">("resumen");
    const [respuestas, setRespuestas] = useState<any[] | null>(null);
    const [cargandoResp, setCargandoResp] = useState(false);
    const [recordando, setRecordando] = useState(false);

    const abrirRespuestas = () => {
        setPestana("respuestas");
        if (respuestas !== null) return;      // ya cargadas
        setCargandoResp(true);
        const url = hqId && hqId !== "ALL"
            ? `/api/corporate/encuestas?vista=respuestas&hqId=${hqId}`
            : "/api/corporate/encuestas?vista=respuestas";
        fetch(url, { cache: "no-store" })
            .then(r => r.json())
            .then(d => setRespuestas(d.success ? d.respuestas : []))
            .catch(() => setRespuestas([]))
            .finally(() => setCargandoResp(false));
    };

    const recordar = async () => {
        if (!confirm("¿Enviar un recordatorio a las familias que aún no han contestado?\n\nEs el mismo enlace de antes. A quien ya respondió no se le manda nada.")) return;
        setRecordando(true);
        try {
            const res = await fetch("/api/corporate/encuestas", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hqId: hqId && hqId !== "ALL" ? hqId : undefined }),
            });
            const d = await res.json();
            if (!d.success) { alert(d.error || "No se pudo enviar."); return; }
            alert(`Recordatorio enviado a ${d.enviados} de ${d.pendientes} familias sin responder.` +
                (d.sinCorreo ? `\n${d.sinCorreo} sin correo registrado.` : "") +
                (d.fallaron ? `\n${d.fallaron} fallaron al enviar.` : ""));
        } catch {
            alert("Error de conexión.");
        } finally {
            setRecordando(false);
        }
    };

    const cargar = () => {
        const url = hqId && hqId !== "ALL"
            ? `/api/corporate/encuestas?hqId=${hqId}`
            : "/api/corporate/encuestas";
        fetch(url, { cache: "no-store" })
            .then(r => r.json())
            .then(d => { if (d.success) setS(d.satisfaccion); })
            .catch(() => null);
    };
    useEffect(cargar, [hqId]);

    const enviar = async () => {
        if (!confirm("¿Enviar la encuesta de este trimestre a las familias?\n\nA quien ya la recibió no se le manda otra.")) return;
        setEnviando(true);
        try {
            const r = await fetch("/api/corporate/encuestas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hqId }),
            });
            const d = await r.json();
            if (d.success) {
                alert(`Enviadas: ${d.enviados}\nYa la tenían: ${d.yaExistian}\nSin correo: ${d.sinCorreo}`);
                cargar();
            } else alert(d.error || "No se pudo enviar.");
        } finally { setEnviando(false); }
    };

    // Si la consulta falla NO se devuelve null. Antes si, y eso hacia
    // desaparecer la tarjeta entera —boton incluido— sin decir por que: el
    // director no encontraba la encuesta y no tenia forma de saber si existia.
    // Una funcion que se esconde al fallar es indistinguible de una que no
    // existe.
    if (!s) {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
                <p className="text-sm text-slate-400">Cargando satisfacción de familias…</p>
            </div>
        );
    }

    const color = s.promedio == null ? "text-slate-300"
        : s.promedio >= 4.5 ? "text-emerald-600"
        : s.promedio >= 3.5 ? "text-amber-600" : "text-rose-600";

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                    <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                        <Star className="w-3.5 h-3.5" /> Satisfacción de familias · {s.periodo}
                    </p>
                </div>
                {s.enviadas > 0 && (
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Recordar ≠ enviar. "Enviar" crea invitaciones nuevas y
                            salta a quien ya la tiene; a los que la recibieron y
                            no la contestaron no les llegaba nada nunca. */}
                        {s.respondidas < s.enviadas && (
                            <button
                                onClick={recordar}
                                disabled={recordando}
                                title={`Reenvía el mismo enlace a las ${s.enviadas - s.respondidas} familias que no han contestado`}
                                className="flex items-center gap-2 text-xs font-bold text-amber-700 hover:text-amber-800 disabled:opacity-50"
                            >
                                <BellRing className="w-3.5 h-3.5" />
                                {recordando ? "Enviando…" : `Recordar a ${s.enviadas - s.respondidas}`}
                            </button>
                        )}
                        <button
                            onClick={enviar}
                            disabled={enviando}
                            title="Envía la encuesta a familias que aún no la han recibido — por ejemplo, un familiar registrado esta semana"
                            className="flex items-center gap-2 text-xs font-bold text-teal-700 hover:text-teal-800 disabled:opacity-50"
                        >
                            <Send className="w-3.5 h-3.5" /> {enviando ? "Enviando…" : "Enviar a quien falte"}
                        </button>
                    </div>
                )}
            </div>

            {/* Pestañas. Solo cuando hay respuestas que leer. */}
            {s.respondidas > 0 && (
                <div className="flex gap-1 border-b border-slate-100 mb-4">
                    <button
                        onClick={() => setPestana("resumen")}
                        className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 -mb-px transition-colors ${pestana === "resumen" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                    >
                        Resumen
                    </button>
                    <button
                        onClick={abrirRespuestas}
                        className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${pestana === "respuestas" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" /> Respuestas
                        <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{s.respondidas}</span>
                    </button>
                </div>
            )}

            {pestana === "respuestas" && (
                <div className="space-y-3">
                    {cargandoResp && <p className="text-sm text-slate-400 animate-pulse">Cargando respuestas…</p>}
                    {!cargandoResp && respuestas?.length === 0 && (
                        <p className="text-sm text-slate-400">Todavía nadie ha contestado.</p>
                    )}
                    {!cargandoResp && respuestas?.map((r: any, i: number) => (
                        <div key={i} className="border border-slate-200 rounded-xl p-4">
                            <div className="flex items-baseline justify-between gap-3 flex-wrap">
                                <p className="text-sm font-black text-slate-800">
                                    {r.familiar}
                                    <span className="font-medium text-slate-400"> · familia de {r.residente}</span>
                                </p>
                                <span className="text-[11px] font-bold text-slate-400">
                                    {new Date(r.respondedAt).toLocaleDateString("es-PR", { day: "2-digit", month: "short" })}
                                </span>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs font-bold text-slate-600">
                                <span>Cuidado <span className="text-amber-500">{"★".repeat(r.cuidado ?? 0)}</span></span>
                                <span>Limpieza <span className="text-amber-500">{"★".repeat(r.limpieza ?? 0)}</span></span>
                                <span>Salud <span className="text-amber-500">{"★".repeat(r.salud ?? 0)}</span></span>
                            </div>
                            {r.comentarios.length > 0 && (
                                <div className="mt-3 space-y-1.5">
                                    {r.comentarios.map((c: any, j: number) => (
                                        <p key={j} className="text-sm text-slate-600 leading-relaxed">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1.5">{c.etiqueta}</span>
                                            <span className="italic">"{c.texto}"</span>
                                        </p>
                                    ))}
                                </div>
                            )}
                            {r.destacada && (
                                <p className="mt-2.5 text-xs font-bold text-teal-700 flex items-center gap-1.5">
                                    <Heart className="w-3 h-3" /> Destacó a {r.destacada}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {pestana === "resumen" && (s.enviadas === 0 ? (
                /* La primera vez, el boton es LA accion — no un enlace pequeño
                   en una esquina. Si el director no lo encuentra, la encuesta
                   no existe. */
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-sm text-slate-500 max-w-md">
                        Todavía no se ha enviado la encuesta de este trimestre.
                        Son tres preguntas y llega por correo a las familias de residentes activos.
                    </p>
                    <button
                        onClick={enviar}
                        disabled={enviando}
                        className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-black rounded-xl text-sm transition-colors shrink-0"
                    >
                        <Send className="w-4 h-4" /> {enviando ? "Enviando…" : "Enviar encuesta"}
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex items-baseline gap-6 flex-wrap">
                        <div>
                            <p className={`text-3xl font-black leading-none ${color}`}>
                                {s.promedio ?? "—"}<span className="text-lg text-slate-300">/5</span>
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">promedio general</p>
                        </div>
                        <div>
                            {/* Sin la tasa, un promedio alto de dos respuestas engaña. */}
                            <p className="text-2xl font-black text-slate-700 leading-none">
                                {s.respondidas}<span className="text-base text-slate-300">/{s.enviadas}</span>
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">respondieron · {s.tasaRespuesta}%</p>
                        </div>
                        <div className="flex gap-4 text-sm">
                            {([["Cuidado", s.porDimension.cuidado], ["Limpieza", s.porDimension.limpieza], ["Salud", s.porDimension.salud]] as const).map(([k, v]) => (
                                <div key={k}>
                                    <p className="font-black text-slate-700">{v ?? "—"}</p>
                                    <p className="text-[11px] text-slate-400">{k}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* A quien destacan las familias. Va ANTES de las alertas
                        a proposito: el reconocimiento no deberia leerse
                        despues de los problemas, como una nota al pie. */}
                    {s.destacadas?.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <p className="flex items-center gap-2 text-xs font-black text-teal-700 mb-2">
                                <Heart className="w-3.5 h-3.5" /> Destacadas por las familias
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {s.destacadas.map((d: any) => (
                                    <span key={d.nombre} className="text-sm font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-full">
                                        {d.nombre}
                                        {d.menciones > 1 && <span className="ml-1.5 text-xs opacity-60">×{d.menciones}</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {s.conAlerta.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <p className="flex items-center gap-2 text-xs font-black text-rose-700 mb-2">
                                <MessageSquareWarning className="w-3.5 h-3.5" />
                                {s.conAlerta.length} respuesta{s.conAlerta.length === 1 ? "" : "s"} de 3 o menos
                            </p>
                            <ul className="space-y-2">
                                {s.conAlerta.slice(0, 3).map((a: any, i: number) => (
                                    <li key={i} className="text-sm">
                                        <span className="font-bold text-slate-700">{a.nombre}</span>
                                        <span className="text-slate-400"> · {a.residente} · {a.promedio}/5</span>
                                        {a.comentario && (
                                            <p className="text-xs text-slate-500 italic mt-0.5">"{a.comentario}"</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            ))}
        </div>
    );
}
