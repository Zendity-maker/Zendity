"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, Check, X } from "lucide-react";

const TOKEN_KEY = "zendity_kiosk_token";

/**
 * /external-kiosk/setup?token=XXX
 *
 * Pantalla one-time. La abre el administrador en la tablet justo después de
 * configurarla. Lee el token de la URL, lo guarda en localStorage, valida con
 * un ping al server, y muestra confirmación con el label/piso del device. Si
 * todo OK, ofrece "Ir al kiosko". Si falla, muestra error claro.
 */
export default function ExternalKioskSetupPage() {
    const params = useSearchParams();
    const router = useRouter();
    const token = params.get("token") || "";

    const [state, setState] = useState<"validating" | "ok" | "error">("validating");
    const [device, setDevice] = useState<{ label: string; floor: number } | null>(null);
    const [errMsg, setErrMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setState("error");
            setErrMsg("Falta el token de configuración en la URL.");
            return;
        }
        (async () => {
            try {
                const res = await fetch("/api/external-kiosk/bootstrap", {
                    headers: { "x-device-token": token },
                    cache: "no-store",
                });
                const data = await res.json();
                if (!data.success) {
                    setState("error");
                    setErrMsg(data.error || "Token inválido o tablet revocada.");
                    return;
                }
                // OK — persistir
                if (typeof window !== "undefined") {
                    localStorage.setItem(TOKEN_KEY, token);
                }
                setDevice({ label: data.device.label, floor: data.device.floor });
                setState("ok");
            } catch {
                setState("error");
                setErrMsg("Sin conexión. Verifica el WiFi de la tablet.");
            }
        })();
    }, [token]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-teal-900 flex items-center justify-center p-8">
            <div className="bg-white rounded-3xl p-10 max-w-lg w-full text-center shadow-2xl">
                {state === "validating" && (
                    <>
                        <Loader2 className="w-16 h-16 mx-auto text-teal-600 animate-spin mb-4" />
                        <h1 className="text-2xl font-black text-slate-900 mb-2">Configurando tablet…</h1>
                        <p className="text-slate-500">Verificando con el servidor</p>
                    </>
                )}
                {state === "ok" && device && (
                    <>
                        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-4 shadow-lg">
                            <Check className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 mb-2">¡Tablet configurada!</h1>
                        <p className="text-lg text-slate-600 mb-6">
                            Esta tablet ahora opera como:<br />
                            <strong className="text-teal-700 text-2xl">{device.label}</strong><br />
                            <span className="text-sm text-slate-500">Piso {device.floor}</span>
                        </p>
                        <button
                            onClick={() => router.replace("/external-kiosk")}
                            className="bg-teal-600 hover:bg-teal-700 text-white text-xl font-black px-10 py-4 rounded-2xl shadow-lg active:scale-95 transition"
                        >
                            Abrir kiosko →
                        </button>
                        <p className="text-xs text-slate-400 mt-6">
                            Esta pantalla solo se usa una vez. Si necesitas reconfigurar, pide al admin un nuevo token.
                        </p>
                    </>
                )}
                {state === "error" && (
                    <>
                        <div className="w-20 h-20 mx-auto rounded-full bg-rose-500 flex items-center justify-center mb-4">
                            <X className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 mb-2">Configuración fallida</h1>
                        <p className="text-slate-600 mb-6">{errMsg}</p>
                        <p className="text-sm text-slate-400">
                            Contacta al administrador para obtener un token válido.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
