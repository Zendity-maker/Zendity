"use client";

import { useState } from "react";
import { Pill, AlertCircle, Save, Loader2, X } from "lucide-react";

type Medication = {
    id: string;
    name: string;
    dosage: string;
    route: string;
    category: string;
    condition: string | null;
    isControlled: boolean;
    requiresFridge: boolean;
    withFood: boolean;
};

type Props = {
    medication: Medication;
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
};

export default function EditMedicationModal({ medication, isOpen, onClose, onSaved }: Props) {
    const [formData, setFormData] = useState<Medication>({ ...medication });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            const res = await fetch("/api/med/catalog", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error("Error al guardar cambios");

            onSaved();
            onClose();
        } catch (err: any) {
            setError(err.message || "Error desconocido");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header (Zendity Teal Gradient Accent) */}
                <div className="bg-gradient-to-r from-zendity-teal to-teal-500 p-6 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <Pill className="w-6 h-6" />
                        <h2 className="text-xl font-bold font-display">Editar Medicamento</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm font-medium rounded-xl flex items-center gap-2 border border-red-100">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Comercial / Molécula</label>
                            <input
                                required
                                type="text"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-zendity-teal focus:border-zendity-teal outline-none transition uppercase text-deep-slate font-medium"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Dosis</label>
                            <input
                                required
                                type="text"
                                placeholder="Ej: 50mg"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-zendity-teal focus:border-zendity-teal outline-none transition text-deep-slate"
                                value={formData.dosage}
                                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Vía</label>
                            <select
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-zendity-teal focus:border-zendity-teal outline-none bg-white text-deep-slate transition"
                                value={formData.route}
                                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                            >
                                <option value="Oral">Oral</option>
                                <option value="Tópica">Tópica</option>
                                <option value="Intravenosa">Intravenosa</option>
                                <option value="Intramuscular">Intramuscular</option>
                                <option value="Subcutánea">Subcutánea</option>
                                <option value="Oftálmica">Oftálmica</option>
                                <option value="Ótica">Ótica</option>
                                <option value="Inhalatoria">Inhalatoria</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Categoría General</label>
                            <input
                                required
                                type="text"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-zendity-teal focus:border-zendity-teal outline-none transition text-deep-slate"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Condición Clínica (Tabs)</label>
                            <select
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-zendity-teal focus:border-zendity-teal outline-none bg-white text-deep-slate transition font-medium text-sm"
                                value={formData.condition || "Otros"}
                                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                            >
                                <option value="Ansiedad">Ansiedad</option>
                                <option value="Insomnio">Insomnio</option>
                                <option value="Dolor Físico">Dolor Físico</option>
                                <option value="Infección">Infección</option>
                                <option value="Cardiovascular">Cardiovascular</option>
                                <option value="Depresión">Depresión</option>
                                <option value="Gastrointestinal">Gastrointestinal</option>
                                <option value="Respiratorio">Respiratorio</option>
                                <option value="Convulsiones">Convulsiones</option>
                                <option value="Otros">Otros</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-soft-mist border border-gray-200 rounded-xl p-4 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={formData.isControlled}
                                onChange={(e) => setFormData({ ...formData, isControlled: e.target.checked })}
                                className="w-5 h-5 rounded border-gray-300 text-zendity-teal focus:ring-zendity-teal cursor-pointer"
                            />
                            <span className="text-sm font-medium text-deep-slate flex-1">Es medicamento controlado (Narcótico)</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={formData.requiresFridge}
                                onChange={(e) => setFormData({ ...formData, requiresFridge: e.target.checked })}
                                className="w-5 h-5 rounded border-gray-300 text-zendity-teal focus:ring-zendity-teal cursor-pointer"
                            />
                            <span className="text-sm font-medium text-deep-slate flex-1">Requiere Refrigeración (Nevera Clínica)</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={formData.withFood}
                                onChange={(e) => setFormData({ ...formData, withFood: e.target.checked })}
                                className="w-5 h-5 rounded border-gray-300 text-zendity-teal focus:ring-zendity-teal cursor-pointer"
                            />
                            <span className="text-sm font-medium text-deep-slate flex-1">Dosis obligatoria acompañada de comida</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-5 py-2.5 bg-zendity-teal hover:bg-teal-700 text-white text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isSaving ? "Guardando..." : "Guardar Cambios"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
