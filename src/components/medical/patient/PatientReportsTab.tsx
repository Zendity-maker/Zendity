"use client";

import { useState, useEffect } from "react";
import { DocumentTextIcon, PrinterIcon, CalendarIcon, UserIcon } from "@heroicons/react/24/outline";

export default function PatientReportsTab({ patientId, patientName }: { patientId: string, patientName?: string }) {
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotes = async () => {
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/reports`);
            const data = await res.json();
            if (data.success) {
                setNotes(data.notes);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotes();
    }, [patientId]);

    // Agrupar por Mes
    const groupedNotes = notes.reduce((acc: any, note: any) => {
        const date = new Date(note.createdAt);
        const monthYear = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
        if (!acc[monthYear]) acc[monthYear] = [];
        acc[monthYear].push(note);
        return acc;
    }, {});

    const printDocument = () => {
        window.print();
    };

    // Si quieres imprimir individual
    const printSingle = (noteId: string) => {
        // En una implementación real más compleja se puede aislar en CSS o abrir nueva pestaña,
        // pero por ahora imprimimos el contexto actual y confiamos en el CSS.
        // O mejor: simplemente llamamos a window.print()
        alert("Para imprimir individual, asegúrate de mantener expandido el reporte deseado.");
        window.print();
    };

    if (loading) return <div className="p-10 text-center font-bold text-slate-400">Cargando reportes clínicos...</div>;
    
    // Filtrar solo las Alertas (Clinical) y Familiares para el Resumen
    // Triage guarda el título como: "Resolución de Ticket: Queja / Situación Familiar" o "Alerta Sensible"

    return (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
            
            <div className="flex justify-between items-end mb-8 print:hidden border-b border-slate-100 pb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <DocumentTextIcon className="w-8 h-8 text-indigo-600" />
                        Reportes de Triage y Clínicos
                    </h2>
                    <p className="text-slate-500 font-medium mt-1">
                        Historial de acciones tomadas en alertas clínicas y situaciones familiares.
                    </p>
                </div>
                <button 
                    onClick={printDocument}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
                >
                    <PrinterIcon className="w-5 h-5" />
                    Imprimir Resumen Global (PDF)
                </button>
            </div>

            {/* Print Header solo visible al imprimir */}
            <div className="hidden print:block mb-8 border-b-2 border-slate-800 pb-4">
                <h1 className="text-3xl font-black text-slate-900">Historial Clínico de Resolución</h1>
                <p className="text-xl font-medium text-slate-600 mt-1">Expediente Oficial Zendity SaaS</p>
                <div className="mt-4 flex gap-8 text-sm font-bold text-slate-500">
                    <p>Paciente ID: {patientId.split('-')[0]}</p>
                    <p>Fecha de Extracción: {new Date().toLocaleDateString('es-ES')}</p>
                </div>
            </div>

            {Object.keys(groupedNotes).length === 0 ? (
                <div className="text-center p-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 print:hidden text-slate-400 font-bold">
                    No se han registrado resoluciones de Triage para este residente.
                </div>
            ) : (
                <div className="space-y-10">
                    {Object.keys(groupedNotes).map(monthYear => (
                        <div key={monthYear} className="print:break-inside-avoid">
                            <h3 className="text-xl font-black text-indigo-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                                <CalendarIcon className="w-6 h-6 text-indigo-500" /> {monthYear}
                            </h3>
                            
                            <div className="space-y-4">
                                {groupedNotes[monthYear].map((note: any) => (
                                    <div key={note.id} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl print:border-slate-300 print:break-inside-avoid">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="font-bold text-slate-800 text-lg leading-tight">{note.title}</h4>
                                            <span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 border border-slate-200 rounded-full print:border-none print:px-0">
                                                {new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        
                                        <div className="bg-white p-4 rounded-xl border border-slate-100 text-slate-700 font-medium leading-relaxed print:border-slate-300">
                                            {note.content.split('\\n').map((line: string, i: number) => (
                                                <span key={i}>{line}<br/></span>
                                            ))}
                                        </div>

                                        <div className="flex justify-between items-center mt-4">
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                                                <UserIcon className="w-4 h-4 bg-slate-200 p-0.5 rounded-full" />
                                                Reportado por: <span className="text-slate-700">{note.author?.name} ({note.author?.role})</span>
                                            </div>
                                            <button onClick={() => printSingle(note.id)} className="print:hidden text-xs font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                                <PrinterIcon className="w-4 h-4" /> Imprimir
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
