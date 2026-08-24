"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

/**
 * Avisos del piso, en lugar de alert() del navegador.
 *
 * La pantalla de la cuidadora tenía 57 alert() y ningún aviso discreto. Cada
 * registro —una rotación, un baño, un pañal— terminaba en una caja gris que
 * bloquea la pantalla y hay que cerrar con el dedo.
 *
 * En una tablet, a mitad de turno y con las manos ocupadas, ese toque extra es
 * lo que hace que las funciones opcionales se abandonen: registrar algo cuesta
 * dos gestos en vez de uno.
 *
 * Este aviso aparece abajo, no bloquea, y se va solo. El error se queda más
 * tiempo porque hay que leerlo; la confirmación se va rápido porque no.
 */

export type TipoAviso = "ok" | "error";

export interface Aviso {
    texto: string;
    tipo: TipoAviso;
    /** Puntos de Z-Score, aparte del mensaje clínico. Ver nota abajo. */
    puntos?: number;
}

const MS_OK = 2600;
const MS_ERROR = 6000;

export function useAviso() {
    const [aviso, setAviso] = useState<Aviso | null>(null);

    useEffect(() => {
        if (!aviso) return;
        const t = setTimeout(() => setAviso(null), aviso.tipo === "ok" ? MS_OK : MS_ERROR);
        return () => clearTimeout(t);
    }, [aviso]);

    const ok = useCallback((texto: string, puntos?: number) => setAviso({ texto, tipo: "ok", puntos }), []);
    const error = useCallback((texto: string) => setAviso({ texto, tipo: "error" }), []);
    const cerrar = useCallback(() => setAviso(null), []);

    return { aviso, ok, error, cerrar };
}

export function AvisoPiso({ aviso, onCerrar }: { aviso: Aviso | null; onCerrar: () => void }) {
    if (!aviso) return null;
    const esError = aviso.tipo === "error";

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-6 pointer-events-none"
        >
            <div
                className={`pointer-events-auto flex items-start gap-3 max-w-md w-full rounded-2xl px-5 py-4 shadow-2xl border ${
                    esError
                        ? "bg-rose-950 border-rose-800 text-rose-50"
                        : "bg-teal-950 border-teal-800 text-teal-50"
                }`}
            >
                <span className="shrink-0 mt-0.5">
                    {esError ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </span>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug">{aviso.texto}</p>

                    {/* Los puntos van aparte y en segundo plano. Antes iban en la
                        misma frase que la confirmación clínica: "Cambio Postural
                        registrado. ¡Excelente tiempo clínico! +2 Puntos Zendity."
                        Mezclar el registro con la puntuación hace que se lea como
                        un juego lo que es un expediente. */}
                    {typeof aviso.puntos === "number" && aviso.puntos !== 0 && (
                        <p className={`text-xs mt-1 ${esError ? "text-rose-300" : "text-teal-300"}`}>
                            {aviso.puntos > 0 ? `+${aviso.puntos}` : aviso.puntos} puntos
                        </p>
                    )}
                </div>

                {/* Área de toque generosa: se usa con guantes. */}
                <button
                    onClick={onCerrar}
                    aria-label="Cerrar aviso"
                    className="shrink-0 -mr-1 -mt-1 p-2 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
