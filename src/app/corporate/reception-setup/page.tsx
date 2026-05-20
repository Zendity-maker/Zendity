"use client";

import { useState, useEffect } from "react";
import { Monitor, Copy, Check, ExternalLink, QrCode, RefreshCw, Smartphone, Globe } from "lucide-react";
import { useActiveHq } from "@/contexts/ActiveHqContext";
import QRCodeDisplay from "./QRCodeDisplay";

export default function ReceptionSetupPage() {
    const { activeHqId, activeHqName } = useActiveHq();
    const [copied, setCopied] = useState(false);
    const [hqInfo, setHqInfo] = useState<{ name: string; phone?: string | null; logoUrl?: string | null } | null>(null);
    const [loading, setLoading] = useState(false);

    const kioskUrl = activeHqId
        ? `${typeof window !== "undefined" ? window.location.origin : "https://app.zendity.com"}/reception?hqId=${activeHqId}`
        : `${typeof window !== "undefined" ? window.location.origin : "https://app.zendity.com"}/reception`;

    useEffect(() => {
        if (!activeHqId) return;
        setLoading(true);
        fetch(`/api/reception/hq-info?hqId=${activeHqId}`)
            .then(r => r.json())
            .then(d => setHqInfo(d))
            .finally(() => setLoading(false));
    }, [activeHqId]);

    const copyUrl = () => {
        navigator.clipboard.writeText(kioskUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const openKiosk = () => {
        window.open(kioskUrl, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="max-w-4xl mx-auto pb-16 p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Monitor className="w-6 h-6 text-teal-600" />
                        Configuración del Kiosco de Recepción
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Despliega el kiosco en una tablet o pantalla en la entrada de tu sede
                    </p>
                </div>
                {loading && (
                    <RefreshCw className="w-5 h-5 text-slate-400 animate-spin mt-1" />
                )}
            </div>

            {/* Sede activa */}
            {hqInfo && (
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        {hqInfo.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={hqInfo.logoUrl} alt={hqInfo.name} className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                            <Globe className="w-5 h-5 text-white" />
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-teal-900">{hqInfo.name}</p>
                        {hqInfo.phone && <p className="text-xs text-teal-700">{hqInfo.phone}</p>}
                    </div>
                    <span className="ml-auto text-xs bg-teal-200 text-teal-800 px-3 py-1 rounded-full font-semibold">
                        Sede activa
                    </span>
                </div>
            )}

            {/* URL del kiosco */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                    URL del Kiosco
                </h2>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <code className="flex-1 text-sm text-slate-700 font-mono break-all">
                        {kioskUrl}
                    </code>
                    <button
                        onClick={copyUrl}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        {copied ? (
                            <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado</>
                        ) : (
                            <><Copy className="w-3.5 h-3.5" /> Copiar</>
                        )}
                    </button>
                </div>
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={openKiosk}
                        className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Abrir Kiosco
                    </button>
                    <a
                        href="/reception/visits"
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
                    >
                        Ver Registro de Visitas
                    </a>
                </div>
            </div>

            {/* QR Code */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Código QR
                </h2>
                <p className="text-xs text-slate-500 mb-5">
                    Escanea con una tablet o celular para abrir el kiosco directamente
                </p>
                <QRCodeDisplay url={kioskUrl} />
            </div>

            {/* Instrucciones */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                    Instrucciones de Configuración
                </h2>
                <ol className="space-y-4">
                    {[
                        {
                            icon: <Smartphone className="w-5 h-5 text-teal-600" />,
                            title: "Prepara el dispositivo",
                            desc: "Usa una tablet Android o iPad con Chrome/Safari. Conecta a internet y activa el modo no molestar."
                        },
                        {
                            icon: <Globe className="w-5 h-5 text-teal-600" />,
                            title: "Abre la URL del kiosco",
                            desc: "Copia el enlace de arriba o escanea el código QR con la cámara de la tablet."
                        },
                        {
                            icon: <Monitor className="w-5 h-5 text-teal-600" />,
                            title: "Activa pantalla completa",
                            desc: 'En Chrome: menú ⋮ → "Añadir a pantalla de inicio". En iPad: Safari → Compartir → "Añadir a inicio". Esto oculta la barra del navegador.'
                        },
                        {
                            icon: <QrCode className="w-5 h-5 text-teal-600" />,
                            title: "Ubica el dispositivo",
                            desc: "Coloca la tablet en la recepción orientada hacia los visitantes. Conecta a corriente. El kiosco funciona 24/7 sin necesidad de login."
                        },
                    ].map((step, i) => (
                        <li key={i} className="flex items-start gap-4">
                            <div className="w-8 h-8 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                                {step.icon}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">
                                    <span className="text-teal-600 font-bold mr-1">{i + 1}.</span>
                                    {step.title}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>

            {/* Capacidades del kiosco */}
            <div className="bg-slate-800 rounded-2xl p-6 text-white">
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
                    Capacidades del Kiosco Zéndity
                </h2>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { emoji: "🎙️", label: "Reconocimiento de voz en español" },
                        { emoji: "🤖", label: "Zendi AI responde preguntas" },
                        { emoji: "📋", label: "Registro automático de visitas" },
                        { emoji: "📞", label: "Muestra teléfono de la sede" },
                        { emoji: "🔊", label: "Síntesis de voz (TTS)" },
                        { emoji: "📱", label: "Sin login — funciona 24/7" },
                    ].map((cap, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-700 rounded-xl p-3">
                            <span className="text-xl">{cap.emoji}</span>
                            <span className="text-xs font-medium text-slate-200">{cap.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
