"use client";

import { useState } from "react";
import { XMarkIcon, ExclamationCircleIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";

interface DeclareUlcerModalProps {
    isOpen: boolean;
    onClose: () => void;
    patients: { id: string; name: string }[];
    onCreated?: (ulcerId: string) => void;
}

export default function DeclareUlcerModal({ isOpen, onClose, patients, onCreated }: DeclareUlcerModalProps) {
    const [selectedPatient, setSelectedPatient] = useState("");
    const [location, setLocation] = useState("");
    const [stage, setStage] = useState("1");
    const [treatment, setTreatment] = useState("");
    const [woundSize, setWoundSize] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const resetForm = () => {
        setSelectedPatient("");
        setLocation("");
        setStage("1");
        setTreatment("");
        setWoundSize("");
        setNotes("");
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/care/upp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: selectedPatient,
                    stage: parseInt(stage, 10),
                    bodyLocation: location.trim(),
                    treatmentApplied: treatment.trim() || "Declaración inicial — tratamiento pendiente",
                    notes: notes.trim() || undefined,
                    woundSize: woundSize.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                onCreated?.(data.ulcerId);
                resetForm();
                onClose();
            } else {
                setError(data.error || "Error registrando úlcera");
            }
        } catch (err) {
            setError("Error de conexión");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">

                {/* Cabecera del Modal */}
                <div className="bg-rose-50 px-6 py-4 flex items-center justify-between border-b border-rose-100 sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-rose-900 flex items-center gap-2">
                        <ExclamationCircleIcon className="w-6 h-6 text-rose-600" />
                        Declaración de Nueva UPP
                    </h2>
                    <button onClick={onClose} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-full transition">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Formulario Clínico */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Residente Afectado</label>
                        <select
                            required
                            value={selectedPatient}
                            onChange={(e) => setSelectedPatient(e.target.value)}
                            className="w-full bg-neutral-50 border border-neutral-200 text-slate-800 text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3"
                        >
                            <option value="" disabled>Seleccione un Residente...</option>
                            {patients.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Ubicación Anatómica</label>
                        <input
                            required
                            type="text"
                            placeholder="Ej. Talón Derecho, Sacro, Trocánter..."
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full bg-neutral-50 border border-neutral-200 text-slate-800 text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-3">Etapa Clínica (Stage classification)</label>
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { level: "1", desc: "Enrojecimiento", color: "bg-yellow-100 border-yellow-200 text-yellow-800" },
                                { level: "2", desc: "Pérdida parcial", color: "bg-orange-100 border-orange-200 text-orange-800" },
                                { level: "3", desc: "Pérdida total", color: "bg-red-100 border-red-200 text-red-800" },
                                { level: "4", desc: "Tejido profundo", color: "bg-rose-100 border-rose-300 text-rose-900" },
                            ].map(s => (
                                <label key={s.level} className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center justify-center text-center transition ${stage === s.level ? `ring-2 ring-offset-1 ring-slate-400 ${s.color}` : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50'}`}>
                                    <input type="radio" value={s.level} checked={stage === s.level} onChange={(e) => setStage(e.target.value)} className="sr-only" />
                                    <span className="font-bold text-lg leading-none mb-1">Stg {s.level}</span>
                                    <span className="text-[10px] uppercase font-semibold leading-tight">{s.desc}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tratamiento Aplicado</label>
                        <input
                            type="text"
                            placeholder="Ej. Limpieza con solución salina + vendaje hidrocoloide"
                            value={treatment}
                            onChange={(e) => setTreatment(e.target.value)}
                            className="w-full bg-neutral-50 border border-neutral-200 text-slate-800 text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Tamaño (opcional)</label>
                            <input
                                type="text"
                                placeholder="Ej. 2x3 cm"
                                value={woundSize}
                                onChange={(e) => setWoundSize(e.target.value)}
                                className="w-full bg-neutral-50 border border-neutral-200 text-slate-800 text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Notas Clínicas (opcional)</label>
                        <textarea
                            rows={2}
                            placeholder="Contexto adicional, observaciones..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-neutral-50 border border-neutral-200 text-slate-800 text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3 resize-none"
                        />
                    </div>

                    <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm border border-blue-100 flex gap-3 mt-6">
                        <DocumentCheckIcon className="w-6 h-6 flex-shrink-0 text-blue-600" />
                        <p>Al declarar esta úlcera, se crea un <b>TriageTicket</b> y se notifica a supervisores.</p>
                    </div>

                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs font-bold text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="pt-4 flex gap-3 border-t border-neutral-100">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition">
                            Cancelar
                        </button>
                        <button disabled={isSubmitting} type="submit" className="flex-1 py-3 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition disabled:opacity-70 disabled:cursor-not-allowed">
                            {isSubmitting ? 'Registrando...' : 'Firmar y Registrar UPP'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
