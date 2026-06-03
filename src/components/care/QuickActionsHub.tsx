"use client";

import { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";

/**
 * QuickActionsHub — modal del set de "acciones rápidas" (reportes operacionales).
 *
 * Réplica del HUB que vive embebido en /care (la tablet del cuidador). Aquí
 * empacado como componente reutilizable para montar en el wall del supervisor.
 *
 * Cubre 4 chips (NO incluye Caída — flujo Morse queda solo en /care):
 *   - 🩺 CLINICAL    Cambio Clínico u Observación  → /api/care/vitals (LOG isAlert)
 *   - 🤝 COMPLAINT   Queja / Situación Familiar    → /api/care/reports/complaint
 *   - 🔧 MAINTENANCE Incidente de Mantenimiento    → /api/care/incidents
 *   - 🩹 UPP_ALERT   Alerta Piel / UPP             → /api/care/vitals (LOG isAlert)
 *
 * El endpoint de Complaint hace lookup del user para prefijo correcto (saneado
 * en este sprint). Los otros endpoints aceptan SUPERVISOR/DIRECTOR/ADMIN/NURSE
 * desde antes.
 */

type HubAction = "CLINICAL" | "COMPLAINT" | "MAINTENANCE" | "UPP_ALERT";

interface PatientLite {
    id: string;
    name: string;
    roomNumber?: string | null;
}

interface QuickActionsHubProps {
    open: boolean;
    onClose: () => void;
    currentUserId: string;
    /** Pacientes precargados — si no se pasan, el HUB hace fetch a patients-lite. */
    patients?: PatientLite[];
    /** Callback opcional cuando un reporte se envía (para refrescar listas). */
    onReported?: (action: HubAction) => void;
}

const TAGS: Record<HubAction, string[]> = {
    CLINICAL: ['Agresividad', 'Fiebre Alta', 'Dolor Fuerte', 'Aislamiento Social', 'Rechazo a Medicamento', 'Cambio en Piel'],
    COMPLAINT: ['Duda Médica', 'Desacuerdo Cuidado', 'Petición Excepcional', 'Objeto Perdido', 'Calidad Comida'],
    UPP_ALERT: ['Enrojecimiento Temprano', 'Piel Rota', 'Drenaje Leve', 'Dolor al Tacto', 'Zona Sacra', 'Talones', 'Cambio Urgente'],
    MAINTENANCE: [],
};

const MAINT_AREAS = ['Habitación', 'Baño', 'Sala Común', 'Cocina', 'Pasillo', 'Oficina', 'Exterior'];

export function QuickActionsHub({ open, onClose, currentUserId, patients: patientsProp, onReported }: QuickActionsHubProps) {
    const [action, setAction] = useState<HubAction | null>(null);
    const [patientId, setPatientId] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [room, setRoom] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [patients, setPatients] = useState<PatientLite[]>(patientsProp ?? []);
    const [loadingPatients, setLoadingPatients] = useState(false);

    // Carga de pacientes si no vinieron por prop
    useEffect(() => {
        if (!open || patientsProp) return;
        let cancelled = false;
        setLoadingPatients(true);
        fetch('/api/care/supervisor/patients-lite')
            .then(r => r.json())
            .then(d => { if (!cancelled && d.success) setPatients(d.patients); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoadingPatients(false); });
        return () => { cancelled = true; };
    }, [open, patientsProp]);

    // Reset al cerrar
    useEffect(() => {
        if (!open) {
            setAction(null);
            setPatientId("");
            setDescription("");
            setLocation("");
            setRoom("");
        }
    }, [open]);

    if (!open) return null;

    const submit = async () => {
        if (action !== 'MAINTENANCE' && !patientId) { alert("Seleccione un residente."); return; }
        if (!description) { alert("Agregue una descripción del incidente."); return; }
        setSubmitting(true);
        try {
            let endpoint = "";
            let payload: any = {};

            if (action === "COMPLAINT") {
                endpoint = "/api/care/reports/complaint";
                payload = { patientId, authorId: currentUserId, description, type: "COMPLAINT" };
            } else if (action === "UPP_ALERT") {
                endpoint = "/api/care/vitals";
                payload = {
                    patientId, authorId: currentUserId, type: 'LOG',
                    data: { bathCompleted: false, foodIntake: 100, notes: "[ALERTA UPP/PIEL] " + description, isAlert: true },
                };
            } else if (action === "CLINICAL") {
                endpoint = "/api/care/vitals";
                payload = {
                    patientId, authorId: currentUserId, type: 'LOG',
                    data: { bathCompleted: false, foodIntake: 100, notes: "[ALERTA CLÍNICA] " + description, isAlert: true },
                };
            } else if (action === "MAINTENANCE") {
                endpoint = "/api/care/incidents";
                const locationParts = [location, room ? `Hab. ${room}` : ''].filter(Boolean);
                const locationPrefix = locationParts.length > 0 ? `📍 ${locationParts.join(' · ')} | ` : '';
                payload = {
                    patientId: patientId || null,
                    type: 'OTHER',
                    severity: 'LOW',
                    description: locationPrefix + description,
                    biometricSignature: currentUserId || "N/A",
                };
            }

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                alert(`Reporte ${action} enviado a Central.`);
                onReported?.(action!);
                onClose();
            } else {
                alert("Error: " + (data.error || "no se pudo enviar"));
            }
        } catch (e: any) {
            alert("Error de red: " + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const labelByAction: Record<HubAction, string> = {
        CLINICAL: 'Clínico',
        COMPLAINT: 'Familiar',
        MAINTENANCE: 'Mantenimiento',
        UPP_ALERT: 'UPP/Piel',
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl relative my-8" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-slate-100 text-slate-500 rounded-full font-bold hover:bg-slate-200 hover:text-slate-800 transition-colors z-20 flex items-center justify-center">
                    <X className="w-5 h-5" />
                </button>

                <p className="font-black text-slate-800 uppercase text-lg border-b-2 border-slate-100 pb-2">⚡ Acciones Rápidas</p>

                {!action ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <button onClick={() => setAction("CLINICAL")} className="flex items-center gap-4 bg-purple-50 hover:bg-purple-100 border border-purple-200 p-5 rounded-2xl transition-all shadow-sm text-left active:scale-95">
                            <span className="text-4xl drop-shadow-sm">🩺</span>
                            <div>
                                <p className="font-black text-purple-900 text-base leading-tight">Cambio Clínico u Observación</p>
                                <p className="font-bold text-purple-700/70 text-xs mt-1">Fiebre, Dolor, Comportamiento</p>
                            </div>
                        </button>
                        <button onClick={() => setAction("COMPLAINT")} className="flex items-center gap-4 bg-orange-50 hover:bg-orange-100 border border-orange-200 p-5 rounded-2xl transition-all shadow-sm text-left active:scale-95">
                            <span className="text-4xl drop-shadow-sm">🤝</span>
                            <div>
                                <p className="font-black text-orange-900 text-base leading-tight">Queja o Situación Familiar</p>
                                <p className="font-bold text-orange-700/70 text-xs mt-1">Visitantes, Desacuerdos</p>
                            </div>
                        </button>
                        <button onClick={() => setAction("MAINTENANCE")} className="flex items-center gap-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 p-5 rounded-2xl transition-all shadow-sm text-left active:scale-95">
                            <span className="text-4xl drop-shadow-sm">🔧</span>
                            <div>
                                <p className="font-black text-slate-700 text-base leading-tight">Incidente de Mantenimiento</p>
                                <p className="font-bold text-slate-500 text-xs mt-1">Derrames, Luces, Limpieza</p>
                            </div>
                        </button>
                        <button onClick={() => setAction("UPP_ALERT")} className="flex items-center gap-4 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 p-5 rounded-2xl transition-all shadow-sm text-left active:scale-95">
                            <span className="text-4xl drop-shadow-sm">🩹</span>
                            <div>
                                <p className="font-black text-fuchsia-900 text-base leading-tight">Alerta Piel / UPP</p>
                                <p className="font-bold text-fuchsia-700/70 text-xs mt-1">Enrojecimiento, Herida Nueva</p>
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="mt-4 space-y-4">
                        <button onClick={() => setAction(null)} className="text-sm font-bold text-indigo-500">← Cambiar Tipo de Reporte</button>

                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                            <label className="text-sm font-bold text-slate-500 block mb-2">
                                Residente Involucrado {action === 'MAINTENANCE' ? <span className="font-normal text-slate-400">(opcional)</span> : '(Requerido)'}
                            </label>
                            <select
                                value={patientId}
                                onChange={e => setPatientId(e.target.value)}
                                disabled={loadingPatients}
                                className="w-full p-4 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-800 outline-none focus:border-indigo-500"
                            >
                                <option value="">
                                    {loadingPatients
                                        ? '-- Cargando residentes... --'
                                        : action === 'MAINTENANCE'
                                            ? '-- Sin residente relacionado --'
                                            : '-- Seleccionar Residente --'}
                                </option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}{p.roomNumber ? ` · Hab ${p.roomNumber}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 shadow-inner">
                            <label className="text-sm font-black text-indigo-900 uppercase tracking-widest block mb-3">
                                Descripción · Quick tags abajo
                            </label>

                            {TAGS[action].length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {TAGS[action].map(tag => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => setDescription(prev => prev ? `${prev}, ${tag}` : tag)}
                                            className="bg-white border border-indigo-200 text-indigo-700 font-bold text-xs px-3 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors shadow-sm active:scale-95"
                                        >
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {action === 'MAINTENANCE' && (
                                <div className="space-y-4 mb-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Área / Zona</p>
                                        <div className="flex flex-wrap gap-2">
                                            {MAINT_AREAS.map(area => (
                                                <button
                                                    key={area}
                                                    type="button"
                                                    onClick={() => setLocation(prev => prev === area ? '' : area)}
                                                    className={`text-xs font-bold px-3 py-2 rounded-xl border-2 transition-all active:scale-95 ${location === area ? 'bg-slate-700 text-white border-slate-700 shadow' : 'bg-white border-slate-300 text-slate-600 hover:border-slate-500'}`}
                                                >
                                                    {area}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Habitación / Número (opcional)</p>
                                        <input
                                            type="text"
                                            value={room}
                                            onChange={e => setRoom(e.target.value)}
                                            placeholder="ej. 1-05"
                                            className="w-full p-3 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-800 outline-none focus:border-slate-500"
                                        />
                                    </div>
                                </div>
                            )}

                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Describe el evento..."
                                rows={4}
                                className="w-full p-3 rounded-xl border-2 border-indigo-200 bg-white text-slate-800 outline-none focus:border-indigo-500 resize-none"
                            />
                        </div>

                        <button
                            onClick={submit}
                            disabled={submitting || (action !== 'MAINTENANCE' && !patientId) || !description}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black rounded-xl transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Codificando Alerta...</> : `Generar Ticket ${labelByAction[action]}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default QuickActionsHub;
