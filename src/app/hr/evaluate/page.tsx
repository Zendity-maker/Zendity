"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import WriteIncidentModal from "@/components/hr/WriteIncidentModal";

interface Employee {
    id: string;
    name: string;
    role: string;
}

export default function HREvaluatePage() {
    const { user } = useAuth();
    const router = useRouter();

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState<{ title: string, msg: string, isPenalized: boolean } | null>(null);
    const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);

    // Carga inicial de empleados desde Prisma
    useEffect(() => {
        if (!user) return;
        async function fetchEmployees() {
            if (!user) return; // Salvaguarda inicial
            try {
                const hqId = user.hqId || user.headquartersId;
                const res = await fetch(`/api/hr/staff?hqId=${hqId}`);
                const data = await res.json();

                if (Array.isArray(data)) {
                    setEmployees(data);
                } else if (data.success && Array.isArray(data.staff)) {
                    setEmployees(data.staff);
                }
            } catch (err) {
                console.error("Error fetching staff:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchEmployees();
    }, [user]);

    const handleScoreChange = (category: string, value: string) => {
        setScores(prev => ({ ...prev, [category]: parseInt(value) || 0 }));
    };

    const handleSubmit = async () => {
        if (!selectedEmp || !user) return;
        setSubmitting(true);

        try {
            const hqId = user.hqId || user.headquartersId;
            const payload = {
                employeeId: selectedEmp.id,
                evaluatorId: user.id || "admin-system",
                hqId,
                categoryScores: scores,
                feedback: "Evaluación Regular en Sitio."
            };

            const res = await fetch('/api/hr/evaluations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                const globalScore = data.newComplianceScore;

                if (globalScore < 80) {
                    setSuccessMsg({
                        title: "Turno Suspendido",
                        msg: `El score global (${globalScore} pts) de ${selectedEmp.name} cayó bajo el umbral (80). El empleado NO PODRÁ realizar ponches ni abrir el eMAR hasta completar un plan de mejora en Zendity Academy.`,
                        isPenalized: true
                    });
                } else {
                    setSuccessMsg({
                        title: "Evaluación Exitosa",
                        msg: `Se ha registrado exitosamente la auditoría en sitio para ${selectedEmp.name} (Score Global: ${globalScore} pts).`,
                        isPenalized: false
                    });
                }
            } else {
                alert("Error del servidor: " + data.error);
            }

        } catch (error) {
            console.error(error);
            alert("No se pudo conectar con el motor de base de datos.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-teal-600 font-bold animate-pulse">Obteniendo Expedientes RRHH...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="flex items-center justify-between border-b border-slate-200 pb-5">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Auditoría RRHH</h1>
                    <p className="text-slate-500 mt-1">Evaluación en sitio de desempeño y cumplimiento de protocolos de Zendity.</p>
                </div>
                <button onClick={() => router.push('/corporate')} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">← Volver al HQ</button>
            </div>

            {successMsg ? (
                <div className={`rounded-2xl p-8 text-center border shadow-sm ${successMsg.isPenalized ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                    <h2 className="text-2xl font-black mb-2">{successMsg.title}</h2>
                    <p className="font-medium text-opacity-80 leading-relaxed max-w-lg mx-auto mb-6">{successMsg.msg}</p>
                    <button onClick={() => { setSuccessMsg(null); setSelectedEmp(null); setScores({}); }} className={`px-6 py-2.5 rounded-xl text-white font-bold transition-transform hover:scale-105 active:scale-95 shadow-sm ${successMsg.isPenalized ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                        Evaluar a otro colaborador
                    </button>
                </div>
            ) : (

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Selector de Empleado */}
                    <div className="md:col-span-1 space-y-4">
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Seleccionar Auditado</h3>
                            <div className="space-y-3">
                                {employees.map(emp => (
                                    <button
                                        key={emp.id}
                                        onClick={() => { setSelectedEmp(emp); setScores({}); }}
                                        className={`w-full flex items-center p-3 rounded-xl border transition-all text-left ${selectedEmp?.id === emp.id ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 mr-3">{emp.name.substring(0, 2).toUpperCase()}</div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900">{emp.name}</p>
                                            <p className="text-xs text-slate-500 font-mono mt-0.5">{emp.role}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Cuestionario Interactivo Módulo Dinámico */}
                    <div className="md:col-span-2">
                        {!selectedEmp ? (
                            <div className="h-full min-h-[400px] border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center text-slate-400 bg-white/50">
                                <p className="font-medium flex flex-col items-center gap-2"><span>👈</span> Selecciona un empleado del padrón para cargar su rúbrica específica.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95">
                                <div className="bg-slate-900 p-6 text-white border-b-4 border-teal-500 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                    <div className="flex justify-between items-center relative z-10">
                                        <div>
                                            <h2 className="text-xl font-bold">Rúbrica: {selectedEmp.role === 'NURSE' || selectedEmp.role === 'CAREGIVER' ? 'Métricas Clínicas' : selectedEmp.role === 'MAINTENANCE' ? 'SLA Infraestructura' : 'Métricas Directivas'}</h2>
                                            <p className="text-slate-400 text-sm mt-1">Evaluando a: <span className="text-white font-medium">{selectedEmp.name}</span></p>
                                        </div>
                                        <div className="flex items-center gap-3 relative z-10">
                                            {(user?.role === 'ADMIN' || user?.role === 'DIRECTOR') && (
                                                <button onClick={() => setIsIncidentModalOpen(true)} className="bg-rose-500/20 hover:bg-rose-500 text-rose-100 font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 border border-rose-500/50 transition-colors text-xs">
                                                    <ShieldAlert className="w-4 h-4" /> Sancionar
                                                </button>
                                            )}
                                            <div className="text-3xl opacity-80">{selectedEmp.role === 'NURSE' ? '⚕️' : selectedEmp.role === 'MAINTENANCE' ? '🔧' : '📋'}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 md:p-8 space-y-8">

                                    {/* Preguntas de Enfermería/Cuidadores */}
                                    {(selectedEmp.role === 'NURSE' || selectedEmp.role === 'CAREGIVER') && (
                                        <>
                                            <QuestionRow
                                                id="seguridad_clinica"
                                                label="Seguridad Clínica (eMAR & Downton)"
                                                desc="Cumplimiento en la administración correcta y segura de medicamentos."
                                                value={scores['seguridad_clinica'] || 100}
                                                onChange={(val) => handleScoreChange('seguridad_clinica', val)}
                                            />
                                            <QuestionRow
                                                id="higiene"
                                                label="Protocolos de Higiene y Planta"
                                                desc="Correcto lavado de manos, desinfección de áreas y presentación del Residente."
                                                value={scores['higiene'] || 100}
                                                onChange={(val) => handleScoreChange('higiene', val)}
                                            />
                                            <QuestionRow
                                                id="empatia"
                                                label="Trato y Empatía al Residente"
                                                desc="Comunicación asertiva con el envejeciente durante los cambios posturales/baños."
                                                value={scores['empatia'] || 100}
                                                onChange={(val) => handleScoreChange('empatia', val)}
                                            />
                                        </>
                                    )}

                                    {/* Preguntas de Administrativos / Directores */}
                                    {(selectedEmp.role === 'ADMIN' || selectedEmp.role === 'DIRECTOR') && (
                                        <>
                                            <QuestionRow
                                                id="cumplimiento_df"
                                                label="Cumplimiento Departamento Familia"
                                                desc="Expedientes sin vencer, carpetas firmadas y auditorías cero-papeles al día."
                                                value={scores['cumplimiento_df'] || 100}
                                                onChange={(val) => handleScoreChange('cumplimiento_df', val)}
                                            />
                                            <QuestionRow
                                                id="liderazgo"
                                                label="Liderazgo Staff Operacional"
                                                desc="Manejo de equipo y control de ausentismo del personal base."
                                                value={scores['liderazgo'] || 100}
                                                onChange={(val) => handleScoreChange('liderazgo', val)}
                                            />
                                        </>
                                    )}

                                    {/* Preguntas de Mantenimiento (Technical SLAs) */}
                                    {selectedEmp.role === 'MAINTENANCE' && (
                                        <>
                                            <QuestionRow
                                                id="sla_resolution"
                                                label="Cumplimiento de SLA (Tiempos de Resolución)"
                                                desc="Velocidad y eficacia cerrando tickets de averías críticas reportadas por el Action Hub."
                                                value={scores['sla_resolution'] || 100}
                                                onChange={(val) => handleScoreChange('sla_resolution', val)}
                                            />
                                            <QuestionRow
                                                id="prevencion_riesgos"
                                                label="Prevención de Riesgos Estructurales"
                                                desc="Detección proactiva de peligros ambientales (pisos mojados, cables expuestos, iluminación fundida)."
                                                value={scores['prevencion_riesgos'] || 100}
                                                onChange={(val) => handleScoreChange('prevencion_riesgos', val)}
                                            />
                                        </>
                                    )}

                                    <div className="pt-6 mt-6 border-t border-slate-100 flex justify-between items-center">
                                        <p className="text-xs text-slate-400 max-w-xs">Tus inputs afectarán el Cumplimiento Anual y podrían causar bloqueos de turno según la política de Zendity.</p>
                                        <button onClick={handleSubmit} disabled={submitting} className={`bg-slate-900 hover:bg-black text-white font-bold px-8 py-3.5 rounded-xl shadow-lg transition-all ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-teal-500/20 active:scale-95'}`}>
                                            {submitting ? 'Evaluando...' : 'Guardar y Certificar'}
                                        </button>
                                    </div>

                                </div>
                            </div>
                        )}
                    </div>

                </div>

            )}

            {isIncidentModalOpen && user && selectedEmp && (
                <WriteIncidentModal
                    isOpen={isIncidentModalOpen}
                    onClose={() => setIsIncidentModalOpen(false)}
                    hqId={user?.hqId || user?.headquartersId || ''}
                    supervisorId={user?.id || ''}
                    employees={[selectedEmp]}
                />
            )}
        </div>
    );
}

// Sub-componente para Input Numérico Premium
function QuestionRow({ id, label, desc, value, onChange }: { id: string, label: string, desc: string, value: number, onChange: (val: string) => void }) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-colors focus-within:border-teal-300 focus-within:bg-teal-50/10">
            <div className="flex-1">
                <label htmlFor={id} className="block text-base font-bold text-slate-800 mb-1">{label}</label>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    id={id}
                    min="0" max="100"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-32 md:w-48 accent-teal-600"
                />
                <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center border-2 font-black shadow-sm ${value >= 90 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : value >= 75 ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-red-50 border-red-200 text-red-600'}`}>
                    <span>{value}</span>
                    <span className="text-[9px] font-bold opacity-50 uppercase tracking-widest leading-none">Pts</span>
                </div>
            </div>
        </div>
    );
}
