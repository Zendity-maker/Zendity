"use client";

/**
 * REGISTRAR UN INCIDENTE CLÍNICO — caída, error de medicación u otro.
 *
 * Vivía dentro de /corporate/incidents, y ahí no lo usó nadie: en cuatro meses
 * salieron 0 registros de esa pantalla. Las 8 caídas de Cupey entraron por la
 * tableta (7) y por el traslado al hospital (1). Errores de medicación: 0 en
 * total.
 *
 * Ese cero no significa que no hagan falta — significa que estaba en el sitio
 * equivocado. Un error de medicación lo levanta enfermería, no dirección. Por
 * eso el formulario se mudó entero, con sus tres tipos, en vez de borrarse.
 *
 * LA TABLETA NO SE TOCA. La cuidadora que presencia una caída la reporta desde
 * la tarjeta del residente, en el momento, y ese es el camino bueno: 7 de 8.
 * Esto es para lo que se escribe después — y por eso lo primero que pregunta
 * es cuándo ocurrió.
 */
import { useState } from "react";
import { ShieldAlert, Pill, FileWarning } from "lucide-react";

/**
 * Ahora, en el formato de <input type="datetime-local"> (hora local).
 * Puerto Rico es AST todo el año, sin horario de verano, así que la hora del
 * navegador y la del hogar son la misma.
 */
export function ahoraLocal(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

type Tipo = 'FALL' | 'MEDICATION_ERROR' | 'OTHER';

const META: Record<Tipo, { label: string; icon: React.ReactNode }> = {
    FALL:             { label: 'Caída',        icon: <ShieldAlert className="w-4 h-4" /> },
    MEDICATION_ERROR: { label: 'Medicación',   icon: <Pill className="w-4 h-4" /> },
    OTHER:            { label: 'Otro',         icon: <FileWarning className="w-4 h-4" /> },
};

export default function RegistrarIncidente({ residentes, onCerrar, onGuardado }: {
    residentes: { id: string; name: string; roomNumber?: string | null }[];
    onCerrar: () => void;
    onGuardado: () => void;
}) {
    const [tipo, setTipo] = useState<Tipo>('FALL');
    const [patientId, setPatientId] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [ubicacion, setUbicacion] = useState('');
    const [cuando, setCuando] = useState(ahoraLocal());
    const [consciente, setConsciente] = useState(true);
    const [sangrado, setSangrado] = useState(false);
    const [dolor, setDolor] = useState(0);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const esRetroactiva = !!cuando && Date.now() - new Date(cuando).getTime() > 24 * 60 * 60 * 1000;

    const guardar = async () => {
        if (!patientId && tipo !== 'OTHER') return setError('Selecciona un residente.');
        if (!descripcion.trim() && tipo !== 'FALL') return setError('La descripción es requerida.');
        setGuardando(true); setError('');
        try {
            const body: Record<string, unknown> = {
                type: tipo,
                patientId: patientId || undefined,
                description: descripcion || undefined,
            };
            if (tipo === 'FALL') {
                body.location = ubicacion;
                body.conscious = consciente;
                body.bleeding = sangrado;
                body.painLevel = dolor;
                // Si no se tocó el campo es ahora, que es lo mismo que hace el backend.
                if (cuando) body.incidentDate = new Date(cuando).toISOString();
            }
            const res = await fetch('/api/care/incidents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'No se pudo guardar.'); setGuardando(false); return; }
            // El backend puede responder "ya estaba registrada" — es un éxito,
            // no un error, y decirlo evita que se intente otra vez.
            if (data.duplicada) setError('');
            onGuardado();
        } catch { setError('Error de conexión.'); setGuardando(false); }
    };

    const campo = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300";
    const etiqueta = "block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-5 text-white">
                    <h3 className="text-lg font-black flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5" /> Registrar incidente clínico
                    </h3>
                    <p className="text-rose-100 text-xs mt-0.5">Supervisión, enfermería y dirección reciben el aviso.</p>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className={etiqueta}>Tipo</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(Object.keys(META) as Tipo[]).map(t => (
                                <button key={t} onClick={() => setTipo(t)}
                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-bold transition-all ${tipo === t ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                    {META[t].icon}
                                    {META[t].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className={etiqueta}>
                            Residente {tipo !== 'OTHER' && <span className="text-rose-500">*</span>}
                        </label>
                        <select value={patientId} onChange={e => setPatientId(e.target.value)} className={campo}>
                            <option value="">Seleccionar residente…</option>
                            {residentes.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}{p.roomNumber ? ` · Hab. ${p.roomNumber}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {tipo === 'FALL' && (
                        <>
                            <div>
                                <label className={etiqueta}>¿Cuándo ocurrió? <span className="text-rose-500">*</span></label>
                                <input type="datetime-local" value={cuando} max={ahoraLocal()}
                                    onChange={e => setCuando(e.target.value)} className={campo} />
                                {esRetroactiva ? (
                                    <p className="mt-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-snug">
                                        Se registra con esa fecha, no con la de hoy. Como ya pasó, no se
                                        avisa como emergencia: entra al expediente y a triage con
                                        prioridad baja.
                                    </p>
                                ) : (
                                    <p className="mt-1.5 text-xs text-slate-400">
                                        Viene puesta la hora de ahora. Cámbiala si la caída fue antes.
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className={etiqueta}>Ubicación</label>
                                <input value={ubicacion} onChange={e => setUbicacion(e.target.value)}
                                    placeholder="Baño, habitación, pasillo…" className={campo} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer">
                                    <input type="checkbox" checked={consciente} onChange={e => setConsciente(e.target.checked)}
                                        className="w-4 h-4 rounded accent-rose-500" />
                                    <span className="text-sm font-bold text-slate-700">Consciente</span>
                                </label>
                                <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer">
                                    <input type="checkbox" checked={sangrado} onChange={e => setSangrado(e.target.checked)}
                                        className="w-4 h-4 rounded accent-rose-500" />
                                    <span className="text-sm font-bold text-slate-700">Sangrado</span>
                                </label>
                            </div>
                            <div>
                                <label className={etiqueta}>
                                    Nivel de dolor: <span className="text-rose-600 font-black">{dolor}/10</span>
                                </label>
                                <input type="range" min={0} max={10} value={dolor}
                                    onChange={e => setDolor(Number(e.target.value))} className="w-full accent-rose-500" />
                            </div>
                        </>
                    )}

                    <div>
                        <label className={etiqueta}>
                            {tipo === 'FALL' ? 'Observaciones adicionales' : 'Descripción *'}
                        </label>
                        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3}
                            placeholder={tipo === 'FALL'
                                ? 'Ej. Intentó levantarse sin asistencia…'
                                : 'Describe qué pasó, con el detalle que haga falta…'}
                            className={`${campo} resize-none`} />
                    </div>

                    {error && <p className="text-sm text-rose-700 font-bold bg-rose-50 rounded-xl px-4 py-2">{error}</p>}
                </div>

                <div className="p-5 border-t border-slate-100 flex gap-3">
                    <button onClick={onCerrar}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={guardar} disabled={guardando}
                        className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        {guardando ? 'Guardando…' : 'Registrar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
