"use client";

import { useState, useEffect, use } from "react";
import Link from 'next/link';

export default function StaffPerformanceProfile({ params }: { params: Promise<{ id: string }> }) {
    const rawParams = use(params);
    const [staff, setStaff] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStaffProfile = async () => {
            try {
                const res = await fetch(`/api/corporate/hr/staff/${rawParams.id}`);
                const data = await res.json();
                if (data.success) {
                    setStaff(data.staff);
                }
            } catch (error) {
                console.error("Failed to fetch staff profile", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStaffProfile();
    }, [rawParams.id]);

    const getScoreColor = (score: number) => {
        if (score >= 90) return "bg-emerald-100 text-emerald-700 border-emerald-200";
        if (score >= 75) return "bg-amber-100 text-amber-700 border-amber-200";
        return "bg-rose-100 text-rose-700 border-rose-200";
    };

    const getRoleName = (role: string) => {
        const roles: Record<string, string> = {
            "NURSE": "Enfermera",
            "CAREGIVER": "Cuidadora",
            "DIRECTOR": "Directora",
            "SOCIAL_WORKER": "Trabajo Social",
            "KITCHEN": "Cocina"
        };
        return roles[role] || role;
    };

    if (loading) return (
        <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
    );

    if (!staff) return (
        <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
            <h1 className="text-3xl font-black text-slate-800">Empleado no encontrado</h1>
            <p className="text-slate-500">El empleado que intentas auditar no existe o ha sido dado de baja permanentemente.</p>
            <Link href="/corporate/hr" className="inline-block mt-4 text-teal-600 font-bold hover:underline">← Volver al Directorio RRHH</Link>
        </div>
    );

    const isMedicalStaff = staff.role === "NURSE" || staff.role === "CAREGIVER";

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Nav */}
            <Link href="/corporate/hr" className="inline-flex items-center text-sm font-bold text-slate-400 hover:text-teal-600 transition-colors">
                <span>← Volver al Directorio de RRHH</span>
            </Link>

            {/* Header Profile */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-8 items-start relative overflow-hidden">
                {/* Status Indicator */}
                <div className={`absolute top-0 left-0 w-full h-2 ${staff.isActive ? (staff.isShiftBlocked ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-red-500'}`}></div>

                <div className="flex-shrink-0">
                    {staff.photoUrl ? (
                        <img className="h-32 w-32 rounded-full border-4 border-slate-50 object-cover shadow-sm" src={staff.photoUrl} alt={staff.name} />
                    ) : (
                        <div className="h-32 w-32 rounded-full bg-slate-100 border-4 border-slate-50 shadow-sm flex items-center justify-center">
                            <span className="text-slate-400 text-4xl font-black uppercase">{staff.name.charAt(0)}</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-4xl font-black text-slate-800 tracking-tight">{staff.name}</h1>
                        <span className="px-3 py-1 rounded-lg text-sm font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {getRoleName(staff.role)}
                        </span>
                        {!staff.isActive && (
                            <span className="px-3 py-1 rounded-lg text-sm font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                                🛑 BAJA ADMINISTRATIVA
                            </span>
                        )}
                        {staff.isShiftBlocked && staff.isActive && (
                            <span className="px-3 py-1 rounded-lg text-sm font-bold bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                                🔒 Turnos Bloqueados
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-6 text-slate-500 font-medium text-sm">
                        <span className="flex items-center gap-1.5">📧 {staff.email}</span>
                        <span className="flex items-center gap-1.5">🏢 Sede: {staff.facility}</span>
                    </div>

                    {staff.blockReason && (
                        <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                            <span className="text-amber-500 text-xl font-black">!</span>
                            <div>
                                <h4 className="font-bold text-amber-900 text-sm">Motivo de Bloqueo/Baja</h4>
                                <p className="text-amber-700 text-sm mt-0.5">{staff.blockReason}</p>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Global Score Card */}
                <div className="w-full md:w-auto bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Desempeño Consolidado</p>
                    <div className={`text-5xl font-black mb-1 ${getScoreColor(staff.performanceScore).split(' ')[1]}`}>
                        {staff.performanceScore}
                    </div>
                    <p className="text-sm font-bold text-slate-500 mt-1">Suma de Academia + Clínico</p>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Evaluaciones Clínicas Metric */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Evaluaciones (HR)</h3>
                            <div className="text-3xl font-black text-slate-800">
                                {staff.avgEvalScore || 'N/A'}<span className="text-lg text-slate-400">/100</span>
                            </div>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-500 rounded-xl rounded-tr-sm">📋</div>
                    </div>
                    <div className="mt-4 text-sm font-medium text-slate-500">
                        Promedio de <span className="font-bold text-slate-700">{staff.evaluationsCount}</span> inspecciones
                    </div>
                </div>

                {/* Academy Metric */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Compliance Academy</h3>
                            <div className="text-3xl font-black text-slate-800">
                                {staff.complianceScore}<span className="text-lg text-slate-400">/100</span>
                            </div>
                        </div>
                        <div className="p-3 bg-violet-50 text-violet-500 rounded-xl rounded-tr-sm">🎓</div>
                    </div>
                    <div className="mt-4 text-sm font-medium text-slate-500">
                        Cursos completados: <span className="font-bold text-slate-700">{staff.courseEnrolls?.filter((c: any) => c.status === 'COMPLETED').length || 0}</span>
                    </div>
                </div>

                {/* Clinical eMAR Metric (Only Nurse/Caregiver) */}
                 <div className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm ${!isMedicalStaff ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Cumplimiento eMAR</h3>
                            <div className="flex items-baseline gap-1">
                                <div className="text-3xl font-black text-slate-800">
                                    {staff.emarCompliance !== null ? staff.emarCompliance : 'N/A'}<span className="text-lg text-slate-400">%</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl rounded-tr-sm">💊</div>
                    </div>
                    <div className="mt-4 text-sm font-medium text-slate-500 flex justify-between">
                        <span>Exitosas: <span className="font-bold text-emerald-600">{staff.medsGivenRecord || 0}</span></span>
                        <span>Omitidas: <span className="font-bold text-rose-600">{staff.medsMissedRecord || 0}</span></span>
                    </div>
                    {!isMedicalStaff && <p className="text-xs text-slate-400 mt-2 italic">*Métrica exclusiva del área clínica.</p>}
                </div>
            </div>

            {/* Evaluaciones Historial */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-lg font-black text-slate-800">Historial de Evaluaciones HR</h3>
                </div>
                
                {staff.evalsReceived?.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <p className="text-5xl mb-3 border border-slate-100 inline-block p-4 rounded-3xl bg-slate-50">📋</p>
                        <h4 className="font-bold text-lg text-slate-600">Sin Historico</h4>
                        <p className="text-sm mt-1">Este empleado aún no cuenta con evaluaciones u observaciones estructuradas del gerente.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {staff.evalsReceived?.map((eva: any) => (
                            <div key={eva.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`px-3 py-1.5 rounded-lg border font-black text-sm flex items-center gap-1.5 ${getScoreColor(eva.score)}`}>
                                            {eva.score} / 100
                                        </div>
                                        <span className="text-sm font-medium text-slate-500">
                                            {new Date(eva.createdAt).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Por ID: {eva.evaluatorId.substring(0,8)}...
                                    </div>
                                </div>
                                
                                {eva.feedback && (
                                    <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 italic border border-slate-100">
                                        "{eva.feedback}"
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
