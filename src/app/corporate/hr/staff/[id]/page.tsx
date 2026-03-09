"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
    ArrowLeft, Award, Activity, ShieldCheck, Clock, CheckCircle2,
    AlertTriangle, FileText, HeartPulse, Stethoscope, Wrench, Mail, CalendarDays, Phone
} from "lucide-react";

export default function EmployeePerformanceDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const staffId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [staffData, setStaffData] = useState<any>(null);
    const [kpis, setKpis] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!staffId) return;
        const fetchPerformance = async () => {
            try {
                const res = await fetch(`/api/hr/performance/${staffId}`);
                const data = await res.json();
                if (data.success) {
                    setStaffData(data.user);
                    setKpis(data.kpis);
                } else {
                    setError(data.error);
                }
            } catch (e) {
                console.error(e);
                setError("Error de conexión al extraer la telemetría");
            } finally {
                setLoading(false);
            }
        };
        fetchPerformance();
    }, [staffId]);

    if (loading) {
        return (
            <div className="flex-1 min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="mt-4 font-bold text-slate-500">Compilando Análisis Clínico...</p>
            </div>
        );
    }

    if (error || !staffData) {
        return (
            <div className="p-8">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-indigo-600 font-bold mb-6 hover:text-indigo-800">
                    <ArrowLeft className="w-5 h-5" /> Volver a Directorio
                </button>
                <div className="bg-red-50 text-red-600 p-6 rounded-2xl font-bold flex items-center gap-4">
                    <AlertTriangle className="w-8 h-8" />
                    {error || "No se encontró el perfil de empleado."}
                </div>
            </div>
        );
    }

    // Role-Based KPI Rendering
    const renderCaregiverKPIs = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-8">
            <MetricCard
                title="ADL Completion Rate"
                value={`${kpis.adlCompletionRate}%`}
                subtext={`Volumen Total: ${kpis.adlVolume} actividades`}
                icon={<HeartPulse className="w-6 h-6 text-rose-500" />}
                color="bg-rose-50 border-rose-200"
            />
            <MetricCard
                title="Puntualidad de Handover"
                value={`${kpis.handoverRate}%`}
                subtext="Entregas de guardia cero retrasos"
                icon={<Clock className="w-6 h-6 text-amber-500" />}
                color="bg-amber-50 border-amber-200"
            />
            <MetricCard
                title="Early Warning Rate"
                value={`${kpis.earlyWarnings}`}
                subtext="Alertas clínicas levantadas a tiempo"
                icon={<AlertTriangle className="w-6 h-6 text-purple-500" />}
                color="bg-purple-50 border-purple-200"
            />
            <MetricCard
                title="Status General"
                value="ÓPTIMO"
                subtext="Supera el promedio del piso"
                icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                color="bg-emerald-50 border-emerald-200"
            />
        </div>
    );

    const renderNurseKPIs = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-8">
            <MetricCard
                title="eMAR Accuracy Score"
                value={`${kpis.emarAccuracy}%`}
                subtext="Precisión en rutas de medicación"
                icon={<Stethoscope className="w-6 h-6 text-teal-500" />}
                color="bg-teal-50 border-teal-200"
            />
            <MetricCard
                title="Clinical Notes Consistency"
                value={`${kpis.clinicalNotesVolume}`}
                subtext="Volumen documental generado"
                icon={<FileText className="w-6 h-6 text-indigo-500" />}
                color="bg-indigo-50 border-indigo-200"
            />
            <MetricCard
                title="Handovers Libres de Error"
                value={`${kpis.handoverVolume}`}
                subtext="Turnarounds de relevo oficial"
                icon={<ShieldCheck className="w-6 h-6 text-sky-500" />}
                color="bg-sky-50 border-sky-200"
            />
            <MetricCard
                title="Respuesta a Triage (Mins)"
                value={`${kpis.triageResponseMins}m`}
                subtext="Promedio de respuesta a alertas de piso"
                icon={<Activity className="w-6 h-6 text-rose-500" />}
                color="bg-rose-50 border-rose-200"
            />
        </div>
    );

    const renderMaintenanceKPIs = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-8">
            <MetricCard
                title="Volume of Work Orders"
                value={`${kpis.workOrdersVolume}`}
                subtext="Tickets resueltos satisfactoriamente"
                icon={<Wrench className="w-6 h-6 text-slate-500" />}
                color="bg-slate-50 border-slate-200"
            />
            <MetricCard
                title="SLA Resolution Time"
                value={`${kpis.resolutionTimeHours}hrs`}
                subtext="Horas promedio por ticket"
                icon={<Clock className="w-6 h-6 text-amber-500" />}
                color="bg-amber-50 border-amber-200"
            />
            <MetricCard
                title="Quality Check"
                value={`${kpis.qualityCheckRate}%`}
                subtext="0 Quejas reiteradas sobre la misma reparación"
                icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                color="bg-emerald-50 border-emerald-200"
            />
            <MetricCard
                title="Preventive Compliance"
                value={`${kpis.preventiveCompliance}%`}
                subtext="Mantenimientos preventivos al día"
                icon={<ShieldCheck className="w-6 h-6 text-indigo-500" />}
                color="bg-indigo-50 border-indigo-200"
            />
        </div>
    );

    return (
        <div className="flex-1 min-h-screen bg-slate-50 p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 font-bold mb-4 hover:text-slate-600 transition-colors">
                        <ArrowLeft className="w-5 h-5" /> Volver al Staff Directory
                    </button>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <Award className="w-8 h-8 text-indigo-600" /> Profiling & Rendimiento B2B
                    </h1>
                    <p className="text-slate-500 font-medium mt-2">Visor Analítico en Vivo (Últimos 30 Días)</p>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border-2 border-slate-200 shadow-sm flex items-center gap-4">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="font-bold text-slate-700 text-sm">Motor Algorítmico Activo</span>
                </div>
            </div>

            {/* Hero Profile Board */}
            <div className="bg-white rounded-[2rem] p-10 border-2 border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col lg:flex-row items-center gap-12">
                {/* Avatar & Info */}
                <div className="flex items-center gap-8 flex-1">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white text-5xl font-black shadow-lg shadow-indigo-500/30 shrink-0">
                        {staffData.photoUrl ? (
                            <img src={staffData.photoUrl} alt={staffData.name} className="w-full h-full object-cover" />
                        ) : (
                            staffData.name.charAt(0)
                        )}
                    </div>
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 leading-tight">{staffData.name}</h2>
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                            <span className="bg-slate-100 text-slate-700 font-black px-4 py-1.5 rounded-full text-sm border border-slate-200 shadow-sm">
                                {staffData.role}
                            </span>
                            <span className="text-slate-500 font-medium text-sm flex items-center gap-1">
                                <Mail className="w-4 h-4" /> {staffData.email}
                            </span>
                            {staffData.createdAt && (
                                <span className="text-slate-500 font-medium text-sm flex items-center gap-1 ml-2">
                                    <CalendarDays className="w-4 h-4" /> Ingreso: {new Date(staffData.createdAt).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Score Gauge (Zendity Trust Score) */}
                <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 flex items-center gap-8 w-full max-w-sm">
                    <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-200" />
                            <circle
                                cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="12" fill="transparent"
                                className={`${kpis.trustScore >= 90 ? 'text-emerald-500' : kpis.trustScore >= 70 ? 'text-amber-500' : 'text-rose-500'}`}
                                strokeDasharray="301"
                                strokeDashoffset={301 - (301 * kpis.trustScore) / 100}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-slate-800">{kpis.trustScore}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-1">Zendity Trust Score</p>
                        <p className="text-slate-400 font-medium text-sm leading-snug">Calificación algorítmica de confiabilidad y cero omisiones.</p>
                    </div>
                </div>
            </div>

            {/* Role-Specific KPIs */}
            {staffData.role === 'CAREGIVER' && renderCaregiverKPIs()}
            {(staffData.role === 'NURSE' || staffData.role === 'SUPERVISOR' || staffData.role === 'DIRECTOR') && renderNurseKPIs()}
            {staffData.role === 'MAINTENANCE' && renderMaintenanceKPIs()}

            {!['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'MAINTENANCE'].includes(staffData.role) && (
                <div className="bg-white p-8 mt-8 rounded-3xl border border-slate-200 text-center">
                    <p className="text-slate-500 font-bold mb-2">Este colaborador forma parte del personal administrativo o no cuenta con KPIs clínicos estructurados.</p>
                    <p className="text-sm text-slate-400">Su Zendity Trust Score base se mantiene estable al no registrar penalizaciones operativas directas.</p>
                </div>
            )}

        </div>
    );
}

// Subcomponente de Tarjeta de Métrica
function MetricCard({ title, value, subtext, icon, color }: { title: string, value: string, subtext: string, icon: any, color: string }) {
    return (
        <div className={`p-6 rounded-[2rem] border-2 transition-transform hover:-translate-y-1 duration-300 ${color} shadow-sm`}>
            <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-white/60 backdrop-blur rounded-xl shadow-sm">
                    {icon}
                </div>
            </div>
            <div>
                <h4 className="text-4xl font-black text-slate-800 mb-2">{value}</h4>
                <p className="font-bold text-slate-700 leading-tight mb-2">{title}</p>
                <p className="text-sm text-slate-500 font-medium">{subtext}</p>
            </div>
        </div>
    );
}
