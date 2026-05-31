"use client";

import { useState } from "react";
import { QrCode, ExternalLink } from "lucide-react";

interface Props {
    url: string;
    /** Etiqueta opcional al pie. Por defecto: "Escanea con la cámara…" */
    caption?: string;
    /** Tamaño del QR en píxeles (lado). Default 220. */
    size?: number;
}

/**
 * Componente compartido para mostrar un código QR.
 * Usa la API pública de qrserver.com — sin dependencias adicionales.
 *
 * Se usa en:
 *   - /corporate/reception-setup (kiosko de recepción de familias)
 *   - /corporate/admin/external-services (kiosko de servicios externos)
 *
 * Convención: SIEMPRE pasar la URL completa que se quiere codificar.
 * El componente maneja loading state, error state y fallback con link directo.
 */
export default function QRCodeDisplay({ url, caption, size = 220 }: Props) {
    const [imgError, setImgError] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0f172a&margin=2`;

    if (imgError) {
        return (
            <div className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-xl border border-slate-200">
                <QrCode className="w-12 h-12 text-slate-300" />
                <p className="text-xs text-slate-500 text-center">No se pudo cargar el QR.</p>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-teal-600 font-semibold underline"
                >
                    <ExternalLink className="w-3 h-3" /> Abrir enlace directo
                </a>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative" style={{ width: size, height: size }}>
                {/* Skeleton mientras carga */}
                {!loaded && (
                    <div
                        className="bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center absolute inset-0"
                        style={{ width: size, height: size }}
                    >
                        <QrCode className="w-10 h-10 text-slate-300" />
                    </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={qrApiUrl}
                    alt="QR code del kiosco"
                    width={size}
                    height={size}
                    className={`rounded-xl border-2 border-slate-200 shadow-sm transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setLoaded(true)}
                    onError={() => setImgError(true)}
                />
            </div>
            <p className="text-xs text-slate-500 text-center">
                {caption || "Escanea con la cámara del dispositivo (sin app)"}
            </p>
        </div>
    );
}
