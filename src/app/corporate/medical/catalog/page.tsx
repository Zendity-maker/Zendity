"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Pill, Plus, Scan, Loader2, Sparkles, ImageDown,
    CheckCircle2, AlertCircle, Database, Edit2
} from "lucide-react";
import EditMedicationModal from "@/components/medical/catalog/EditMedicationModal";

type Medication = {
    id: string;
    name: string;
    dosage: string;
    route: string;
    description: string | null;
    category: string;
    condition: string | null;
    isControlled: boolean;
    requiresFridge: boolean;
    withFood: boolean;
    createdAt: string;
};

export default function MedicalCatalogPage() {
    const [medications, setMedications] = useState<Medication[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCondition, setActiveCondition] = useState("TODOS");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    // Reset pagination when searching or changing tabs
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activeCondition]);

    // OCR State
    const [isOcrOpen, setIsOcrOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{ message: string, count: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit Modal State
    const [editingMed, setEditingMed] = useState<Medication | null>(null);

    // Add Manual Med State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addMedForm, setAddMedForm] = useState({
        name: "", dosage: "", route: "Oral", description: "", category: "General", condition: "Otros",
        isControlled: false, requiresFridge: false, withFood: false
    });
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        fetchMedications();
    }, []);

    const fetchMedications = async () => {
        try {
            const res = await fetch("/api/med/crud");
            if (res.ok) {
                const data = await res.json();
                setMedications(data.medications || data || []);
            }
        } catch (error) {
            console.error("Error fetching med catalog:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setScanResult(null);

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64String = (reader.result as string).split(',')[1];

                const res = await fetch("/api/med/ocr", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageBase64: base64String })
                });

                const data = await res.json();

                if (res.ok) {
                    setScanResult({
                        message: data.message || "Análisis completado.",
                        count: data.medications?.length || 0
                    });
                    fetchMedications();
                } else {
                    alert(data.error || "Ocurrió un error leyendo la receta.");
                }
                setIsScanning(false);
            };

            reader.onerror = () => {
                alert("Error comprimiendo la imagen en tu dispositivo.");
                setIsScanning(false);
            };

        } catch (error) {
            console.error("OCR Send Error:", error);
            setIsScanning(false);
            alert("Error de conexión con OpenAI.");
        }
    };

    const handleAddManualMed = async () => {
        if (!addMedForm.name || !addMedForm.dosage) return alert("Nombre y dosis son obligatorios.");
        setIsAdding(true);
        try {
            const res = await fetch("/api/med/catalog", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(addMedForm)
            });
            const data = await res.json();
            if (data.success) {
                setIsAddModalOpen(false);
                setAddMedForm({ name: "", dosage: "", route: "Oral", description: "", category: "General", condition: "Otros", isControlled: false, requiresFridge: false, withFood: false });
                fetchMedications();
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error de red al guardar el fármaco");
        } finally {
            setIsAdding(false);
        }
    };

    const filteredMeds = medications.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
        const cond = m.condition || "Otros";
        const matchesCondition = activeCondition === "TODOS" || cond === activeCondition;
        return matchesSearch && matchesCondition;
    });

    const totalPages = Math.ceil(filteredMeds.length / ITEMS_PER_PAGE);
    const paginatedMeds = filteredMeds.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const conditions = ["TODOS", ...Array.from(new Set(medications.map(m => m.condition || "Otros")))];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Pill className="w-8 h-8 text-teal-600" />
                        Catálogo de Farmacia
                    </h1>
                    <p className="text-gray-500 mt-2 flex items-center gap-2">
                        <Database className="w-4 h-4" /> Inventario Maestro de Zendity (Multi-Tenant).
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-white border-2 border-teal-600 text-teal-700 px-5 py-2.5 rounded-xl font-bold shadow-sm flex items-center gap-2 hover:bg-teal-50 hover:scale-105 active:scale-95 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Registro Manual
                    </button>
                    <button
                        onClick={() => setIsOcrOpen(true)}
                        className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
                    >
                        <Scan className="w-5 h-5" />
                        Escáner IA
                        <Sparkles className="w-3 h-3 text-fuchsia-200" />
                    </button>

                </div>
            </div>

            {/* Catalog Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">

                {/* Condiciones Médicas (Navegación Horizontal) */}
                <div className="flex overflow-x-auto p-4 gap-2 border-b border-gray-100 bg-gray-50/50 scrollbar-hide items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-2 flex-shrink-0">Filtrar Condición:</span>
                    {conditions.map((cond) => (
                        <button
                            key={cond}
                            onClick={() => setActiveCondition(cond)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeCondition === cond
                                ? "bg-zendity-teal text-white shadow-md shadow-teal-200"
                                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
                                }`}
                        >
                            {cond}
                        </button>
                    ))}
                </div>

                <div className="p-4 border-b border-gray-100 bg-white flex items-center justify-between">
                    <input
                        type="text"
                        placeholder="Buscar medicamento..."
                        className="w-full md:max-w-md px-4 py-2 rounded-lg border focus:ring-2 focus:ring-teal-500 outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <span className="text-sm text-gray-400 font-medium">Mostrando {filteredMeds.length} items</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-4 text-sm font-semibold text-gray-600">ID Fármaco</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Nombre y Dosis</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Alertas de Seguridad</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Agregado el</th>
                                <th className="p-4 text-sm font-semibold text-gray-600 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                                        Sincronizando con Base de Datos...
                                    </td>
                                </tr>
                            ) : paginatedMeds.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">
                                        No hay drogas en el inventario. Haz clic en "Escáner IA" para tomarle foto a las recetas.
                                    </td>
                                </tr>
                            ) : (
                                paginatedMeds.map((med) => (
                                    <tr key={med.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4 font-mono text-xs text-gray-400">MED-{med.id.split('-')[0].toUpperCase()}</td>
                                        <td className="p-4">
                                            <p className="font-bold text-gray-900 uppercase">{med.name}</p>
                                            <p className="text-xs text-gray-500 font-medium mt-0.5">{med.dosage}  Vía {med.route}</p>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-2">
                                                {med.isControlled && (
                                                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1 border border-red-200">
                                                        <AlertCircle className="w-3 h-3" /> Controlado
                                                    </span>
                                                )}
                                                {med.requiresFridge && (
                                                    <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1 border border-blue-200">
                                                         Refrigerar
                                                    </span>
                                                )}
                                                {med.withFood && (
                                                    <span className="bg-orange-50 text-orange-600 text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1 border border-orange-200">
                                                         Con Comida
                                                    </span>
                                                )}
                                                {!med.isControlled && !med.requiresFridge && !med.withFood && (
                                                    <span className="text-xs text-gray-400 italic">Estándar</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-500">
                                            {format(new Date(med.createdAt), 'dd MMM yyyy', { locale: es })}
                                        </td>
                                        <td className="p-4 text-center text-sm font-medium">
                                            <button
                                                onClick={() => setEditingMed(med)}
                                                className="text-gray-400 hover:text-zendity-teal hover:bg-teal-50 p-2 rounded-xl transition-all"
                                                title="Editar Molécula"
                                            >
                                                <Edit2 className="w-5 h-5 mx-auto" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                        <span className="text-sm text-gray-500 font-medium">
                            Página {currentPage} de {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 rounded-xl border bg-white text-sm font-bold text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors shadow-sm"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 rounded-xl border bg-white text-sm font-bold text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors shadow-sm"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* OCR Vision Modal */}
            {isOcrOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl p-8 transform transition-all text-center relative overflow-hidden">

                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-teal-500"></div>

                        <div className="w-16 h-16 bg-fuchsia-100 rounded-2xl flex items-center justify-center text-fuchsia-600 mx-auto mb-6 relative">
                            <Scan className="w-8 h-8" />
                            {isScanning && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-fuchsia-500"></span>
                                </span>
                            )}
                        </div>

                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Escáner eMAR (IA)</h3>
                        <p className="text-gray-500 mb-8">
                            Sube la foto de una Receta Médica o una Caja de Medicinas. La Inteligencia Artificial Extraerá los datos al inventario en segundos.
                        </p>

                        {!isScanning && !scanResult && (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-2xl p-10 hover:border-fuchsia-500 hover:bg-fuchsia-50 transition-colors cursor-pointer group"
                            >
                                <ImageDown className="w-10 h-10 text-gray-400 group-hover:text-fuchsia-500 mx-auto mb-4" />
                                <span className="font-medium text-gray-600 group-hover:text-fuchsia-700">Explorar / Abrir Cámara</span>
                            </div>
                        )}

                        {isScanning && (
                            <div className="py-12 flex flex-col items-center">
                                <Loader2 className="w-12 h-12 animate-spin text-fuchsia-600 mb-4" />
                                <p className="text-fuchsia-800 font-medium">Leyendo Receta con GPT-4 Vision...</p>
                                <p className="text-sm text-fuchsia-600/70 mt-2">Buscando moléculas y dosis.</p>
                            </div>
                        )}

                        {scanResult && !isScanning && (
                            <div className="py-6 bg-green-50 rounded-2xl border border-green-100">
                                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                <h4 className="text-lg font-bold text-green-800">¡Extracción Exitosa!</h4>
                                <p className="text-sm text-green-700 mt-1">{scanResult.message}</p>
                                <button
                                    onClick={() => setScanResult(null)}
                                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition"
                                >
                                    Escanear otra Receta
                                </button>
                            </div>
                        )}

                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />

                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <button
                                onClick={() => setIsOcrOpen(false)}
                                disabled={isScanning}
                                className="text-gray-500 hover:text-gray-800 font-medium"
                            >
                                Volver al Catálogo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Medication Manual Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl p-6 relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                            <Plus className="w-7 h-7 text-teal-600" /> Nuevo Fármaco
                        </h2>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre (Ingrediente)</label>
                                    <input type="text" value={addMedForm.name} onChange={e => setAddMedForm({...addMedForm, name: e.target.value})} className="w-full p-3 border-2 border-gray-100 rounded-xl bg-gray-50 uppercase focus:border-teal-500 outline-none" placeholder="Ej: LOSARTAN" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Dosis (Concentración)</label>
                                    <input type="text" value={addMedForm.dosage} onChange={e => setAddMedForm({...addMedForm, dosage: e.target.value})} className="w-full p-3 border-2 border-gray-100 rounded-xl bg-gray-50 focus:border-teal-500 outline-none" placeholder="Ej: 50mg" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Vía de Adm.</label>
                                    <select value={addMedForm.route} onChange={e => setAddMedForm({...addMedForm, route: e.target.value})} className="w-full p-3 border-2 border-gray-100 rounded-xl bg-gray-50 focus:border-teal-500 outline-none">
                                        <option value="Oral">Oral (PO)</option>
                                        <option value="Sublingual">Sublingual (SL)</option>
                                        <option value="Tópica">Tópica</option>
                                        <option value="Intravenosa">Intravenosa (IV)</option>
                                        <option value="Intramuscular">Intramuscular (IM)</option>
                                        <option value="Subcutánea">Subcutánea (SQ)</option>
                                        <option value="Óptica">Gotas Ópticas</option>
                                        <option value="Ótica">Gotas Óticas</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Condición</label>
                                    <select value={addMedForm.condition} onChange={e => setAddMedForm({...addMedForm, condition: e.target.value})} className="w-full p-3 border-2 border-gray-100 rounded-xl bg-gray-50 focus:border-teal-500 outline-none">
                                        <option value="Cardiovascular">Cardiovascular</option>
                                        <option value="Ansiedad">Ansiedad / Psiquiatría</option>
                                        <option value="Dolor Físico">Dolor y Fiebre</option>
                                        <option value="Insomnio">Insomnio</option>
                                        <option value="Infección">Infección (Antibiótico)</option>
                                        <option value="Gastrointestinal">Gastrointestinal</option>
                                        <option value="Respiratorio">Respiratorio</option>
                                        <option value="Otros">Otros</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Descripción / Notas</label>
                                <textarea text-sm="true" value={addMedForm.description} onChange={e => setAddMedForm({...addMedForm, description: e.target.value})} className="w-full p-3 border-2 border-gray-100 rounded-xl bg-gray-50 focus:border-teal-500 outline-none min-h-[60px]" placeholder="Instrucciones al prescribir..."></textarea>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Alertas Clínicas</label>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={addMedForm.isControlled} onChange={e => setAddMedForm({...addMedForm, isControlled: e.target.checked})} className="w-5 h-5 text-red-600 rounded" />
                                        <span className="text-sm font-bold text-gray-700"> Droga Controlada (Psicotrópico/Narcótico)</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={addMedForm.requiresFridge} onChange={e => setAddMedForm({...addMedForm, requiresFridge: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
                                        <span className="text-sm font-bold text-gray-700"> Requiere Refrigeración (Nevera)</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={addMedForm.withFood} onChange={e => setAddMedForm({...addMedForm, withFood: e.target.checked})} className="w-5 h-5 text-orange-500 rounded" />
                                        <span className="text-sm font-bold text-gray-700"> Tomar con Alimentos (Gastro-protección)</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all">
                                Cancelar
                            </button>
                            <button onClick={handleAddManualMed} disabled={isAdding} className="flex-1 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl shadow-lg shadow-teal-500/30 transition-all disabled:opacity-50">
                                {isAdding ? "Guardando..." : "Guardar Fármaco"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Medication Modal */}
            {editingMed && (
                <EditMedicationModal
                    medication={editingMed}
                    isOpen={!!editingMed}
                    onClose={() => setEditingMed(null)}
                    onSaved={() => fetchMedications()}
                />
            )}
        </div>
    );
}
