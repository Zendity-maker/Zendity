"use client";

/**
 * CIERRE DE LAS VISITAS QUE QUEDARON ABIERTAS
 * ──────────────────────────────────────────
 * Aparece solo cuando hay alguna, y solo para quien puede cerrarlas.
 *
 * La hora de salida solo sirve si la gente la marca, y no la van a marcar
 * siempre. Sin esto, la lista de "quién está en el edificio" acumula gente que
 * se fue hace días y deja de servir para lo único que sirve.
 *
 * Lo que se registra es que ALGUIEN DEL PERSONAL dio la visita por terminada,
 * no una hora de salida inventada. La bitácora lo dirá con esas palabras.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CerrarSalidas({ abiertas }: { abiertas: { id: string; visitorName: string }[] }) {
    const router = useRouter();
    const [cerrando, setCerrando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (abiertas.length === 0) return null;

    const cerrar = async () => {
        const nombres = abiertas.slice(0, 3).map(v => v.visitorName).join(', ');
        const resto = abiertas.length > 3 ? ` y ${abiertas.length - 3} más` : '';
        if (!confirm(
            `Se van a cerrar ${abiertas.length} visita${abiertas.length === 1 ? '' : 's'} sin salida registrada:\n\n${nombres}${resto}\n\n` +
            `Quedará anotado que las cerró usted, y que el visitante no registró su salida. No se inventa ninguna hora.`
        )) return;

        setCerrando(true);
        setError(null);
        try {
            const res = await fetch('/api/reception/cerrar-salida', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visitIds: abiertas.map(v => v.id) }),
            });
            const d = await res.json();
            if (!d.success) { setError(d.error || 'No se pudo cerrar'); return; }
            router.refresh();
        } catch {
            setError('Error de red');
        } finally {
            setCerrando(false);
        }
    };

    return (
        <div className="no-print flex items-center gap-3">
            {error && <span className="text-amber-400 text-xs">{error}</span>}
            <button
                onClick={cerrar}
                disabled={cerrando}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-50"
            >
                {cerrando ? 'Cerrando…' : `Cerrar ${abiertas.length} sin salida`}
            </button>
        </div>
    );
}
