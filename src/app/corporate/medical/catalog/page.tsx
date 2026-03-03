"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
    Pill, Plus, Scan, Loader2, Sparkles, ImageDown, 
    CheckCircle2, AlertCircle, Database
} from "lucide-react";

type Medication = {
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
};

export default function MedicalCatalogPage() {
    const [medications, setMedications] = useState<Medication[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    
    // OCR State
    const [isOcrOpen, setIsOcrOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{message: string, count: number} | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const filteredMeds = medications.filter(m => 
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                        onClick={() => setIsOcrOpen(true)}
                        className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
                    >
                        <Scan className="w-5 h-5" />
                        Escáner IA
                        <Sparkles className="w-3 h-3 text-fuchsia-200" />
                    </button>
                    <button
                        onClick={() => alert("La adición manual pronto estará habilitada. ¡Usa el Escáner IA mientras tanto!")}
                        className="bg-white border text-gray-700 hover:bg-gray-50 px-5 py-2.5 rounded-xl font-medium shadow-sm flex items-center gap-2 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Añadir Manual
                    </button>
                </div>
            </div>

            {/* Catalog Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <input 
                        type="text"
                        placeholder="Buscar medicamento clínico..."
                        className="w-full md:max-w-md px-4 py-2 rounded-lg border focus:ring-2 focus:ring-teal-500 outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-4 text-sm font-semibold text-gray-600">ID / Código</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Nombre del Fármaco</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Descripción Médica</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Agregado el</th>
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
                            ) : filteredMeds.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">
                                        No hay drogas en el inventario. Haz clic en "Escáner IA" para tomarle foto a las recetas.
                                    </td>
                                </tr>
                            ) : (
                                filteredMeds.map((med) => (
                                    <tr key={med.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4 font-mono text-xs text-gray-400">{med.id.split('-')[0]}</td>
                                        <td className="p-4 font-bold text-gray-900 uppercase">
                                            {med.name}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 max-w-xs truncate">
                                            {med.description || "Sin descripción proporcionada."}
                                        </td>
                                        <td className="p-4 text-sm text-gray-500">
                                            {format(new Date(med.createdAt), 'dd MMM yyyy', { locale: es })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
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
        </div>
    );
}
