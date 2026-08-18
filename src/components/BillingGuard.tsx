"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, FileText, Phone } from "lucide-react";

/**
 * Pantalla de servicio suspendido por facturación.
 *
 * Intercepta window.fetch una sola vez y detecta el 402 + code
 * BILLING_SUSPENDED que devuelve requireSession/requireRole. Envolver el fetch
 * global es lo único viable: la alternativa sería tocar cientos de llamadas
 * y cualquiera que se olvidara dejaría al usuario con un error genérico sin
 * explicación.
 *
 * El overlay NO se puede cerrar: el servicio está cortado. Lo único disponible
 * es cerrar sesión y el contacto de Zendity.
 */
export default function BillingGuard() {
    const [suspended, setSuspended] = useState<string | null>(null);

    useEffect(() => {
        const original = window.fetch;
        // Guard de idempotencia: en dev, StrictMode monta dos veces y sin esto
        // se envolvería el fetch sobre sí mismo.
        if ((window as any).__billingGuardInstalled) return;
        (window as any).__billingGuardInstalled = true;

        window.fetch = async (...args: Parameters<typeof fetch>) => {
            const res = await original(...args);
            if (res.status === 402) {
                try {
                    // clone(): leer el body original lo consumiría y rompería
                    // al llamador que espera su propia respuesta.
                    const data = await res.clone().json();
                    if (data?.code === "BILLING_SUSPENDED") {
                        setSuspended(data.message || "Servicio suspendido por facturación.");
                    }
                } catch { /* 402 de otra naturaleza — se ignora */ }
            }
            return res;
        };

        return () => {
            window.fetch = original;
            (window as any).__billingGuardInstalled = false;
        };
    }, []);

    if (!suspended) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6">
            <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="bg-amber-500 px-8 py-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white">Servicio suspendido</h1>
                        <p className="text-amber-50 text-sm font-medium">Asunto de facturación</p>
                    </div>
                </div>

                <div className="p-8 space-y-5">
                    <p className="text-slate-700 leading-relaxed">{suspended}</p>

                    <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                        <div className="flex items-start gap-3">
                            <FileText className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-black text-teal-900 text-sm">La operación no se detiene</p>
                                <p className="text-teal-800 text-sm mt-1 leading-relaxed">
                                    Continúen documentando <strong>en papel</strong>. Zendity le envió a la
                                    dirección la <strong>Hoja de Continuidad</strong> con el censo, los
                                    medicamentos con horario, las alergias y los cuidados especiales de cada
                                    residente. Todo lo registrado en papel deberá transcribirse al
                                    restablecerse el servicio.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Para restablecerlo, comuníquese con Zendity.</span>
                    </div>

                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="w-full py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-sm transition-colors"
                    >
                        Cerrar sesión
                    </button>
                </div>
            </div>
        </div>
    );
}
