"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon, ChatBubbleBottomCenterTextIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

export default function TriageDashboardPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState<string | null>(null);
    const router = useRouter();

    const fetchTickets = async () => {
        try {
            const res = await fetch(`/api/corporate/triage/pending?t=${Date.now()}`);
            const data = await res.json();
            if (data.success) {
                setTickets(data.tickets);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
        const interval = setInterval(fetchTickets, 15000); // Polling cada 15s para auto-actualización
        return () => clearInterval(interval);
    }, []);

    const resolveTicket = async (ticketId: string, moduleName: string) => {
        if (!confirm("¿Marcar este ticket como resuelto y sacarlo de la bandeja?")) return;
        setResolving(ticketId);
        try {
            const res = await fetch("/api/corporate/triage/resolve", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticketId, moduleName })
            });
            const data = await res.json();
            if (data.success) {
                // Remover el ticket localmente para UI instantánea
                setTickets(prev => prev.filter(t => t.id !== ticketId));
                router.refresh();
            } else {
                alert("Error al resolver: " + data.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setResolving(null);
        }
    };

    // Agrupación Kanban
    const clinicalTickets = tickets.filter(t => t.module === 'CLINICAL_ALERT');
    const complaintTickets = tickets.filter(t => t.module === 'COMPLAINT');
    const maintenanceTickets = tickets.filter(t => t.module === 'INCIDENT');

    const TicketCard = ({ ticket }: { ticket: any }) => {
        const isResolving = resolving === ticket.id;

        let bgColor = "bg-slate-50 border-slate-200";
        let icon = null;
        if (ticket.severity === 'HIGH') { bgColor = "bg-rose-50 border-rose-200"; icon = <ExclamationTriangleIcon className="w-6 h-6 text-rose-600" />; }
        else if (ticket.severity === 'MEDIUM') { bgColor = "bg-amber-50 border-amber-200"; icon = <ChatBubbleBottomCenterTextIcon className="w-6 h-6 text-amber-600" />; }
        else { bgColor = "bg-slate-200 border-slate-300"; icon = <WrenchScrewdriverIcon className="w-6 h-6 text-slate-700" />; }

        const timeStr = new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <div className={`p-5 rounded-2xl border shadow-sm flex flex-col gap-3 transition-all ${bgColor} ${isResolving ? 'opacity-50 scale-95' : 'hover:shadow-md hover:-translate-y-1 block'}`}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/80 p-2 rounded-xl shadow-sm backdrop-blur-sm">{icon}</div>
                        <div>
                            <h4 className="font-bold text-slate-800 leading-tight">{ticket.title}</h4>
                            <p className="text-xs font-black text-slate-500 uppercase mt-0.5">{ticket.patientName} • Cuarto {ticket.roomNumber}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/60 p-4 rounded-xl border border-white/40 text-sm font-medium text-slate-800 italic shadow-inner">
                    "{ticket.description}"
                    {ticket.photoUrl && (
                        <div className="mt-4 border-t border-slate-200/50 pt-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><span>📷</span> Evidencia Fotográfica Adjunta</p>
                            <a href={ticket.photoUrl} target="_blank" rel="noopener noreferrer" className="block w-full max-h-48 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:ring-2 hover:ring-indigo-400 transition-all cursor-zoom-in group">
                                <img src={ticket.photoUrl} alt="Reporte Evidencia" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            </a>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/50">
                    <span className="text-xs font-bold text-slate-400">Generado: {timeStr}</span>
                    <button
                        onClick={() => resolveTicket(ticket.id, ticket.module)}
                        disabled={isResolving}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors disabled:bg-slate-400 active:scale-95"
                    >
                        <CheckCircleIcon className="w-4 h-4" /> {isResolving ? 'Cerrando...' : 'Resolver Ticket'}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-100 p-6 md:p-10 font-sans">
            <div className="max-w-[1400px] mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <Link href="/corporate" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition mb-3 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                            <ArrowLeftIcon className="w-4 h-4" /> Volver al Dashboard Corporativo
                        </Link>
                        <h1 className="text-5xl font-black text-slate-900 tracking-tight">Centro de Triage</h1>
                        <p className="text-slate-500 font-medium mt-2 text-lg">Bandeja de Entrada Administrativa (Reportes Diarios de Cuidadores en Tiempo Real)</p>
                    </div>
                    <div className="bg-white px-8 py-5 rounded-[2rem] shadow-xl border border-slate-100 flex items-center gap-5">
                        <div className="w-16 h-16 bg-indigo-50 border-4 border-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-black text-2xl">
                            {tickets.length}
                        </div>
                        <div>
                            <p className="font-black text-slate-800 text-xl">Tickets Incompletos</p>
                            <p className="text-sm text-rose-500 font-bold uppercase tracking-wider">Esperando Intervención</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center gap-4 animate-in fade-in">
                        <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="font-bold text-slate-400 text-xl uppercase tracking-widest">Rastreando reportes de planta...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-bottom-8 duration-700">

                        {/* Columna 1: Alertas Clínicas */}
                        <div className="space-y-4">
                            <div className="bg-rose-600 text-white px-6 py-5 rounded-3xl shadow-lg flex justify-between items-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                                <h3 className="font-black text-xl flex items-center gap-3"><ExclamationTriangleIcon className="w-7 h-7" /> Alertas Clínicas</h3>
                                <span className="bg-white text-rose-600 px-4 py-1.5 rounded-full text-sm font-black shadow-inner">{clinicalTickets.length}</span>
                            </div>
                            {clinicalTickets.length === 0 && <div className="text-center p-10 bg-white border border-slate-200 rounded-[2rem] text-slate-400 font-bold shadow-sm">Bandeja Limpia ✨</div>}
                            <div className="space-y-4">
                                {clinicalTickets.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </div>
                        </div>

                        {/* Columna 2: Quejas Familiares */}
                        <div className="space-y-4">
                            <div className="bg-amber-500 text-white px-6 py-5 rounded-3xl shadow-lg flex justify-between items-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                                <h3 className="font-black text-xl flex items-center gap-3"><ChatBubbleBottomCenterTextIcon className="w-7 h-7" /> Familiares</h3>
                                <span className="bg-white text-amber-600 px-4 py-1.5 rounded-full text-sm font-black shadow-inner">{complaintTickets.length}</span>
                            </div>
                            {complaintTickets.length === 0 && <div className="text-center p-10 bg-white border border-slate-200 rounded-[2rem] text-slate-400 font-bold shadow-sm">Bandeja Limpia ✨</div>}
                            <div className="space-y-4">
                                {complaintTickets.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </div>
                        </div>

                        {/* Columna 3: Mantenimiento / Operaciones */}
                        <div className="space-y-4">
                            <div className="bg-slate-800 text-white px-6 py-5 rounded-3xl shadow-lg flex justify-between items-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                                <h3 className="font-black text-xl flex items-center gap-3"><WrenchScrewdriverIcon className="w-7 h-7" /> Operaciones</h3>
                                <span className="bg-white text-slate-800 px-4 py-1.5 rounded-full text-sm font-black shadow-inner">{maintenanceTickets.length}</span>
                            </div>
                            {maintenanceTickets.length === 0 && <div className="text-center p-10 bg-white border border-slate-200 rounded-[2rem] text-slate-400 font-bold shadow-sm">Bandeja Limpia ✨</div>}
                            <div className="space-y-4">
                                {maintenanceTickets.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </div>
                        </div>

                    </div>
                )}

            </div>
        </div>
    );
}
