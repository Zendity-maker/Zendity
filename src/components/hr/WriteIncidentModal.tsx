import React, { useState, useEffect } from 'react';
import { SignaturePad } from '@/components/sw-evaluation/SignaturePad';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from "@/context/AuthContext";
import { SparklesIcon } from '@heroicons/react/24/solid';
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

interface WriteIncidentModalProps {
    isOpen: boolean;
    onClose: () => void;
    hqId: string;
    /** Ya no decide la autoría: la escribe el servidor desde la sesión. Se
     *  conserva porque los call sites lo pasan. */
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
    HYGIENE: 'Desempeño',
    BEHAVIOR: 'Conducta',
    DOCUMENTATION: 'Documentación',
    UNIFORM: 'Uniforme',
    OTHER: 'Otro',
};

const severityToLegacyType = (s: Severity): string =>
    s === 'OBSERVATION' ? 'WARNING' : s; // legacy enum no tiene OBSERVATION

export default function WriteIncidentModal({ isOpen, onClose, hqId, employees, onSuccess }: WriteIncidentModalProps) {
    const [employeeId, setEmployeeId] = useState('');
    const [severity, setSeverity] = useState<Severity>('OBSERVATION');
    const [category, setCategory] = useState<Category>('OTHER');
    const [description, setDescription] = useState('');
    const [directorNote, setDirectorNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    // Firma de quien emite la observación. Es el otro extremo del mismo
    // documento que el empleado firmará al recibirlo.
    const [firma, setFirma] = useState<string | null>(null);
    const [firmando, setFirmando] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);
    const { user } = useAuth();

    const [fullRoster, setFullRoster] = useState<any[]>(employees);
    const [loadingRoster, setLoadingRoster] = useState(false);

    useEffect(() => {
        if (isOpen && hqId) {
            const fetchRoster = async () => {
                setLoadingRoster(true);
                try {
                    const res = await fetch(`/api/hr/staff?headquartersId=${hqId}`);
                    const data = await res.json();
                    // hr/staff devuelve el array directamente (sin wrapper success/staff)
                    if (Array.isArray(data)) setFullRoster(data);
                    else if (data.success && data.staff) setFullRoster(data.staff);
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
    const availableEmployees = isDirectorView
        ? fullRoster
        : fullRoster.filter(e => ['NURSE', 'CAREGIVER', 'MAINTENANCE', 'CLEANING', 'KITCHEN', 'SOCIAL_WORKER'].includes(e.role));

    useEffect(() => {
        if (isOpen) {
            if (employees.length === 1 && !employeeId) setEmployeeId(employees[0].id);
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
        // El emisor ya no se pide: lo pone el servidor desde la sesión. Exigirlo
        // aquí era un candado sin llave — si la sesión no traía id, el botón
        // decía "faltan datos" sobre un campo que nadie podía llenar.
        if (!employeeId || !description) return alert("Faltan datos por llenar.");

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
                    // Firma de quien emite. El endpoint ya la aceptaba y la
                    // guardaba con su signedAt, pero esta pantalla nunca la
                    // enviaba: 88 observaciones con el campo en null. Es el otro
                    // extremo del mismo documento que el empleado va a firmar.
                    signatureBase64: firma || undefined,
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
        setFirma(null);
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
                            {/**
                              * DEJA DE SER UN DESPLEGABLE.
                              *
                              * Era una lista donde se podia elegir a otra persona como
                              * emisora, y no servia para nada: el modal nunca mandaba ese
                              * campo, y el servidor escribe supervisorId = quien esta en
                              * sesion (api/hr/incidents/route.ts). O sea que un director
                              * podia poner ahi el nombre de una supervisora, ver que lo
                              * habia puesto, y la observacion quedaba firmada a su propio
                              * nombre. En un documento disciplinario que el empleado firma
                              * y puede apelar, la autoria no es un detalle cosmetico.
                              *
                              * Se queda de solo lectura, diciendo lo que va a pasar de
                              * verdad. Si algun dia hace falta emitir en nombre de otro,
                              * es un cambio de servidor —con su registro de quien lo hizo
                              * por quien—, no un <select> en el formulario.
                              */}
                            <Field label="Supervisor Emisor" helper="La observación queda firmada a nombre de quien la escribe.">
                                <div className="flex items-center h-[42px] px-3 rounded-lg border border-gray-200 bg-gray-100 text-sm font-semibold text-gray-700 uppercase truncate">
                                    {user?.name ?? 'Tu cuenta'}{user?.role ? ` (${user.role})` : ''}
                                </div>
                            </Field>
                            <Field label="Empleado Involucrado" htmlFor="empleadoInvolucrado">
                                <Select
                                    id="empleadoInvolucrado"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    className="uppercase text-sm bg-gray-50"
                                >
                                    <option value="">Seleccione al empleado...</option>
                                    {availableEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                                    ))}
                                </Select>
                            </Field>
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
                            <Textarea
                                rows={6}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe los hechos, o escribe un borrador breve y presiona 'Generar con Zendi'..."
                                className="bg-gray-50 resize-none"
                            />
                        </div>

                        {/* Director note (optional) */}
                        <Field label="Nota del Director (opcional)" htmlFor="directorNote">
                            <Textarea
                                id="directorNote"
                                rows={2}
                                value={directorNote}
                                onChange={(e) => setDirectorNote(e.target.value)}
                                placeholder="Contexto adicional para el director que revisará esta observación..."
                                className="bg-gray-50 resize-none"
                            />
                        </Field>

                        {/* Firma de quien emite */}
                        <Field label="Tu firma" htmlFor="firma">
                            {firma ? (
                                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                                    <img src={firma} alt="Firma" className="h-14 bg-white rounded border border-gray-200 px-2" />
                                    <button
                                        type="button"
                                        onClick={() => setFirma(null)}
                                        className="text-xs font-bold text-slate-500 hover:text-slate-700"
                                    >
                                        Volver a firmar
                                    </button>
                                </div>
                            ) : firmando ? (
                                <SignaturePad
                                    height={150}
                                    onAccept={(b64) => { setFirma(b64); setFirmando(false); }}
                                    onCancel={() => setFirmando(false)}
                                />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setFirmando(true)}
                                    className="w-full border-2 border-dashed border-gray-300 hover:border-blue-300 hover:bg-blue-50/40 rounded-xl py-4 text-sm font-semibold text-slate-600 transition-colors"
                                >
                                    Firmar la observación
                                </button>
                            )}
                        </Field>
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
