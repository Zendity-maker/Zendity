"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type LeadStage = "PROSPECT" | "TOUR" | "EVALUATION" | "CONTRACT" | "ADMISSION";

interface CRMLead {
    id: string;
    stage: LeadStage;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
}

const STAGES: { key: LeadStage; label: string; icon: string; color: string }[] = [
    { key: "PROSPECT", label: "Prospecto", icon: "", color: "bg-slate-100 border-slate-200" },
    { key: "TOUR", label: "Tour Programado", icon: "", color: "bg-blue-50 border-blue-200" },
    { key: "EVALUATION", label: "Evaluación Médica", icon: "", color: "bg-amber-50 border-amber-200" },
    { key: "CONTRACT", label: "Contrato", icon: "", color: "bg-indigo-50 border-indigo-200" },
    { key: "ADMISSION", label: "Admisión Ofical", icon: "", color: "bg-emerald-50 border-emerald-200" },
];

export default function CRMDashboardPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [leads, setLeads] = useState<CRMLead[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newLead, setNewLead] = useState({ firstName: "", lastName: "", email: "", phone: "" });
    const [saving, setSaving] = useState(false);

    const hqId = user?.hqId || user?.headquartersId;

    useEffect(() => {
        if (hqId) {
            fetchLeads();
        }
    }, [hqId]);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/corporate/crm/leads");
            const data = await res.json();
            if (data.success) {
                setLeads(data.leads);
            }
        } catch (error) {
            console.error("Error fetching leads:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLead = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/corporate/crm/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newLead)
            });
            const data = await res.json();
            if (data.success) {
                setIsModalOpen(false);
                setNewLead({ firstName: "", lastName: "", email: "", phone: "" });
                fetchLeads(); // Refresh board
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error("Error creating lead:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleMoveLead = async (id: string, newStage: LeadStage) => {
        // Optimistic UI update
        const originalLeads = [...leads];
        setLeads(leads.map(l => l.id === id ? { ...l, stage: newStage } : l));

        if (newStage === "ADMISSION") {
            const isConfirmed = window.confirm("¡Atención! Mover este prospecto a Admisión creará automáticamente su Ficha Clínica (LifePlan) y su cuenta del Portal Familiar. ¿Deseas proceder?");
            if (!isConfirmed) {
                setLeads(originalLeads); // Revert
                return;
            }
        }

        try {
            const res = await fetch("/api/corporate/crm/leads", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, stage: newStage })
            });
            const data = await res.json();
            if (!data.success) {
                alert("Error actualizando lead: " + data.error);
                setLeads(originalLeads); // Revert on error
            } else if (newStage === "ADMISSION") {
                alert(" ¡Admisión Exitosa! El expediente clínico ha sido auto-generado. Enfermería ya puede visualizarlo en el sistema.");
            }
        } catch (error) {
            console.error("Error updating lead:", error);
            setLeads(originalLeads);
        }
    };

    // Kanban Drag and Drop Logic
    const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedLeadId(id);
        e.dataTransfer.effectAllowed = "move";
        // Pequeño retardo para que la tarjeta no desaparezca instantáneamente al arrastrar
        setTimeout(() => {
            const el = document.getElementById(`lead-${id}`);
            if (el) el.classList.add('opacity-50');
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent, id: string) => {
        setDraggedLeadId(null);
        const el = document.getElementById(`lead-${id}`);
        if (el) el.classList.remove('opacity-50');
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necesario para permitir el drop
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, newStage: LeadStage) => {
        e.preventDefault();
        if (draggedLeadId) {
            const lead = leads.find(l => l.id === draggedLeadId);
            if (lead && lead.stage !== newStage) {
                handleMoveLead(draggedLeadId, newStage);
            }
        }
        setDraggedLeadId(null);
    };


    if (loading) return <div className="p-10 font-bold text-center text-indigo-600 animate-pulse">Cargando ZENDITY CRM...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col pt-4">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-4 gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <span></span> Admisiones y CRM
                    </h1>
                    <p className="text-slate-500 text-sm max-w-xl">
                        Acelerador B2B de Admisiones. Arrastre residentes a "Admisión" para auto-generar su Ficha Clínica PAI.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => router.push('/corporate')} className="px-5 py-2.5 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                        Volver al Inicio
                    </button>
                    <button onClick={() => setIsModalOpen(true)} className="px-5 py-2.5 bg-indigo-600 shadow-[0_4px_15px_rgba(79,70,229,0.3)] rounded-xl text-sm font-bold text-white hover:bg-indigo-500 active:scale-95 transition-all">
                        + Nuevo Ingreso
                    </button>
                </div>
            </div>

            {/* KANBAN BOARD (Horizontal Scroll) */}
            <div className="flex-1 overflow-x-auto pb-6">
                <div className="flex gap-6 h-full min-h-[600px] min-w-max">
                    {STAGES.map((stage) => {
                        const stageLeads = leads.filter(l => l.stage === stage.key);

                        return (
                            <div
                                key={stage.key}
                                className={`flex-shrink-0 w-80 rounded-2xl border ${stage.color} flex flex-col overflow-hidden transition-colors ${draggedLeadId ? 'hover:bg-slate-50 border-dashed' : ''}`}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage.key)}
                            >
                                {/* Stage Header */}
                                <div className="p-4 bg-white/50 backdrop-blur-sm border-b border-inherit flex justify-between items-center pointer-events-none">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{stage.icon}</span>
                                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{stage.label}</h3>
                                    </div>
                                    <span className="bg-white/80 px-2 py-0.5 rounded-full text-xs font-bold text-slate-600 shadow-sm border border-slate-200">
                                        {stageLeads.length}
                                    </span>
                                </div>

                                {/* Leads List */}
                                <div className="p-4 flex-1 overflow-y-auto space-y-3 relative min-h-[150px]">
                                    {stageLeads.map(lead => (
                                        <div
                                            key={lead.id}
                                            id={`lead-${lead.id}`}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, lead.id)}
                                            onDragEnd={(e) => handleDragEnd(e, lead.id)}
                                            className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative z-10"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-slate-800 text-md leading-tight">{lead.firstName} {lead.lastName}</h4>

                                                {/* Dropdown for next stage (Seguro para móviles que no tienen Drag'n'Drop) */}
                                                <select
                                                    className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 border border-slate-200 text-xs rounded-lg px-2 max-w-[100px] bg-slate-50 cursor-pointer shadow-sm transition-opacity"
                                                    value={lead.stage}
                                                    onChange={(e) => handleMoveLead(lead.id, e.target.value as LeadStage)}
                                                >
                                                    {STAGES.map(s => <option key={s.key} value={s.key}>Mover a: {s.label}</option>)}
                                                </select>
                                                <span className="text-slate-300 group-hover:hidden select-none">⠿</span>
                                            </div>

                                            <div className="text-xs text-slate-500 space-y-1">
                                                {lead.email && <div className="truncate pointer-events-none"> {lead.email}</div>}
                                                {lead.phone && <div className="pointer-events-none"> {lead.phone}</div>}
                                            </div>

                                            {/* Action Hints */}
                                            {stage.key === "PROSPECT" && <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] font-medium text-slate-400 pointer-events-none">→ Programar Tour familiar</div>}
                                            {stage.key === "EVALUATION" && <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] font-medium text-amber-600 pointer-events-none"> Recabar Firma Médica</div>}
                                            {stage.key === "CONTRACT" && <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-center pointer-events-none">¡Listo para Mover a Admisión!</div>}
                                        </div>
                                    ))}
                                    {stageLeads.length === 0 && (
                                        <div className="absolute inset-4 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs font-medium -z-10 bg-slate-50/50">
                                            Arrastra aquí
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal Nuevo Ingreso */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                            <h2 className="text-2xl font-black text-slate-800">Crear Prospecto</h2>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">
                                
                            </button>
                        </div>

                        <form onSubmit={handleCreateLead} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Nombre del Residente</label>
                                    <input type="text" required value={newLead.firstName} onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="Ej: Maria" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Apellidos</label>
                                    <input type="text" required value={newLead.lastName} onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="Ej: Rodriguez" />
                                </div>
                            </div>

                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                                <h3 className="font-bold text-indigo-900 text-sm mb-3">Datos del Familiar Reposable</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-indigo-600 mb-1 uppercase tracking-wider">Email (Para enviar contrato y Portal)</label>
                                        <input type="email" required value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="familiar@correo.com" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-indigo-600 mb-1 uppercase tracking-wider">Teléfono</label>
                                        <input type="tel" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="+1 787..." />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" disabled={saving} className="w-full py-4 mt-6 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-sm">
                                {saving ? 'Añadiendo a Pipeline...' : 'Iniciar Seguimiento de Venta'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
