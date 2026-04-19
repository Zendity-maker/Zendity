import React, { useState, useEffect } from 'react';
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

type Severity = 'OBSERVATION' | 'WARNING' | 'SUSPENSION' | 'TERMINATION';
type Category = 'PUNCTUALITY' | 'PATIENT_CARE' | 'HYGIENE' | 'BEHAVIOR' | 'DOCUMENTATION' | 'UNIFORM' | 'OTHER';

const SEVERITY_STYLES: Record<Severity, { label: string; ring: string; bg: string; text: string; border: string }> = {
    OBSERVATION: { label: 'Observación', ring: 'ring-blue-400', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
    WARNING: { label: 'Amonestación', ring: 'ring-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
    SUSPENSION: { label: 'Suspensión', ring: 'ring-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' },
    TERMINATION: { label: 'Despido', ring: 'ring-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
};

const CATEGORY_LABELS: Record<Category, string> = {
    PUNCTUALITY: 'Puntualidad',
    PATIENT_CARE: 'Cuidado del Residente',
    HYGIENE: 'Higiene',
    BEHAVIOR: 'Conducta',
    DOCUMENTATION: 'Documentación',
    UNIFORM: 'Uniforme',
    OTHER: 'Otro',
};

const severityToLegacyType = (s: Severity): string =>
    s === 'OBSERVATION' ? 'WARNING' : s; // legacy enum no tiene OBSERVATION

export default function WriteIncidentModal({ isOpen, onClose, hqId, supervisorId, employees, onSuccess }: WriteIncidentModalProps) {
    const [employeeId, setEmployeeId] = useState('');
    const [selectedSupervisorId, setSelectedSupervisorId] = useState(supervisorId);
    const [severity, setSeverity] = useState<Severity>('OBSERVATION');
    const [category, setCategory] = useState<Category>('OTHER');
    const [description, setDescription] = useState('');
    const [directorNote, setDirectorNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);
    const { user } = useAuth();

    const [fullRoster, setFullRoster] = useState<any[]>(employees);
    const [loadingRoster, setLoadingRoster] = useState(false);

    useEffect(() => {
        if (isOpen && hqId && fullRoster.length <= 1) {
            const fetchRoster = async () => {
                setLoadingRoster(true);
                try {
                    const res = await fetch(`/api/hr/staff?headquartersId=${hqId}`);
                    const data = await res.json();
                    if (data.success && data.staff) setFullRoster(data.staff);
                } catch (e) {
                    console.error("Failed to fetch full roster");
                } finally {
                    setLoadingRoster(false);
                }
            };
            fetchRoster();
        }
    }, [isOpen, hqId]);

    const isDirectorView = user?.role === 'DIRECTOR';
    const administrativeStaff = fullRoster.filter(e => e.role === 'DIRECTOR' || e.role === 'ADMIN' || e.role === 'HR' || e.role === 'SUPERVISOR');
    const availableEmployees = isDirectorView
        ? fullRoster
        : fullRoster.filter(e => ['NURSE', 'CAREGIVER', 'MAINTENANCE', 'CLEANING', 'KITCHEN', 'SOCIAL_WORKER'].includes(e.role));

    useEffect(() => {
        if (isOpen) {
            if (employees.length === 1 && !employeeId) setEmployeeId(employees[0].id);
            if (!selectedSupervisorId && user?.id) setSelectedSupervisorId(user.id);
        }
    }, [isOpen, employees, user]);

    const handleAIGenerate = async () => {
        if (description.trim().length < 5) {
            return alert("Escribe un contexto breve (ej: 'llegó tarde tres veces esta semana sin avisar') antes de generar con Zendi.");
        }
        setGeneratingAI(true);
        try {
            const res = await fetch("/api/hr/incidents/ai-generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category, severity, context: description })
            });
            const data = await res.json();
            if (data.success) setDescription(data.generatedText);
            else alert("Error de IA: " + data.error);
        } catch (e) {
            console.error(e);
            alert("Error de conexión con la IA.");
        } finally {
            setGeneratingAI(false);
        }
    };

    const handleSubmit = async () => {
        if (!employeeId || !description || !selectedSupervisorId) return alert("Faltan datos por llenar.");

        setSubmitting(true);
        try {
            const res = await fetch("/api/hr/incidents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId,
                    description,
                    severity,
                    category,
                    directorNote: directorNote || undefined,
                    type: severityToLegacyType(severity),
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Observación guardada como borrador. El director la revisará para decidir.");
                if (onSuccess) onSuccess();
                handleClose();
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            console.error(error);
            alert("Ocurrió un error al guardar la observación.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setEmployeeId('');
        setDescription('');
        setDirectorNote('');
        setSeverity('OBSERVATION');
        setCategory('OTHER');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
                >
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Nueva Observación de Personal</h2>
                            <p className="text-sm text-gray-500 mt-1">Se guardará como <strong>Borrador</strong>. El director decide si solicita explicación, aplica o desestima.</p>
                        </div>
                        <button onClick={handleClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor Emisor</label>
                                <select
                                    value={selectedSupervisorId}
                                    onChange={(e) => setSelectedSupervisorId(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50 uppercase text-sm"
                                >
                                    <option value="">Seleccione el emisor...</option>
                                    {administrativeStaff.map(sup => (
                                        <option key={sup.id} value={sup.id}>{sup.name} ({sup.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Empleado Involucrado</label>
                                <select
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50 uppercase text-sm"
                                >
                                    <option value="">Seleccione al empleado...</option>
                                    {availableEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Severity picker */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Severidad</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(Object.keys(SEVERITY_STYLES) as Severity[]).map(s => {
                                    const st = SEVERITY_STYLES[s];
                                    const active = severity === s;
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setSeverity(s)}
                                            className={`py-3 rounded-xl border-2 text-sm font-bold transition-all ${active ? `${st.bg} ${st.text} ${st.border} ring-2 ${st.ring}` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                        >
                                            {st.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Category picker */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                {(Object.keys(CATEGORY_LABELS) as Category[]).map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setCategory(c)}
                                        className={`py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${category === c ? 'bg-teal-50 text-teal-700 border-teal-300 ring-2 ring-teal-400' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                    >
                                        {CATEGORY_LABELS[c]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Description with AI */}
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <label className="block text-sm font-medium text-gray-700">Descripción de los Hechos</label>
                                <button
                                    onClick={handleAIGenerate}
                                    disabled={generatingAI}
                                    className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                    {generatingAI ? 'Generando con Zendi...' : 'Generar con Zendi'}
                                </button>
                            </div>
                            <textarea
                                rows={6}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe los hechos, o escribe un borrador breve y presiona 'Generar con Zendi'..."
                                className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50 resize-none"
                            />
                        </div>

                        {/* Director note (optional) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nota del Director (opcional)</label>
                            <textarea
                                rows={2}
                                value={directorNote}
                                onChange={(e) => setDirectorNote(e.target.value)}
                                placeholder="Contexto adicional para el director que revisará esta observación..."
                                className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50 resize-none"
                            />
                        </div>
                    </div>

                    <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className={`px-6 py-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2 ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {submitting ? 'Guardando borrador...' : 'Guardar como Borrador'}
                            {!submitting && (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
