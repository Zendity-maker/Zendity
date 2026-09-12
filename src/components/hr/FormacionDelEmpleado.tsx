"use client";

import { useEffect, useState } from "react";
import { Loader2, GraduationCap, Plus, AlertTriangle, Check } from "lucide-react";

/**
 * LA FORMACIÓN DE UNA PERSONA, Y EL BOTÓN PARA ASIGNARLE UN CURSO.
 *
 * Hasta el 12-sep-2026 toda la formación la decidían tres reglas automáticas y
 * no había forma de que una persona asignara nada: de 204 asignaciones en
 * producción, cero a mano.
 *
 * Va en la ficha del empleado y no en una pantalla propia porque es donde se
 * toma la decisión — se mira a alguien, se ve lo que lleva pendiente, y se le
 * añade lo que haga falta. Una pantalla aparte de "asignaciones" obliga a
 * buscar a la persona otra vez.
 *
 * Lo pendiente se enseña ANTES que el botón, a propósito: trece cursos abiertos
 * y uno más no es ayudar.
 */

interface Pendiente {
    id: string;
    courseId: string;
    title: string;
    durationMins: number;
    reason: string;
    textoPlazo: string;
    vencida: boolean;
    aMano: boolean;
    siguiente: boolean;
}

interface CursoDelCatalogo {
    id: string;
    title: string;
    durationMins: number;
    category: string;
    yaAsignado: boolean;
    yaAprobado: boolean;
}

export default function FormacionDelEmpleado({ userId, nombre }: { userId: string; nombre: string }) {
    const [cargando, setCargando] = useState(true);
    const [pendientes, setPendientes] = useState<Pendiente[]>([]);
    const [catalogo, setCatalogo] = useState<CursoDelCatalogo[]>([]);
    const [abierto, setAbierto] = useState(false);
    const [cursoId, setCursoId] = useState("");
    const [motivo, setMotivo] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

    const cargar = async () => {
        try {
            const res = await fetch(`/api/hr/academy/asignar?userId=${userId}`);
            const d = await res.json();
            if (d.success) {
                setPendientes(d.pendientes ?? []);
                setCatalogo(d.catalogo ?? []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

    const asignar = async () => {
        if (!cursoId || motivo.trim().length < 5) return;
        setEnviando(true);
        setAviso(null);
        try {
            const res = await fetch("/api/hr/academy/asignar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, courseId: cursoId, motivo }),
            });
            const d = await res.json();
            setAviso({ ok: !!d.success, texto: d.mensaje || d.error || "Error" });
            if (d.success) {
                setCursoId("");
                setMotivo("");
                setAbierto(false);
                await cargar();
            }
        } catch (e) {
            setAviso({ ok: false, texto: "No se pudo conectar." });
        } finally {
            setEnviando(false);
        }
    };

    if (cargando) {
        return (
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 flex items-center gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm font-bold">Cargando formación…</span>
            </div>
        );
    }

    const vencidas = pendientes.filter(p => p.vencida).length;

    return (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
                <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-teal-600" /> Formación
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                        {pendientes.length === 0
                            ? "No tiene nada pendiente."
                            : `${pendientes.length} curso${pendientes.length !== 1 ? "s" : ""} sin empezar`}
                        {vencidas > 0 && (
                            <span className="text-rose-600 font-bold"> · {vencidas} con el plazo pasado</span>
                        )}
                    </p>
                </div>
                <button
                    onClick={() => setAbierto(v => !v)}
                    className="shrink-0 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                    <Plus className="w-3.5 h-3.5" /> Asignar un curso
                </button>
            </div>

            {abierto && (
                <div className="mb-6 p-5 rounded-2xl border-2 border-teal-200 bg-teal-50/40 space-y-4">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Curso</label>
                        <select
                            value={cursoId}
                            onChange={e => setCursoId(e.target.value)}
                            className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold bg-white text-slate-800"
                        >
                            <option value="">Elige uno…</option>
                            {catalogo.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.title}
                                    {c.yaAsignado ? " — ya asignado" : c.yaAprobado ? " — ya aprobado" : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                            Por qué se lo asignas
                        </label>
                        <textarea
                            value={motivo}
                            onChange={e => setMotivo(e.target.value)}
                            rows={2}
                            placeholder="Ej. Repasar el cierre de turno: el reporte del viernes salió sin las omisiones."
                            className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-medium bg-white"
                        />
                        {/* Esto no es burocracia: es el texto que la persona ve
                            en su pantalla debajo del curso. "Asignado por tu
                            supervisión" a secas no explica nada. */}
                        <p className="text-[11px] text-slate-500 mt-1.5">
                            Lo va a leer {nombre.split(" ")[0]} en su Academy, debajo del curso.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setAbierto(false); setAviso(null); }}
                            className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={asignar}
                            disabled={enviando || !cursoId || motivo.trim().length < 5}
                            className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-sm transition-colors"
                        >
                            {enviando ? "Asignando…" : "Asignar y avisarle"}
                        </button>
                    </div>
                </div>
            )}

            {aviso && (
                <div className={`mb-5 p-4 rounded-2xl text-sm font-bold flex items-start gap-2 ${
                    aviso.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                             : "bg-rose-50 border border-rose-200 text-rose-800"
                }`}>
                    {aviso.ok ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                    {aviso.texto}
                </div>
            )}

            {pendientes.length > 0 && (
                <div className="space-y-2">
                    {pendientes.map(p => (
                        <div
                            key={p.id}
                            className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl border ${
                                p.vencida ? "border-rose-200 bg-rose-50/40" : "border-slate-200"
                            }`}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{p.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">
                                    {p.reason} · {p.durationMins} min
                                </p>
                            </div>
                            <span className={`shrink-0 text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                                p.vencida ? "bg-rose-100 text-rose-700"
                                : p.textoPlazo === "Sin fecha límite" ? "bg-slate-100 text-slate-500"
                                : "bg-amber-100 text-amber-800"
                            }`}>
                                {p.textoPlazo}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
