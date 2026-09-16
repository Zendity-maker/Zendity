"use client";

/**
 * MARCAR UNA AUSENCIA — el motivo y si avisó.
 *
 * Vivía dentro de /hr/schedule, y ese es el problema que este componente
 * resuelve: las ausencias NO se marcan desde el constructor de horarios, se
 * marcan desde el panel del supervisor, en el momento en que alguien no
 * aparece. Y ese camino mandaba solo el id del turno.
 *
 * La consecuencia no era un campo vacío. Cuando no se manda el aviso, la API
 * guarda `absenceNotified: false`, y el detector de patrones cuenta SOLO las
 * ausencias sin aviso para levantar una observación disciplinaria. O sea que
 * toda ausencia marcada desde el panel contaba como "faltó sin avisar" aunque
 * la persona hubiera llamado a las cinco de la mañana. El comentario de la
 * propia API lo dice: "penalizarlas igual castiga a quien hace las cosas bien".
 *
 * Medido el 14-sep-2026: las cuatro ausencias marcadas desde que existe este
 * diálogo (19-ago) tienen motivo nulo y avisó=false. Ninguna pasó por aquí.
 */
import { useState } from 'react';

export const ABSENCE_REASONS: { value: string; label: string; hint: string }[] = [
    { value: 'SICK', label: 'Enfermedad', hint: 'Se reportó enferma/o' },
    { value: 'FAMILY_EMERGENCY', label: 'Emergencia familiar', hint: 'Situación urgente en su familia' },
    { value: 'MEDICAL_APPOINTMENT', label: 'Cita médica', hint: 'Cita programada' },
    { value: 'PERSONAL', label: 'Asunto personal', hint: 'Motivo personal informado' },
    { value: 'NO_SHOW', label: 'No se presentó', hint: 'No llegó y no avisó' },
    { value: 'OTHER', label: 'Otro', hint: 'Detállalo en la nota' },
    /**
     * LA SALIDA HONESTA.
     *
     * El motivo es obligatorio, y una lista cerrada sin esta opción obliga a
     * elegir la menos equivocada: alguien pondría "Enfermedad" por no dejarlo en
     * blanco, y ese dato ya no se distingue nunca de una enfermedad de verdad.
     *
     * Se marca la ausencia a las siete de la mañana; el motivo llega cuando la
     * persona contesta el teléfono. Queda como trabajo pendiente en su perfil.
     */
    { value: 'PENDIENTE_CONFIRMAR', label: 'Todavía no se sabe', hint: 'Se completa después, desde su perfil' },
];

export interface DetalleAusencia {
    absenceReason: string;
    absenceNotified: boolean;
    absenceNotes?: string;
}

export default function DialogoMotivoAusencia({
    nombre, onCancel, onConfirm, inicial, titulo,
}: {
    /** De quién es la ausencia. Lo único que el diálogo necesita saber. */
    nombre: string;
    onCancel: () => void;
    onConfirm: (d: DetalleAusencia) => void;
    /** Para completar una ausencia ya marcada desde el perfil. */
    inicial?: Partial<DetalleAusencia>;
    titulo?: string;
}) {
    /**
     * SIN NADA PRESELECCIONADO, a propósito.
     *
     * Venía con 'SICK' puesto. Quien pulsara confirmar sin mirar registraba
     * "Enfermedad" sin haberlo elegido — un dato que después nadie distingue de
     * una enfermedad que sí se preguntó. Ahora hay que elegir.
     */
    const [reason, setReason] = useState(inicial?.absenceReason ?? '');
    const [notified, setNotified] = useState(inicial?.absenceNotified ?? true);
    const [notes, setNotes] = useState(inicial?.absenceNotes ?? '');
    // Un "no se presentó" es, por definición, sin aviso.
    const esNoShow = reason === 'NO_SHOW';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-800">{titulo ?? 'Marcar ausencia'}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{nombre}</p>
                </div>

                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Motivo</label>
                        <div className="space-y-1.5">
                            {ABSENCE_REASONS.map(r => (
                                <button
                                    key={r.value}
                                    type="button"
                                    onClick={() => { setReason(r.value); if (r.value === 'NO_SHOW') setNotified(false); }}
                                    className={`w-full text-left px-4 py-2.5 rounded-xl border transition-colors ${
                                        reason === r.value
                                            ? 'border-teal-500 bg-teal-50'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <span className="text-sm font-bold text-slate-800 block">{r.label}</span>
                                    <span className="text-[11px] text-slate-500">{r.hint}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">¿Avisó antes del turno?</label>
                        <div className="flex gap-2">
                            {[{ v: true, l: 'Sí avisó' }, { v: false, l: 'No avisó' }].map(o => (
                                <button
                                    key={String(o.v)}
                                    type="button"
                                    disabled={esNoShow}
                                    onClick={() => setNotified(o.v)}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                        notified === o.v ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600'
                                    }`}
                                >
                                    {o.l}
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 leading-snug">
                            {esNoShow
                                ? 'Un “no se presentó” cuenta siempre como sin aviso.'
                                : 'Solo las ausencias sin aviso cuentan para la detección de patrón disciplinario.'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Nota (opcional)</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder="Detalle que quieras dejar registrado"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm({ absenceReason: reason, absenceNotified: esNoShow ? false : notified, absenceNotes: notes.trim() || undefined })}
                        disabled={!reason}
                        className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {!reason ? 'Elige un motivo' : (titulo ? 'Guardar motivo' : 'Marcar ausente')}
                    </button>
                </div>
            </div>
        </div>
    );
}
