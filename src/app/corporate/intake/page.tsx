"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    FileSignature,
    CheckCircle2,
    UserPlus,
    AlertCircle,
    FileText,
    Loader2
} from "lucide-react";

export default function IntakeGeneratorPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const [patients, setPatients] = useState<any[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState("");
    const [documentType, setDocumentType] = useState("Acuerdo de Admisión");

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const hqId = (session?.user as any)?.headquartersId;

    useEffect(() => {
        async function fetchPatients() {
            setLoading(true);
            try {
                const res = await fetch("/api/corporate/patients");
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        setPatients(data.patients);
                    }
                }
            } catch (err) {
                console.error("Error fetching patients:", err);
            } finally {
                setLoading(false);
            }
        }
        if (hqId) {
            fetchPatients();
        }
    }, [hqId]);

    const handleGenerate = async () => {
        if (!selectedPatientId) {
            setError("Por favor selecciona un residente.");
            return;
        }

        setGenerating(true);
        setError("");
        setSuccess(false);

        try {
            const res = await fetch("/api/corporate/intake/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: selectedPatientId,
                    title: documentType
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al generar el documento");
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 5000);
            setSelectedPatientId("");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                    <FileSignature className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        Intake & e-Sign Hub
                    </h1>
                    <p className="text-gray-500">Genera paquetes de admisión legales para firmas de Familiares B2C.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Col: Form */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-gray-400" />
                        Nuevo Contrato
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Seleccionar Residente
                            </label>
                            {loading ? (
                                <div className="h-10 bg-gray-100 rounded-lg animate-pulse w-full"></div>
                            ) : (
                                <select
                                    value={selectedPatientId}
                                    onChange={(e) => setSelectedPatientId(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tipo de Documento Legal
                            </label>
                            <select
                                value={documentType}
                                onChange={(e) => setDocumentType(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            >
                                <option value="Acuerdo de Admisión Residencial">Acuerdo de Admisión Residencial</option>
                                <option value="Relevo de Responsabilidad Médica (HIPAA)">Relevo de Responsabilidad Médica (HIPAA)</option>
                                <option value="Consentimiento de eMAR y Medicación">Consentimiento de eMAR y Medicación</option>
                            </select>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                El documento ha sido generado y enviado al Portal Familiar exitosamente.
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={generating || loading}
                            className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                            {generating ? "Estructurando Legal..." : "Generar y Enviar a Firma"}
                        </button>
                    </div>
                </div>

                {/* Right Col: Info/Instructions */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">¿Cómo funciona el e-Sign B2C?</h3>
                    <ul className="space-y-4 text-slate-600">
                        <li className="flex items-start gap-3">
                            <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex justify-center items-center font-bold text-sm shrink-0">1</div>
                            <p>Al generar el documento, Zendity inyecta automáticamente los datos del residente usando variables pre-pobladas en el contrato legal.</p>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex justify-center items-center font-bold text-sm shrink-0">2</div>
                            <p>El sistema asigna un estado <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-bold">PENDING</span> y empuja el documento al <strong>Portal de Familiares</strong>.</p>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex justify-center items-center font-bold text-sm shrink-0">3</div>
                            <p>El familiar inicia sesión, lee el contrato en su teléfono, y estampa su <strong>Firma Vectorial</strong> de manera táctil.</p>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex justify-center items-center font-bold text-sm shrink-0">4</div>
                            <p>Zendity sella criptográficamente el PDF con la fecha y cambia el estado a <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">SIGNED</span>.</p>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
