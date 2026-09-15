"use client";

import { useState } from "react";
import { QrCode, ExternalLink } from "lucide-react";

interface Props {
    url: string;
}

/**
 * Muestra un código QR usando la API pública de qrserver.com.
 * No requiere dependencias adicionales.
 */
export default function QRCodeDisplay({ url }: Props) {
    const [imgError, setImgError] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0f172a&margin=2`;

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
            <div className="relative">
                {/* Skeleton mientras carga */}
                {!loaded && (
                    <div className="w-[220px] h-[220px] bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center absolute inset-0">
                        <QrCode className="w-10 h-10 text-slate-300" />
                    </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={qrApiUrl}
                    alt="QR code del kiosco"
                    width={220}
                    height={220}
                    className={`rounded-xl border-2 border-slate-200 shadow-sm transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setLoaded(true)}
                    onError={() => setImgError(true)}
                />
            </div>
            <p className="text-xs text-slate-500 text-center">
                Escanea con la cámara del dispositivo (sin app)
            </p>
        </div>
    );
}
