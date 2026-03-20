"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';

export default function MedicalBriefingPage() {
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null);
    const [dossiers, setDossiers] = useState<Record<string, string>>({});
    const router = useRouter();

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                // Fetch all patients for the active headquarters
                // Assuming hq-demo-1 for simplicity, in production grab from user session
                const res = await fetch(`/api/corporate/patients?hqId=hq-demo-1`);
                const data = await res.json();
                if (data.success) {
                    setPatients(data.patients);
                }
            } catch (error) {
                console.error("Error fetching patients:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPatients();
    }, []);

    const handleGenerateDossier = async (patientId: string) => {
        setGenerating(patientId);
        try {
            const res = await fetch("/api/med/briefing/monthly", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId })
            });
            const data = await res.json();
            if (data.success) {
                setDossiers(prev => ({ ...prev, [patientId]: data.dossierMarkdown }));
            } else {
                alert(`Error consultando Zendi AI: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión con el Motor de Inteligencia Clínica.");
        } finally {
            setGenerating(null);
        }
    };

    const handlePrint = (patientId: string) => {
        // En un entorno de producción, esto abriría una ventana nueva o usaría un componente de impresión oculto
        window.print();
    };

    return (
        <AppLayout>
            <div className="p-8 max-w-7xl mx-auto min-h-screen pb-32">
                <div className="flex items-center justify-between mb-8 print:hidden">
                    <div>
                        <button onClick={() => router.push('/med')} className="text-indigo-600 hover:text-indigo-800 font-bold mb-2 flex items-center gap-1">← Volver al Módulo Médico</button>
                        <h1 className="text-4xl font-black text-slate-800 tracking-tight">Preparación de Visita Médica M.</h1>
                        <p className="text-slate-500 font-medium text-lg mt-1">Generación de Dossier Clínico Mensual (Últimos 30 días) impulsado por Zendi AI.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><span className="animate-spin text-4xl">⚕️</span></div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* Panel de Pacientes (Oculto en impresión) */}
                        <div className="space-y-4 print:hidden">
                            <h2 className="text-xl font-black text-slate-700 bg-white p-4 rounded-xl shadow-sm border border-slate-200">Residentes Activos</h2>
                            {patients.map(p => (
                                <div key={p.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-300 transition-colors">
                                    <div>
                                        <h3 className="font-black text-lg text-slate-800">{p.name}</h3>
                                        <p className="text-sm font-bold text-slate-500">Habitación {p.roomNumber || 'N/A'}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleGenerateDossier(p.id)}
                                        disabled={generating === p.id}
                                        className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-black rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {generating === p.id ? (
                                            <><span>⏳</span> Analizando 30 Días...</>
                                        ) : (
                                            <><span>✨</span> Zendi Dossier</>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Visores de Dossier (Visibles en Impresión) */}
                        <div className="space-y-8">
                            {Object.entries(dossiers).map(([pid, markdown]) => {
                                const patient = patients.find(p => p.id === pid);
                                return (
                                    <div key={pid} className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 print:shadow-none print:border-none print:m-0 print:p-0">
                                        
                                        {/* Membrete Oficial */}
                                        <div className="border-b-4 border-indigo-900 pb-6 mb-8 flex justify-between items-end">
                                            <div>
                                                <h1 className="text-3xl font-black text-indigo-900 tracking-tighter">Zendity Medical Audit</h1>
                                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Confidential Clinical Dossier</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-slate-800 text-lg">{patient?.name}</p>
                                                <p className="text-slate-500 font-medium text-sm">Fecha de Emisión: {new Date().toLocaleDateString('es-ES')}</p>
                                            </div>
                                        </div>

                                        {/* Markdown Renderizado */}
                                        <div className="prose prose-slate prose-headings:font-black prose-h1:text-2xl prose-h2:text-xl prose-h2:text-indigo-900 prose-h3:text-lg prose-p:font-medium prose-strong:text-slate-800 max-w-none">
                                            <ReactMarkdown>{markdown}</ReactMarkdown>
                                        </div>

                                        {/* Botón de Imprimir (Oculto en la impresión real) */}
                                        <div className="mt-8 pt-6 border-t border-slate-200 print:hidden text-right">
                                            <button onClick={() => handlePrint(pid)} className="py-3 px-8 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 inline-flex">
                                                <span>🖨️</span> Imprimir Dossier Oficial
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    </div>
                )}
            </div>
            
            {/* CSS helper para la impresión */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .prose * {
                        visibility: visible;
                    }
                    .border-indigo-900 {
                        border-bottom-color: #312e81 !important;
                    }
                    /* Selecciona el contenedor del dossier y hazlo visible él y todos sus hijos */
                    .bg-white.p-8.rounded-3xl.shadow-xl {
                        visibility: visible !important;
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .bg-white.p-8.rounded-3xl.shadow-xl * {
                        visibility: visible !important;
                    }
                }
            `}</style>
        </AppLayout>
    );
}
