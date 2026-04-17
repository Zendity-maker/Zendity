"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Botón fijo que devuelve al dashboard clínico con sidebar (/).
 * Integrado automáticamente en AppLayout para toda ruta /care/*
 * excepto /care exacto (la tablet del cuidador tiene su propia nav).
 */
export default function BackToDashboard() {
    const router = useRouter();
    return (
        <button
            onClick={() => router.push("/")}
            className="fixed top-3 left-3 z-50 flex items-center gap-1.5 bg-slate-800/80 backdrop-blur text-white text-sm font-bold rounded-lg px-3 py-2 hover:bg-slate-700 transition-colors shadow-lg border border-slate-700/50"
            aria-label="Volver al dashboard clínico"
        >
            <ChevronLeft className="w-4 h-4" />
            Dashboard
        </button>
    );
}
