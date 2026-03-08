"use client";

import { useState } from "react";
import { XMarkIcon, ExclamationCircleIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";

interface DeclareUlcerModalProps {
    isOpen: boolean;
    onClose: () => void;
    patients: { id: string; name: string }[];
}

export default function DeclareUlcerModal({ isOpen, onClose, patients }: DeclareUlcerModalProps) {
    const [selectedPatient, setSelectedPatient] = useState("");
    const [location, setLocation] = useState("");
    const [stage, setStage] = useState("1");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Simulación de Network Request (Prisma Next Iteration)
        setTimeout(() => {
            setIsSubmitting(false);
            onClose();
        }, 1200);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Cabecera del Modal */}
                <div className="bg-rose-50 px-6 py-4 flex items-center justify-between border-b border-rose-100">
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

                    <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm border border-blue-100 flex gap-3 mt-6">
                        <DocumentCheckIcon className="w-6 h-6 flex-shrink-0 text-blue-600" />
                        <p>Al declarar esta úlcera, el sistema iniciará una <b>Bitácora de Curación ("UlcerLog")</b> oficial vinculada al expediente del residente para seguimiento del Departamento de Salud.</p>
                    </div>

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
