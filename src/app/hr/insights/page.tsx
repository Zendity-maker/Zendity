"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ShieldAlert, AlertTriangle, AlertOctagon, BrainCircuit } from 'lucide-react';
import WriteIncidentModal from "@/components/hr/WriteIncidentModal";

interface RedFlag {
    id: string;
    type: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    category: string;
    title: string;
    description: string;
    employeeId: string;
    employeeName: string;
    employeeRole: string;
    timestamp: string;
}

export default function ZendiInsightsPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [insights, setInsights] = useState<RedFlag[]>([]);
    const [loading, setLoading] = useState(true);
    
    // For Incident Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [employeesList, setEmployeesList] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;
        async function fetchInsights() {
            try {
                const hqId = user?.hqId || user?.headquartersId || '';
                if (!hqId) return;
                const res = await fetch(`/api/hr/insights?hqId=${hqId}`);
                const data = await res.json();

                if (data.success && Array.isArray(data.insights)) {
                    setInsights(data.insights);
                }
                
                // Fetch staff list for the modal dropdown
                const staffRes = await fetch(`/api/hr/staff?hqId=${hqId}`);
                const staffData = await staffRes.json();
                if (Array.isArray(staffData)) {
                    setEmployeesList(staffData);
                } else if (staffData.success && Array.isArray(staffData.staff)) {
                    setEmployeesList(staffData.staff);
                }
                
            } catch (err) {
                console.error("Error fetching AI Insights:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchInsights();
    }, [user]);

    const handleActionClick = (employeeId: string) => {
        setSelectedEmployeeId(employeeId);
        setIsModalOpen(true);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 animate-pulse">
                <BrainCircuit className="w-16 h-16 text-indigo-400 mb-4 animate-spin-slow" />
                <h2 className="text-xl font-bold text-slate-700">Zendi está analizando los datos operativos...</h2>
                <p className="text-slate-500 mt-2">Correlacionando scores, incidentes y métricas clínicas.</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                        <BrainCircuit className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Centro de Mando AI</h1>
                        <p className="text-slate-500 font-medium mt-1">Monitoreo proactivo de operaciones y disciplina corporativa impulsado por Zendi.</p>
                    </div>
                </div>
            </div>

            {/* Banderas Rojas List */}
            <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-500" /> Banderas Rojas Activas
                    </h2>
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-slate-200 shadow-sm">
                        {insights.length} Alteraciones Detectadas
                    </span>
                </div>

                {insights.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-12 text-center">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-4xl">✨</span>
                        </div>
                        <h3 className="text-2xl font-black text-emerald-800 mb-2">Operación 100% Saludable</h3>
                        <p className="text-emerald-600 font-medium">Zendi no ha detectado ninguna anomalía disciplinaria o de bajo rendimiento en el panel de control.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {insights.map((insight, idx) => (
                            <div key={idx} className={`relative overflow-hidden bg-white rounded-3xl border shadow-sm transition-all hover:shadow-md ${insight.type === 'CRITICAL' ? 'border-rose-300' : insight.type === 'HIGH' ? 'border-orange-300' : 'border-amber-300'}`}>
                                
                                {/* Left Indicator Line */}
                                <div className={`absolute left-0 top-0 bottom-0 w-2 ${insight.type === 'CRITICAL' ? 'bg-rose-500' : insight.type === 'HIGH' ? 'bg-orange-500' : 'bg-amber-500'}`}></div>

                                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-center">
                                    {/* Icon */}
                                    <div className={`shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${insight.type === 'CRITICAL' ? 'bg-rose-50 text-rose-600' : insight.type === 'HIGH' ? 'bg-orange-50 text-orange-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {insight.type === 'CRITICAL' ? <AlertOctagon className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${insight.type === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : insight.type === 'HIGH' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {insight.type === 'CRITICAL' ? 'Crítico' : insight.type === 'HIGH' ? 'Alto' : 'Medio'}
                                            </span>
                                            <span className="text-xs font-bold text-slate-400 capitalize">{insight.category.replace('_', ' ')}</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">{insight.title}</h3>
                                        <p className="text-slate-600 font-medium leading-relaxed">{insight.description}</p>
                                        
                                        <div className="mt-4 flex flex-wrap gap-4 text-sm">
                                            <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 font-bold">
                                                <span className="w-5 h-5 rounded-full bg-indigo-200 flex items-center justify-center text-[10px] text-indigo-800">{insight.employeeName.substring(0,2).toUpperCase()}</span>
                                                {insight.employeeName} <span className="text-indigo-400 font-medium">({insight.employeeRole})</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-slate-500 font-medium">
                                                <span>⏱️</span> Generado: {new Date(insight.timestamp).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <div className="md:border-l md:border-slate-100 md:pl-6 flex flex-col gap-3 shrink-0">
                                        <button 
                                            onClick={() => handleActionClick(insight.employeeId)}
                                            className="w-full md:w-auto bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold transition-transform active:scale-95 shadow-md flex items-center justify-center gap-2"
                                        >
                                            <ShieldAlert className="w-4 h-4" /> Tomar Acción
                                        </button>
                                        <button 
                                            onClick={() => router.push(`/hr/staff/${insight.employeeId}`)}
                                            className="w-full md:w-auto bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-6 py-3 rounded-xl font-bold transition-colors text-center"
                                        >
                                            Ver Perfil
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Incident Modal Triggered by Action Click */}
            {isModalOpen && user && (
               /* The WriteIncidentModal internally sets its own internal local state for employeeId to the first employee if not explicitly driven by props, but we actually want to pre-select it if possible. The component doesn't take an initialEmployeeId prop yet based on previous view_file, so I am passing a filtered array so it ONLY has that employee or all employees depending on needs. But to keep it robust and allow the principal to select someone else if needed, we'll pass all employees. We can't pre-select the dropdown from outside unless we modify the modal. For now, they'll have to select from the dropdown. */
                <WriteIncidentModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    hqId={user?.hqId || user?.headquartersId || ''}
                    supervisorId={user?.id || ''}
                    employees={employeesList}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        // Hard reload to refresh insights after an action
                        window.location.reload();
                    }}
                />
            )}

        </div>
    );
}
