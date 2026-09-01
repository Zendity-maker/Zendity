"use client";

/**
 * HORA DEL REGISTRO
 * ─────────────────
 * Hasta ago-2026 el baño, el desayuno y el medicamento salían a la misma hora
 * en la auditoría de turno: la hora en que la cuidadora se sentaba con la
 * tableta. No era falta de disciplina — el sistema sellaba `now()` y no tenía
 * dónde guardar la hora real.
 *
 * Este control deja que ella lo diga. Por defecto es "Ahora", que es el caso
 * normal y no cuesta ni un toque. Cuando NO es ahora se pone ámbar y no se
 * puede ignorar: registrar veinte cosas sin darse cuenta de que quedó fijado
 * en las 7:00 sería peor que el problema que vinimos a resolver.
 *
 * Ver src/lib/hora-real.ts para los límites que aplica el servidor.
 */

const RELATIVOS = [
    { etiqueta: '30 min', minutos: 30 },
    { etiqueta: '1 h',    minutos: 60 },
    { etiqueta: '2 h',    minutos: 120 },
] as const;

function hhmm(d: Date) {
    return d.toLocaleTimeString('es-PR', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function HoraDelRegistro({
    valor,
    onChange,
}: {
    /** null = ahora (el caso normal) */
    valor: Date | null;
    onChange: (d: Date | null) => void;
}) {
    const esAhora = valor === null;

    return (
        <div
            className={
                'rounded-2xl border p-3 space-y-2 transition-colors ' +
                (esAhora
                    ? 'bg-white border-slate-200'
                    : 'bg-amber-50 border-amber-300')
            }
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                    ¿Cuándo se hizo?
                </p>
                {!esAhora && (
                    <button
                        onClick={() => onChange(null)}
                        className="text-[10px] font-black uppercase tracking-wide text-amber-700 underline"
                    >
                        Volver a ahora
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-1.5">
                <button
                    onClick={() => onChange(null)}
                    className={
                        'px-3 py-2 rounded-xl text-xs font-black transition-colors ' +
                        (esAhora
                            ? 'bg-[#0F6B78] text-white'
                            : 'bg-white text-slate-600 border border-slate-200')
                    }
                >
                    Ahora
                </button>

                {RELATIVOS.map((r) => {
                    // Se recalcula contra el reloj en cada toque: "hace 1 h" debe
                    // significar una hora antes de AHORA, no antes de lo que ya
                    // estuviera seleccionado (eso se iría acumulando hacia atrás).
                    const activo =
                        !esAhora &&
                        Math.abs(
                            (Date.now() - valor!.getTime()) / 60000 - r.minutos,
                        ) < 1;
                    return (
                        <button
                            key={r.minutos}
                            onClick={() =>
                                onChange(new Date(Date.now() - r.minutos * 60000))
                            }
                            className={
                                'px-3 py-2 rounded-xl text-xs font-black transition-colors ' +
                                (activo
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-white text-slate-600 border border-slate-200')
                            }
                        >
                            hace {r.etiqueta}
                        </button>
                    );
                })}

                <input
                    type="time"
                    value={valor ? `${String(valor.getHours()).padStart(2, '0')}:${String(valor.getMinutes()).padStart(2, '0')}` : ''}
                    onChange={(e) => {
                        const [h, m] = e.target.value.split(':').map(Number);
                        if (isNaN(h) || isNaN(m)) return;
                        const d = new Date();
                        d.setHours(h, m, 0, 0);
                        // Una hora que aún no ha llegado hoy es de ayer: a las
                        // 00:30 registrar "11:00 PM" es el turno de noche.
                        if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);
                        onChange(d);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-white text-slate-600 border border-slate-200"
                />
            </div>

            {!esAhora && (
                <p className="text-[11px] font-bold text-amber-800">
                    Se registrará como las <strong>{hhmm(valor!)}</strong>. Queda guardado
                    también a qué hora lo escribiste.
                </p>
            )}
        </div>
    );
}
