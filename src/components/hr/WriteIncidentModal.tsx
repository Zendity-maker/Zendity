import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from "@/context/AuthContext";
import { SparklesIcon } from '@heroicons/react/24/solid';

interface WriteIncidentModalProps {
    isOpen: boolean;
    onClose: () => void;
    hqId: string;
    supervisorId: string;
    employees: any[];
    onSuccess?: () => void;
}

export default function WriteIncidentModal({ isOpen, onClose, hqId, supervisorId, employees, onSuccess }: WriteIncidentModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [employeeId, setEmployeeId] = useState('');
    const [type, setType] = useState('WARNING');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);
    const { user } = useAuth(); // To get supervisor name

    // Signature reference
    const sigCanvas = useRef<any>(null);

    const handleAIGenerate = async () => {
        if (!employeeId) return alert("Seleccione un empleado primero.");
        if (description.trim().length < 5) return alert("Escriba un borrador breve (ej: 'llegó tarde hoy y ayer sin avisar') antes de generar con IA.");
        
        const emp = employees.find(e => e.id === employeeId);
        
        setGeneratingAI(true);
        try {
            const res = await fetch("/api/hr/incidents/ai-generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeName: emp?.name,
                    employeeRole: emp?.role,
                    supervisorName: user?.name || "Representante de RRHH",
                    type,
                    briefing: description
                })
            });
            const data = await res.json();
            if (data.success) {
                setDescription(data.generatedText);
            } else {
                alert("Error de IA: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión con la IA.");
        } finally {
            setGeneratingAI(false);
        }
    };

    const handleSubmit = async () => {
        if (!employeeId || !description) return alert("Faltan datos por llenar.");
        if (step === 1) {
            setStep(2);
            return;
        }

        if (step === 2 && sigCanvas.current?.isEmpty()) {
            return alert("El empleado debe firmar de enterado.");
        }

        setSubmitting(true);
        try {
            const signatureBase64 = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');

            const res = await fetch("/api/hr/incidents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    headquartersId: hqId,
                    supervisorId,
                    employeeId,
                    type,
                    description,
                    signatureBase64
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(" Reporte Disciplinario guardado exitosamente.");
                if (onSuccess) onSuccess();
                handleClose();
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            console.error(error);
            alert("Ocurrió un error al guardar el reporte.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setStep(1);
        setEmployeeId('');
        setDescription('');
        setType('WARNING');
        onClose();
    };

    if (!isOpen) return null;

    const selectedEmployee = employees.find(e => e.id === employeeId);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {step === 1 ? 'Redactar Reporte Disciplinario' : 'Firma de Conformidad del Empleado'}
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                {step === 1 ? 'Paso 1: Redacción del Supervisor' : 'Paso 2: Aceptación del Empleado'}
                            </p>
                        </div>
                        <button onClick={handleClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1">
                        {step === 1 ? (
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Empleado Involucrado</label>
                                    <select
                                        value={employeeId}
                                        onChange={(e) => setEmployeeId(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50 uppercase text-sm"
                                    >
                                        <option value="">Seleccione un empleado...</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Falta</label>
                                        <select
                                            value={type}
                                            onChange={(e) => setType(e.target.value)}
                                            className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50"
                                        >
                                            <option value="WARNING">Amonestación Escrita (Warning)</option>
                                            <option value="SUSPENSION">Suspensión Temporal</option>
                                            <option value="TERMINATION">Despido Justificado</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                        <input type="text" readOnly value={new Date().toLocaleDateString('es-ES')} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-100 text-gray-500 cursor-not-allowed" />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <label className="block text-sm font-medium text-gray-700">Descripción de los Hechos</label>
                                        <button 
                                            onClick={handleAIGenerate} 
                                            disabled={generatingAI}
                                            className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                        >
                                            <SparklesIcon className="w-3.5 h-3.5" />
                                            {generatingAI ? 'Generando acta...' : 'Redactar Profesionalmente'}
                                        </button>
                                    </div>
                                    <textarea
                                        rows={6}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Escriba un borrador breve o los puntos clave, y luego presione 'Redactar Profesionalmente'..."
                                        className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50 resize-none"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-800">
                                    <strong>Documento Oficial de Recursos Humanos.</strong> Al firmar este documento, <span className="font-bold">{selectedEmployee?.name}</span> confirma haber leído y entendido los motivos de esta acción disciplinaria.
                                </div>

                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Hechos Reportados:</h3>
                                    <p className="text-gray-800 whitespace-pre-wrap text-sm">{description}</p>
                                    <p className="text-xs font-bold text-gray-500 uppercase mt-4">Acción:</p>
                                    <p className="text-gray-800 text-sm">{type}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Firma del Empleado (Involucrado)</label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
                                        <SignatureCanvas
                                            ref={sigCanvas}
                                            canvasProps={{ className: 'w-full h-40 cursor-crosshair' }}
                                            penColor="blue"
                                        />
                                    </div>
                                    <button
                                        onClick={() => sigCanvas.current?.clear()}
                                        className="text-xs text-gray-500 hover:text-gray-800 mt-2 font-medium"
                                    >
                                        Borrar y volver a firmar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-between">
                        {step === 2 ? (
                            <button
                                onClick={() => setStep(1)}
                                className="px-5 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm"
                            >
                                Volver a Redacción
                            </button>
                        ) : (
                            <div></div>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className={`px-6 py-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2 ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {submitting ? 'Procesando...' : step === 1 ? 'Siguiente: Firma (Paso 2)' : 'Confirmar y Guardar Reporte'}
                            {!submitting && step === 1 && (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
