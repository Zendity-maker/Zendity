"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Stethoscope, User } from "lucide-react";

/**
 * Señalamientos de familia — pantalla de dirección.
 *
 * Un señalamiento es lo que una familia, o el propio residente, le plantea
 * formalmente al personal. El supervisor lo recibe y lo registra; aquí se
 * decide qué se hace con él.
 *
 * Antes esto no existía. Los señalamientos solo se veían en el panel operativo
 * del supervisor, cuya única acción era despacharlos a una cuidadora — con 22
 * de 30 despachos vencidos sin atender, porque no está en su mano resolverlos.
 */

const ESTADOS: Record<string, { texto: string; clase: string }> = {
    PENDING: { texto: "Sin revisar", clase: "bg-rose-50 text-rose-700 border-rose-200" },
    APPROVED_ADMIN: { texto: "Lo lleva dirección", clase: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    ROUTED_NURSING: { texto: "En enfermería", clase: "bg-teal-50 text-teal-700 border-teal-200" },
    ROUTED_MAINTENANCE: { texto: "En mantenimiento", clase: "bg-slate-100 text-slate-600 border-slate-300" },
    RESOLVED: { texto: "Resuelto", clase: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default function SenalamientosPage() {
    const [items, setItems] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [verCerrados, setVerCerrados] = useState(false);
    const [actuando, setActuando] = useState<string | null>(null);
    const [nota, setNota] = useState<Record<string, string>>({});

    const cargar = async (cerrados = verCerrados) => {
        setCargando(true);
        try {
            const res = await fetch(`/api/corporate/senalamientos${cerrados ? "?cerrados=1" : ""}`, { cache: "no-store" });
            const d = await res.json();
            if (d.success) setItems(d.items);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargar(false); }, []);

    const actuar = async (id: string, action: string) => {
        setActuando(id);
        try {
            const res = await fetch("/api/corporate/complaints/triage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ complaintId: id, action, nota: nota[id] || "" }),
            });
            const d = await res.json();
            if (!d.success) { alert(d.error || "No se pudo actualizar."); return; }
            await cargar();
        } finally {
            setActuando(null);
        }
    };

    const abiertos = items.filter(i => i.status !== "RESOLVED");

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-700 mb-1">Dirección</p>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Señalamientos de familia</h1>
                    <p className="text-slate-500 mt-2 leading-relaxed max-w-2xl">
                        Lo que una familia o el propio residente le plantea al personal. El supervisor
                        lo recibe y lo registra; aquí se decide qué se hace.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-600">
                        {abiertos.length} sin cerrar
                    </span>
                    <button
                        onClick={() => { const v = !verCerrados; setVerCerrados(v); cargar(v); }}
                        className="text-sm font-bold text-indigo-600 hover:text-indigo-800"
                    >
                        {verCerrados ? "Ver solo los abiertos" : "Incluir los resueltos"}
                    </button>
                </div>

                {cargando && <p className="text-slate-400 font-medium py-12 text-center">Cargando…</p>}

                {!cargando && items.length === 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                        <p className="font-black text-slate-700">No hay señalamientos sin cerrar.</p>
                    </div>
                )}

                {items.map(item => {
                    const est = ESTADOS[item.status] ?? { texto: item.status, clase: "bg-slate-100 text-slate-600 border-slate-300" };
                    const cerrado = item.status === "RESOLVED";
                    return (
                        <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${est.clase}`}>{est.texto}</span>
                                    {/* Los dias importan: uno de los abiertos en Cupey llevaba 36. */}
                                    <span className={`text-xs font-bold ${item.dias > 14 && !cerrado ? "text-rose-600" : "text-slate-400"}`}>
                                        hace {item.dias} {item.dias === 1 ? "día" : "días"}
                                    </span>
                                </div>
                                <Link
                                    href={`/corporate/medical/patients/${item.patient.id}`}
                                    className="text-sm font-bold text-slate-700 hover:text-indigo-700"
                                >
                                    {item.patient.name}
                                    {item.patient.roomNumber && <span className="text-slate-400 font-medium"> · {item.patient.roomNumber}</span>}
                                </Link>
                            </div>

                            <div className="px-6 py-5 space-y-4">
                                <div className="flex items-start gap-2 text-sm text-slate-500">
                                    <User className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span><strong className="text-slate-700">Lo planteó:</strong> {item.planteadoPor}</span>
                                </div>

                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{item.description}</p>

                                {item.photoUrl && (
                                    <img src={item.photoUrl} alt="" className="rounded-xl max-h-64 border border-slate-200" />
                                )}

                                {item.resolutionNote && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                        <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Qué se hizo</p>
                                        <p className="text-sm text-slate-600">{item.resolutionNote}</p>
                                    </div>
                                )}
                            </div>

                            {!cerrado && (
                                <div className="px-6 pb-6 space-y-3">
                                    <textarea
                                        value={nota[item.id] || ""}
                                        onChange={(e) => setNota(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        rows={2}
                                        placeholder="Qué se hizo o se va a hacer. Queda en el historial del señalamiento."
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => actuar(item.id, "APPROVE_ADMIN")}
                                            disabled={actuando === item.id}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
                                        >
                                            <AlertCircle className="w-4 h-4" /> Lo llevo yo
                                        </button>
                                        <button
                                            onClick={() => actuar(item.id, "ROUTE_NURSING")}
                                            disabled={actuando === item.id}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
                                        >
                                            <Stethoscope className="w-4 h-4" /> Enviar a enfermería
                                        </button>
                                        <button
                                            onClick={() => actuar(item.id, "REJECT")}
                                            disabled={actuando === item.id || !(nota[item.id] || "").trim()}
                                            title={!(nota[item.id] || "").trim() ? "Escribe qué se hizo antes de cerrarlo" : undefined}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
                                        >
                                            <CheckCircle2 className="w-4 h-4" /> Cerrar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
