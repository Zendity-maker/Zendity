"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

// Kanban Stages Definition
const STAGES = [
    { id: 'PROSPECT', label: 'Prospecto Nuevo', icon: '📞', color: 'bg-slate-100', border: 'border-slate-200' },
    { id: 'TOUR', label: 'Tour Agendado', icon: '🏛️', color: 'bg-blue-50', border: 'border-blue-200' },
    { id: 'EVALUATION', label: 'Evaluación Médica', icon: '🩺', color: 'bg-amber-50', border: 'border-amber-200' },
    { id: 'CONTRACT', label: 'Contrato Legal', icon: '✍️', color: 'bg-indigo-50', border: 'border-indigo-200' },
    { id: 'ADMISSION', label: 'Ingreso', icon: '🏥', color: 'bg-emerald-50', border: 'border-emerald-200' }
];

export default function ZendityCRMPage() {
    const { user } = useAuth();
    const activeHqId = user?.headquartersId || user?.hqId;

    const [leads, setLeads] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [newLeadUrl, setNewLead] = useState({ firstName: '', lastName: '', phone: '', email: '' });

    const fetchLeads = async () => {
        if (!activeHqId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/corporate/crm?headquartersId=${activeHqId}`);
            if (res.ok) {
                const data = await res.json();
                setLeads(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, [activeHqId]);

    const handleCreateLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeHqId) return;

        try {
            const res = await fetch('/api/corporate/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'CREATE',
                    headquartersId: activeHqId,
                    ...newLeadUrl
                })
            });

            if (res.ok) {
                setCreateModalOpen(false);
                setNewLead({ firstName: '', lastName: '', phone: '', email: '' });
                fetchLeads();
            } else {
                alert("Error al crear prospecto");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const updateLeadStage = async (leadId: string, newStage: string) => {
        const lead = leads.find(l => l.id === leadId);
        if (!activeHqId || !lead) return;

        // Front-End Validation for No-Code Error strict policy
        if (newStage === 'ADMISSION' && (!lead.medicalEvaluationCompleted || !lead.contractSigned)) {
            alert("No-Code Error Block: No puedes ingresar a este candidato. Asegúrate de tener su Evaluación Médica y Contrato Firmado marcados.");
            return;
        }

        try {
            // Optimistic UI update
            setLeads(leads.map(l => l.id === leadId ? { ...l, stage: newStage } : l));

            const res = await fetch('/api/corporate/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UPDATE_STAGE', leadId, stage: newStage })
            });

            if (!res.ok) {
                const errData = await res.json();
                alert(errData.error || "Error al actualizar etapa");
                fetchLeads(); // Revert Optimistic
            } else {
                if (newStage === 'ADMISSION') {
                    alert('Conversión exitosa. Prospecto añadido al módulo Médico oficialmente.');
                }
                if (newStage === 'CONTRACT') {
                    // Trigger DocuSign Webhook asíncrono
                    fetch('/api/crm/docusign', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ leadId, hqId: activeHqId })
                    }).then(res => {
                        if (res.ok) alert('El Contrato Electrónico ha sido despachado a la bandeja del prospecto (Vía DocuSign).');
                    });
                }
            }
        } catch (error) {
            console.error(error);
            fetchLeads(); // Revert
        }
    };

    const toggleRequirement = async (leadId: string, type: 'medical' | 'contract', currentValue: boolean) => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;

        const payload = {
            action: 'UPDATE_REQUIREMENTS',
            leadId,
            medicalEvaluationCompleted: type === 'medical' ? !currentValue : lead.medicalEvaluationCompleted,
            contractSigned: type === 'contract' ? !currentValue : lead.contractSigned
        };

        try {
            const res = await fetch('/api/corporate/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) fetchLeads();
        } catch (error) {
            console.error(error);
        }
    };

    const onDragStart = (e: React.DragEvent, leadId: string) => {
        e.dataTransfer.setData("leadId", leadId);
    };

    const onDrop = (e: React.DragEvent, targetStage: string) => {
        e.preventDefault();
        const leadId = e.dataTransfer.getData("leadId");
        if (leadId) updateLeadStage(leadId, targetStage);
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    if (isLoading) {
        return <div className="p-10 text-center animate-pulse text-slate-500 font-bold">Cargando Tablero CRM...</div>;
    }

    return (
        <div className="p-8 h-[calc(100vh-80px)] overflow-hidden flex flex-col space-y-6">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Zendity B2B Sales</h1>
                    <p className="text-slate-500 mt-1">Embudo de Adquisición de Residentes (Kanban)</p>
                </div>
                <button
                    onClick={() => setCreateModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg flex items-center gap-2"
                >
                    <span>+ Añadir Prospecto Manual</span>
                </button>
            </div>

            <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
                {STAGES.map((stage) => {
                    const columnLeads = leads.filter(l => l.stage === stage.id);
                    return (
                        <div
                            key={stage.id}
                            className={`flex flex-col min-w-[320px] max-w-[320px] rounded-3xl border-2 border-dashed ${stage.border} bg-slate-50/50 p-4`}
                            onDrop={(e) => onDrop(e, stage.id)}
                            onDragOver={onDragOver}
                        >
                            <h3 className="font-black text-slate-700 mb-4 flex justify-between items-center px-2">
                                <span>{stage.icon} {stage.label}</span>
                                <span className="bg-white border rounded-full px-2 py-0.5 text-xs text-slate-500">{columnLeads.length}</span>
                            </h3>

                            <div className="flex flex-col gap-3 overflow-y-auto">
                                {columnLeads.map(lead => (
                                    <div
                                        key={lead.id}
                                        draggable
                                        onDragStart={(e) => onDragStart(e, lead.id)}
                                        className={`bg-white border p-4 rounded-2xl shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-400 transition-colors group ${stage.color} relative`}
                                    >
                                        <p className="font-bold text-slate-800 mb-1">{lead.firstName} {lead.lastName}</p>
                                        {lead.phone && <p className="text-xs text-slate-500">📞 {lead.phone}</p>}
                                        {lead.email && <p className="text-xs text-slate-500">📧 {lead.email}</p>}

                                        {/* Zendi AI Indicators */}
                                        {(lead.transcripts?.length > 0 || lead.interactions?.length > 0) && (
                                            <div className="mt-3 flex gap-2">
                                                {lead.transcripts?.length > 0 && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-lg">🎤 IA Voz Activa</span>}
                                                {lead.interactions?.length > 0 && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-lg">💬 Auto-SMS</span>}
                                            </div>
                                        )}

                                        {/* Admission Strict Checklist */}
                                        {(stage.id === 'EVALUATION' || stage.id === 'CONTRACT' || stage.id === 'ADMISSION') && (
                                            <div className="mt-4 pt-3 border-t border-slate-200/50 space-y-2">
                                                <button
                                                    onClick={() => toggleRequirement(lead.id, 'medical', lead.medicalEvaluationCompleted)}
                                                    className="flex items-center gap-2 text-xs w-full text-left"
                                                >
                                                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${lead.medicalEvaluationCompleted ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                                                        {lead.medicalEvaluationCompleted && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </span>
                                                    <span className={lead.medicalEvaluationCompleted ? 'text-slate-600 font-medium line-through opacity-70' : 'text-slate-700 font-bold'}>Evaluación Médica (Pre-Ingreso)</span>
                                                </button>

                                                <button
                                                    onClick={() => toggleRequirement(lead.id, 'contract', lead.contractSigned)}
                                                    className="flex items-center gap-2 text-xs w-full text-left"
                                                >
                                                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${lead.contractSigned ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                                                        {lead.contractSigned && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </span>
                                                    <span className={lead.contractSigned ? 'text-slate-600 font-medium line-through opacity-70' : 'text-slate-700 font-bold'}>Firma DocuSign Completada</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Create Lead Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-indigo-600 p-6">
                            <h2 className="text-xl font-bold text-white">Nuevo Prospecto (Lead)</h2>
                        </div>
                        <form onSubmit={handleCreateLead} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 uppercase">Nombre</label><input required value={newLeadUrl.firstName} onChange={e => setNewLead({ ...newLeadUrl, firstName: e.target.value })} className="w-full bg-slate-50 border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500" /></div>
                                <div><label className="text-xs font-bold text-slate-500 uppercase">Apellido</label><input required value={newLeadUrl.lastName} onChange={e => setNewLead({ ...newLeadUrl, lastName: e.target.value })} className="w-full bg-slate-50 border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 uppercase">Teléfono</label><input type="tel" value={newLeadUrl.phone} onChange={e => setNewLead({ ...newLeadUrl, phone: e.target.value })} className="w-full bg-slate-50 border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500" /></div>
                                <div><label className="text-xs font-bold text-slate-500 uppercase">Email</label><input type="email" value={newLeadUrl.email} onChange={e => setNewLead({ ...newLeadUrl, email: e.target.value })} className="w-full bg-slate-50 border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500" /></div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setCreateModalOpen(false)} className="px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl w-full hover:bg-slate-50">Cancelar</button>
                                <button type="submit" className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl w-full hover:bg-indigo-700">Crear Prospecto</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
