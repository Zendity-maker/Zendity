"use client";

import { useEffect, useState } from "react";
import { Check, X, Package, CalendarClock, AlertTriangle } from "lucide-react";

/**
 * Cola de decisión de Concierge.
 *
 * Antes no existía. Una familia pedía y el pedido se quedaba en PENDING sin que
 * nadie pudiera moverlo — la versión un paso más adelante del mismo problema
 * que tenía el módulo entero.
 *
 * Dos reglas que la pantalla hace cumplir:
 *
 *  · Aprobar una cita exige decir QUIÉN la va a dar, de la casa o un servicio
 *    externo. Así se perdió la única cita que llegaron a pedir: quedó sin
 *    asignar y acabó cancelada.
 *  · Rechazar exige motivo, porque la familia lo va a leer.
 *
 * Nada se cobra al aprobar. El cargo entra a la factura del mes cuando se
 * entrega o se realiza.
 */
export default function ColaConcierge() {
    const [datos, setDatos] = useState<any>(null);
    const [cargando, setCargando] = useState(true);
    const [ocupado, setOcupado] = useState<string | null>(null);
    const [asignacion, setAsignacion] = useState<Record<string, { especialistaId: string; externo: string }>>({});

    const cargar = async () => {
        setCargando(true);
        try {
            const r = await fetch("/api/corporate/concierge/cola");
            const d = await r.json();
            if (d.success) setDatos(d);
        } catch { /* accesorio */ } finally { setCargando(false); }
    };
    useEffect(() => { cargar(); }, []);

    const decidir = async (tipo: "producto" | "servicio", id: string, accion: string, extra: any = {}) => {
        if (accion === "rechazar" || accion === "cancelar") {
            const motivo = prompt("¿Por qué? La familia va a leer esto.");
            if (!motivo?.trim()) return;
            extra.motivo = motivo.trim();
        }
        setOcupado(id);
        try {
            const r = await fetch("/api/corporate/concierge/decidir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tipo, id, accion, ...extra }),
            });
            const d = await r.json();
            if (!d.success) { alert(d.error || "No se pudo."); return; }
            await cargar();
        } catch { alert("No se pudo. Intenta de nuevo."); }
        finally { setOcupado(null); }
    };

    if (cargando || !datos) return null;

    const pedidos = datos.pedidos ?? [];
    const citas = datos.citas ?? [];
    if (pedidos.length === 0 && citas.length === 0) return null;

    const alerta = (gasto: number) =>
        gasto >= datos.tope ? "text-rose-600" : gasto >= datos.tope * 0.7 ? "text-amber-600" : "text-slate-400";

    return (
        <div className="mb-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
                <h2 className="text-lg font-black text-slate-800">Pedidos de familias</h2>
                <p className="text-xs text-slate-400">
                    Aprobar no cobra nada. El cargo entra a la factura del mes al entregarse.
                </p>
            </div>

            <div className="space-y-3">
                {pedidos.map((p: any) => (
                    <div key={p.id} className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="min-w-[220px] flex-1">
                                <p className="flex items-center gap-2 font-black text-slate-800">
                                    <Package className="w-4 h-4 text-slate-400" /> {p.product.name}
                                </p>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    {p.patient.name.trim()} · Hab. {p.patient.roomNumber || "—"} · ${p.totalPrice.toFixed(2)}
                                </p>
                                <p className={`text-xs mt-1 ${alerta(p.gastoDelMes)}`}>
                                    Lleva ${p.gastoDelMes.toFixed(2)} de ${datos.tope} este mes
                                    {p.product.stock <= 0 && (
                                        <span className="ml-2 text-rose-600 font-bold inline-flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> sin stock
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {p.status === "PENDING" ? (
                                    <>
                                        <button onClick={() => decidir("producto", p.id, "rechazar")} disabled={ocupado === p.id}
                                            className="px-3 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => decidir("producto", p.id, "aprobar")} disabled={ocupado === p.id}
                                            className="px-4 py-2 rounded-lg text-sm font-black text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors">
                                            Aprobar
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => decidir("producto", p.id, "entregar")} disabled={ocupado === p.id}
                                        className="px-4 py-2 rounded-lg text-sm font-black text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50 transition-colors inline-flex items-center gap-2">
                                        <Check className="w-4 h-4" /> Entregado — cobrar ${p.totalPrice.toFixed(2)}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {citas.map((c: any) => {
                    const a = asignacion[c.id] ?? { especialistaId: "", externo: "" };
                    return (
                        <div key={c.id} className="border border-slate-200 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="min-w-[220px] flex-1">
                                    <p className="flex items-center gap-2 font-black text-slate-800">
                                        <CalendarClock className="w-4 h-4 text-slate-400" /> {c.service.name}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                        {c.patient.name.trim()} · Hab. {c.patient.roomNumber || "—"} · ${c.precio.toFixed(2)}
                                        {c.scheduledAt && ` · ${new Date(c.scheduledAt).toLocaleDateString("es-PR", { day: "numeric", month: "long" })}`}
                                    </p>
                                    {c.notes && <p className="text-xs text-slate-400 mt-1 italic">"{c.notes}"</p>}
                                    <p className={`text-xs mt-1 ${alerta(c.gastoDelMes)}`}>
                                        Lleva ${c.gastoDelMes.toFixed(2)} de ${datos.tope} este mes
                                    </p>
                                    {c.status !== "PENDING_APPROVAL" && (
                                        <p className="text-xs font-bold text-teal-700 mt-1">
                                            La da: {c.specialist?.name ?? c.servicioExterno ?? "sin asignar"}
                                        </p>
                                    )}
                                </div>

                                <div className="shrink-0 flex flex-col gap-2 min-w-[260px]">
                                    {c.status === "PENDING_APPROVAL" ? (
                                        <>
                                            {/* Hay que decir quien la da. Sin esto, la cita queda
                                                aprobada y sin nadie — que es como se perdio la unica
                                                que llegaron a pedir. */}
                                            <select
                                                value={a.especialistaId}
                                                onChange={e => setAsignacion(s => ({ ...s, [c.id]: { especialistaId: e.target.value, externo: "" } }))}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                            >
                                                <option value="">— De la casa —</option>
                                                {(datos.especialistas ?? []).map((e: any) => (
                                                    <option key={e.id} value={e.id}>{e.name.trim()}</option>
                                                ))}
                                            </select>
                                            {!a.especialistaId && (
                                                <input
                                                    value={a.externo}
                                                    onChange={e => setAsignacion(s => ({ ...s, [c.id]: { especialistaId: "", externo: e.target.value } }))}
                                                    placeholder="…o nombre del servicio externo"
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                />
                                            )}
                                            <div className="flex gap-2">
                                                <button onClick={() => decidir("servicio", c.id, "rechazar")} disabled={ocupado === c.id}
                                                    className="px-3 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => decidir("servicio", c.id, "aprobar", { especialistaId: a.especialistaId || undefined, servicioExterno: a.externo || undefined })}
                                                    disabled={ocupado === c.id || (!a.especialistaId && !a.externo.trim())}
                                                    className="flex-1 px-4 py-2 rounded-lg text-sm font-black text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors">
                                                    Aprobar
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <button onClick={() => decidir("servicio", c.id, "completar")} disabled={ocupado === c.id}
                                            className="px-4 py-2 rounded-lg text-sm font-black text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50 transition-colors inline-flex items-center gap-2 justify-center">
                                            <Check className="w-4 h-4" /> Realizada — cobrar ${c.precio.toFixed(2)}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
