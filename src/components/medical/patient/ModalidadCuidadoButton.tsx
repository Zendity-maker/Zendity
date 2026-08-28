"use client";

import { useState } from "react";
import { HeartHandshake, X, Loader2 } from "lucide-react";

/**
 * Marca la modalidad de cuidado del residente: normal, paliativo u hospicio.
 *
 * Los campos vivian en el schema desde una sesion anterior con el comentario
 * "ningun consumidor activo lo usa todavia" — y era literal: 47 residentes en
 * NONE, cero fechas, ninguna pantalla que los escribiera. Esto los termina.
 *
 * Entrar en hospicio no es una etiqueta decorativa: apaga la encuesta de
 * satisfaccion a esa familia y apaga la redaccion automatica de Zendi. Por eso
 * el modal lo dice en voz alta antes de confirmar — quien lo marca tiene que
 * saber que apaga.
 */
type Modalidad = "NONE" | "PALLIATIVE" | "HOSPICE";

const META: Record<Modalidad, { titulo: string; detalle: string; color: string }> = {
    NONE:       { titulo: "Cuidado regular",  detalle: "Sin modalidad especial.",                                  color: "border-slate-300 bg-slate-50 text-slate-700" },
    PALLIATIVE: { titulo: "Paliativo",        detalle: "Enfoque en confort, sin certificacion de hospicio.",       color: "border-amber-300 bg-amber-50 text-amber-800" },
    HOSPICE:    { titulo: "Hospicio",         detalle: "Con proveedor de hospicio certificado.",                   color: "border-violet-300 bg-violet-50 text-violet-800" },
};

export default function ModalidadCuidadoButton({
    patientId, patientName, actual, proveedorActual, inicioActual, onSaved,
}: {
    patientId: string;
    patientName: string;
    actual?: Modalidad | null;
    proveedorActual?: string | null;
    inicioActual?: string | null;
    onSaved?: () => void;
}) {
    const [abierto, setAbierto] = useState(false);
    const [modalidad, setModalidad] = useState<Modalidad>(actual ?? "NONE");
    const [proveedor, setProveedor] = useState(proveedorActual ?? "");
    const [fecha, setFecha] = useState(inicioActual?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const vigente = actual ?? "NONE";

    const guardar = async () => {
        setGuardando(true);
        setError(null);
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/care-modality`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    modalidad,
                    proveedor: modalidad === "HOSPICE" ? proveedor.trim() || null : null,
                    fechaInicio: modalidad === "NONE" ? null : fecha,
                    confirmed: true,
                }),
            });
            const d = await res.json();
            if (!d.success) { setError(d.error || "No se pudo guardar."); return; }
            setAbierto(false);
            onSaved?.();
        } catch {
            setError("Error de conexión.");
        } finally {
            setGuardando(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setAbierto(true)}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm border ${
                    vigente === "HOSPICE" ? "bg-violet-600 border-violet-600 text-white hover:bg-violet-700"
                    : vigente === "PALLIATIVE" ? "bg-amber-500 border-amber-500 text-white hover:bg-amber-600"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
            >
                <HeartHandshake className="w-5 h-5" />
                {vigente === "HOSPICE" ? "Hospicio" : vigente === "PALLIATIVE" ? "Paliativo" : "Modalidad de cuidado"}
            </button>

            {abierto && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between p-5 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-black text-slate-800">Modalidad de cuidado</h3>
                                <p className="text-sm text-slate-500 mt-0.5">{patientName}</p>
                            </div>
                            <button onClick={() => setAbierto(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="space-y-2">
                                {(Object.keys(META) as Modalidad[]).map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setModalidad(m)}
                                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${modalidad === m ? META[m].color : "border-slate-200 bg-white hover:border-slate-300"}`}
                                    >
                                        <p className="font-black text-sm">{META[m].titulo}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{META[m].detalle}</p>
                                    </button>
                                ))}
                            </div>

                            {modalidad !== "NONE" && (
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1.5">Desde</label>
                                        <input
                                            type="date"
                                            value={fecha}
                                            max={new Date().toISOString().slice(0, 10)}
                                            onChange={e => setFecha(e.target.value)}
                                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                        />
                                    </div>
                                    {modalidad === "HOSPICE" && (
                                        <div>
                                            <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1.5">Proveedor</label>
                                            <input
                                                type="text"
                                                value={proveedor}
                                                onChange={e => setProveedor(e.target.value)}
                                                placeholder="Nombre del hospicio"
                                                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Se dice en voz alta lo que se apaga. Marcar hospicio
                                sin saber esto seria enterarse por un correo que ya
                                salio. */}
                            {modalidad === "HOSPICE" && (
                                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-violet-900 leading-relaxed">
                                    <p className="font-black mb-1">Al marcar hospicio, Zéndity deja de:</p>
                                    <ul className="list-disc list-inside space-y-0.5 text-violet-800">
                                        <li>Invitar a esta familia a la encuesta de satisfacción</li>
                                        <li>Redactar solo las actualizaciones a la familia</li>
                                    </ul>
                                    <p className="mt-2 text-violet-700">Lo que se le diga a esta familia lo escribe una persona.</p>
                                </div>
                            )}

                            {error && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm font-medium">{error}</div>
                            )}
                        </div>

                        <div className="flex gap-2 p-5 border-t border-slate-100">
                            <button onClick={() => setAbierto(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50">
                                Cancelar
                            </button>
                            <button
                                onClick={guardar}
                                disabled={guardando || (modalidad === vigente && modalidad === "NONE")}
                                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2"
                            >
                                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                {guardando ? "Guardando…" : "Confirmar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
