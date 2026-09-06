"use client";

import { useState } from "react";

/**
 * DOS SALIDAS, Y CADA UNA DICE LO QUE ES.
 *
 * "Descargar PDF" genera un documento: membrete en CADA hoja, "Página 2 de 3",
 * márgenes fijos. Es el que se entrega, porque puede acabar suelto sobre una
 * mesa y la hoja 3 tiene que decir de qué hogar y de qué período es.
 *
 * "Imprimir" sigue siendo la pantalla — que desde sep-2026 ya sale limpia, sin
 * barras y sin recortes. Vale para una copia rápida, y el navegador le pone su
 * propia cabecera con la URL salvo que la persona la desmarque.
 *
 * Se dejan las dos porque son dos usos distintos, no dos versiones de lo mismo.
 */
export default function PrintButton({ from, to }: { from?: string; to?: string }) {
    const [bajando, setBajando] = useState(false);

    const descargar = () => {
        setBajando(true);
        const q = new URLSearchParams();
        if (from) q.set('from', from);
        if (to) q.set('to', to);
        // Navegación directa: el navegador se encarga de la descarga y el
        // Content-Disposition del servidor le pone el nombre.
        window.location.href = `/api/reception/visits/pdf${q.toString() ? `?${q}` : ''}`;
        setTimeout(() => setBajando(false), 2500);
    };

    return (
        <div className="print:hidden flex items-center gap-2">
            <button
                onClick={descargar}
                disabled={bajando}
                className="bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-bold px-5 py-2 rounded-xl text-sm transition-all"
            >
                {bajando ? 'Generando…' : 'Descargar PDF'}
            </button>
            <button
                onClick={() => window.print()}
                title="Imprime la pantalla. Para entregar, usa Descargar PDF."
                className="bg-white/10 hover:bg-white/20 text-slate-300 font-bold px-4 py-2 rounded-xl text-sm transition-all"
            >
                Imprimir
            </button>
        </div>
    );
}
