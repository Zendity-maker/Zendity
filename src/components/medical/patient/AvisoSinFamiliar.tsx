"use client";

import { useState } from "react";
import { UserX, Loader2 } from "lucide-react";

/**
 * Banda de aviso cuando un expediente no tiene familiar NI declaracion.
 *
 * POR QUE EXISTE. El endpoint sin-familiar dice en su cabecera que "la admision
 * no cierra sin una de las dos cosas". No era cierto: el 28-ago-2026 habia 19
 * residentes activos de 32 sin familiar y CERO declarados. El mecanismo se
 * construyo y no se uso nunca.
 *
 * El hueco no era que faltara la herramienta: era que nadie veia el hueco. El
 * asistente de admision crea el expediente en el paso 1 y deja navegar libre,
 * asi que una admision abandonada a mitad queda como residente activo sin que
 * nada lo diga. Trece de esos 19 entraron por el restore del 21-may y llevan
 * tres meses asi.
 *
 * Por eso el aviso vive AQUI, en el expediente, que es donde alguien lo abre
 * tarde o temprano. Y trae las dos salidas al lado, porque un aviso sin salida
 * es otro contador que no baja.
 */
export default function AvisoSinFamiliar({
    patientId, patientName, onResuelto,
}: {
    patientId: string;
    patientName: string;
    onResuelto?: () => void;
}) {
    const [declarando, setDeclarando] = useState(false);
    const [motivo, setMotivo] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const declarar = async () => {
        if (motivo.trim().length < 10) {
            setError("Explica en una frase por qué no hay familiar (mínimo 10 caracteres).");
            return;
        }
        setGuardando(true);
        setError(null);
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/sin-familiar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivo: motivo.trim() }),
            });
            const d = await res.json();
            if (!d.success) { setError(d.error || "No se pudo guardar."); return; }
            onResuelto?.();
        } catch {
            setError("Error de conexión.");
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
                <UserX className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="font-black text-rose-900 text-base leading-tight">
                        Este expediente no tiene familiar registrado ni declaración
                    </p>
                    {/* Se dice la consecuencia, no la regla. "Falta un campo" no
                        mueve a nadie; "no sabes a quien llamar" si. */}
                    <p className="text-sm text-rose-800 mt-1.5 leading-relaxed">
                        No hay a quién llamar si {patientName.trim().split(/\s+/)[0]} se descompensa de
                        madrugada, y no recibe nada del portal familiar. Resuélvelo de una de las dos
                        formas — las dos son válidas, quedarse así no.
                    </p>

                    {!declarando ? (
                        <div className="flex flex-wrap gap-2 mt-4">
                            <button
                                onClick={() => onResuelto?.()}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl transition-colors"
                            >
                                Agregar familiar
                            </button>
                            <button
                                onClick={() => setDeclarando(true)}
                                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-sm rounded-xl transition-colors"
                            >
                                No tiene familiar conocido
                            </button>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-2">
                            <p className="text-xs font-black uppercase tracking-wider text-rose-700">
                                ¿Por qué no hay familiar?
                            </p>
                            <p className="text-xs text-rose-700/80 leading-snug">
                                Queda constancia de quién lo declaró y cuándo. Si aparece un familiar
                                después, se retira la marca.
                            </p>
                            <textarea
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                rows={2}
                                placeholder="Ej. Referido por el hospital, sin familiares localizables. Trabajo social lo está investigando."
                                className="w-full p-3 bg-white border border-rose-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400"
                            />
                            {error && <p className="text-xs font-bold text-rose-700">{error}</p>}
                            <div className="flex gap-2">
                                <button
                                    onClick={declarar}
                                    disabled={guardando}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl flex items-center gap-2 transition-colors"
                                >
                                    {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Declarar
                                </button>
                                <button
                                    onClick={() => { setDeclarando(false); setError(null); }}
                                    className="px-4 py-2 bg-white border border-slate-300 text-slate-600 font-bold text-sm rounded-xl"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
