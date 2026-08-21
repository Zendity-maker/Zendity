"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, X } from "lucide-react";

interface Estado {
    pendiente: boolean;
    curso?: { titulo: string; minutos: number };
    dias?: number;
    plazo?: string;
    fechaLimite?: string;
}

/**
 * Aviso de la certificación pendiente, en el marco de la app.
 *
 * Vive aquí y no en una pantalla concreta porque el pedido era que lo vieran
 * VARIAS VECES: una notificación se descarta una vez y se olvida; esto aparece
 * en cada visita mientras el curso siga pendiente.
 *
 * Se puede cerrar, pero solo por la sesión del navegador — vuelve al siguiente
 * ingreso. Y desaparece para siempre en cuanto la persona aprueba el curso,
 * sin que nadie tenga que apagarlo.
 *
 * Se pone rojo en los últimos tres días. Antes de eso no grita: un aviso que
 * grita desde el día uno deja de significar algo para el día cinco.
 */
export default function AvisoCertificacion() {
    const [estado, setEstado] = useState<Estado | null>(null);
    const [cerrado, setCerrado] = useState(true);

    useEffect(() => {
        // sessionStorage, no localStorage: cerrar es para este rato, no para siempre.
        setCerrado(sessionStorage.getItem("aviso-certificacion-cerrado") === "1");
        fetch("/api/academy/mi-certificacion", { cache: "no-store" })
            .then(r => r.json())
            .then(d => { if (d.success) setEstado(d); })
            .catch(() => { /* accesorio: si falla, no se muestra nada */ });
    }, []);

    if (!estado?.pendiente || cerrado) return null;

    const urgente = (estado.dias ?? 99) <= 3;
    const vencido = (estado.dias ?? 99) < 0;

    const cerrar = () => {
        sessionStorage.setItem("aviso-certificacion-cerrado", "1");
        setCerrado(true);
    };

    return (
        <div
            className={`relative flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-3 border-b ${
                urgente || vencido
                    ? "bg-rose-50 border-rose-200"
                    : "bg-teal-50 border-teal-200"
            }`}
        >
            <span
                className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center ${
                    urgente || vencido ? "bg-rose-100 text-rose-700" : "bg-teal-100 text-teal-700"
                }`}
            >
                <GraduationCap className="w-5 h-5" />
            </span>

            <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm leading-snug">
                    Te falta tu certificación: {estado.curso?.titulo}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                    {vencido
                        ? `El plazo venció el ${estado.fechaLimite}. Complétalo cuanto antes.`
                        : `${estado.plazo} — hasta el ${estado.fechaLimite}. Son ${estado.curso?.minutos} minutos y puedes hacerlo desde tu teléfono.`}
                </p>
            </div>

            <Link
                href="/academy"
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors ${
                    urgente || vencido ? "bg-rose-600 hover:bg-rose-700" : "bg-teal-600 hover:bg-teal-700"
                }`}
            >
                Tomar el curso
            </Link>

            <button
                onClick={cerrar}
                aria-label="Cerrar aviso"
                className="absolute top-2 right-2 sm:static sm:ml-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
