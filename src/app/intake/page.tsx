"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ZendityIntakePage() {
    const router = useRouter();
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form States
    const [name, setName] = useState("");
    const [diagnoses, setDiagnoses] = useState("");
    const [medicalHistory, setMedicalHistory] = useState("");
    const [allergies, setAllergies] = useState("Ninguna conocida");
    const [rawMeds, setRawMeds] = useState("");
    const [colorGroup, setColorGroup] = useState("UNASSIGNED");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !diagnoses || !rawMeds) return;
        setSubmitting(true);

        try {
            const payload = {
                name,
                headquartersId: user?.hqId || user?.headquartersId || "hq-demo-1", // Fallback seguro
                diagnoses,
                medicalHistory,
                allergies,
                rawMedications: rawMeds,
                colorGroup
            };

            const res = await fetch("/api/intake", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.success) {
                setSuccess(true);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-2xl mx-auto mt-20 p-10 bg-white rounded-3xl shadow-xl border border-emerald-100 text-center animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-6">✅</div>
                <h2 className="text-3xl font-black text-slate-800 mb-2">Ingreso Procesado Exitosamente</h2>
                <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
                    El <strong>Motor de Cascada</strong> ha distribuido los datos: El perfil fue creado en la base de datos, los medicamentos se despacharon a <strong>Zendity Med (eMAR)</strong> y la IA generó el borrador del <strong>Life Plan</strong> para Cuidadores.
                </p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => setSuccess(false)} className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Nuevo Ingreso</button>
                    <button onClick={() => router.push('/cuidadores')} className="px-6 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-lg hover:bg-teal-700 shadow-teal-500/30 transition-all">Ver Life Plan Autogenerado</button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8 border-b-2 border-slate-900 pb-4">
                <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
                    <span className="text-teal-600">📥</span> Zendity Intake
                </h1>
                <p className="text-slate-500 mt-2 text-lg font-medium">Unidad Única de Admisiones y Procesamiento de Residentes.</p>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 relative overflow-hidden">
                {/* Decorative corner */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-bl-[100px] -z-0"></div>

                <form onSubmit={handleSubmit} className="space-y-8 relative z-10">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Identidad & Demográfica</h3>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Nombre Completo del Residente</label>
                                <input
                                    type="text"
                                    className="w-full border-slate-200 rounded-xl focus:ring-teal-500 bg-slate-50 p-3 text-slate-900 font-semibold text-lg shadow-inner"
                                    placeholder="Ej: Doña Carmen Rodríguez"
                                    value={name} onChange={e => setName(e.target.value)} required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Color de Admisión (Zonificación)</label>
                                <select
                                    className="w-full border-slate-200 rounded-xl focus:ring-teal-500 bg-slate-50 p-3 text-slate-900 font-semibold text-lg shadow-inner"
                                    value={colorGroup} onChange={e => setColorGroup(e.target.value)} required
                                >
                                    <option value="UNASSIGNED">Sin Asignar</option>
                                    <option value="RED">🔴 Grupo Rojo (Alta Dependencia)</option>
                                    <option value="YELLOW">🟡 Grupo Amarillo (Cuidados Medios)</option>
                                    <option value="GREEN">🟢 Grupo Verde (Autónomos)</option>
                                    <option value="BLUE">🔵 Grupo Azul (Especializados)</option>
                                </select>
                                <p className="text-[11px] text-slate-400 mt-1 font-medium">Asigna un color para balancear la carga de los Cuidadores.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Alergias Conocidas</label>
                                <input
                                    type="text"
                                    className="w-full border-slate-200 rounded-xl focus:ring-teal-500 bg-emerald-50/30 border-emerald-100 p-3 text-emerald-900 font-semibold text-lg shadow-inner"
                                    value={allergies} onChange={e => setAllergies(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Expediente Médico Raw</h3>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Diagnósticos (Separados por coma)</label>
                                <textarea
                                    className="w-full border-slate-200 rounded-xl focus:ring-teal-500 bg-slate-50 p-3 min-h-[100px] text-slate-900 font-semibold text-lg shadow-inner"
                                    placeholder="Ej: Diabetes Tipo 2, Hipertensión, Disfagia moderada, Demencia Senil."
                                    value={diagnoses} onChange={e => setDiagnoses(e.target.value)} required
                                />
                                <p className="text-[11px] text-teal-600 mt-1 font-medium">La IA de Zendity leerá esto para redactar el Life Plan (PAI).</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Historial de Hospitalizaciones / Quirúrgico</label>
                            <textarea
                                className="w-full border-slate-200 rounded-xl focus:ring-teal-500 bg-slate-50 p-3 min-h-[120px] text-slate-900 font-semibold text-lg shadow-inner"
                                placeholder="Ej: Reemplazo de Cadera Derecha (2023). Marcapasos instalado en 2020. Propenso a caídas."
                                value={medicalHistory} onChange={e => setMedicalHistory(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 text-rose-600">Recetario / Listado de Medicinas</label>
                            <textarea
                                className="w-full border-rose-200 rounded-xl focus:ring-rose-500 bg-rose-50/50 p-3 min-h-[120px] text-rose-900 font-semibold text-lg shadow-inner"
                                placeholder="Ej: Metformina 500mg, Lisinopril 10mg, Tylenol Extra Fuerte."
                                value={rawMeds} onChange={e => setRawMeds(e.target.value)} required
                            />
                            <p className="text-[11px] text-rose-500 mt-1 font-medium">Estas recetas poblarán directamente el sistema eMAR (Cero Papeles).</p>
                        </div>
                    </div>

                    <div className="pt-6 mt-6 flex justify-end items-center gap-4 border-t border-slate-100">
                        <p className="text-xs text-slate-400 font-medium">Al presionar el botón, se iniciará el Flujo en Cascada.</p>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`px-10 py-4 rounded-xl font-bold text-white shadow-xl transition-all ${submitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-black hover:shadow-teal-500/20 active:scale-95'}`}
                        >
                            {submitting ? 'Orquestando Datos...' : 'Procesar Ingreso a Zendity'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
