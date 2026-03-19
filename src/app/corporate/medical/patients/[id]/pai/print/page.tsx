"use client";

import { useEffect, useState, use } from "react";
import { PrinterIcon } from "@heroicons/react/24/outline";

export default function PAIOfficialPrintRecord(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const [patientInfo, setPatientInfo] = useState<any>(null);
    const [hqInfo, setHqInfo] = useState<any>(null);
    const [pai, setPai] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadPrintData = async () => {
            try {
                // 1. Fetch Patient + HQ
                const patRes = await fetch(`/api/corporate/patients/${params.id}`);
                const patData = await patRes.json();
                if (patData.success) {
                    setPatientInfo(patData.patient);
                    setHqInfo(patData.patient.headquarters);
                }

                // 2. Fetch PAI
                const paiRes = await fetch(`/api/corporate/patients/${params.id}/pai`);
                const paiData = await paiRes.json();
                if (paiData.success && paiData.lifePlan) {
                    setPai(paiData.lifePlan);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        loadPrintData();
    }, [params.id]);

    if (isLoading) return <div className="p-10 font-bold text-center text-slate-800 text-black animate-pulse">Generando Documento PAI Oficial...</div>;
    if (!pai) return <div className="p-10 font-bold text-center text-rose-500">Error: El residente no tiene un PAI registrado.</div>;

    const risks = pai.risks || [];
    const goals = pai.goals || [];
    const recommendedServices = pai.recommendedServices || [];

    return (
        <div className="min-h-screen bg-slate-200 p-8 font-sans print:p-0 print:bg-white flex flex-col items-center">
            
            {/* UI Actions Navbar (Hidden exactly when printing) */}
            <div className="w-full max-w-[850px] flex justify-end mb-4 print:hidden">
                <button 
                    onClick={() => window.print()} 
                    className="flex items-center gap-2 bg-slate-800 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold shadow-xl transition-all active:scale-95"
                >
                    <PrinterIcon className="w-5 h-5"/> Imprimir PDF Oficial
                </button>
            </div>

            {/* A4 Document Container */}
            <div className="w-full max-w-[850px] bg-white shadow-2xl print:shadow-none p-12 md:p-16 text-slate-900 border border-slate-300 print:border-none">
                
                {/* HEADERS & LOGO (Large & Centered requested by User) */}
                <div className="flex flex-col items-center text-center pb-8 border-b-2 border-slate-800 mb-8">
                    {hqInfo?.logoUrl ? (
                        <img src={hqInfo.logoUrl} alt={hqInfo.name} className="h-28 object-contain mb-4" />
                    ) : (
                        <div className="text-4xl font-black tracking-tighter text-slate-900 mb-3">{hqInfo?.name || "Zendity Partner"}</div>
                    )}
                    <h1 className="text-2xl font-black uppercase tracking-widest text-slate-800">Plan Asistencial Individualizado (PAI)</h1>
                    <p className="text-sm font-bold text-slate-800 text-black uppercase mt-1">Documento Clínico - Revisión Semestral | Uso Interno y Familiar</p>
                    <p className="text-xs text-slate-700 font-medium mt-1">{hqInfo?.address || 'Dirección de la Sede'} | {hqInfo?.contactEmail || 'contacto@sede.com'} | Tel: {hqInfo?.contactPhone || 'N/A'}</p>
                </div>

                {/* Top Quick Attributes */}
                <div className="grid grid-cols-4 gap-4 text-sm font-medium mb-10 bg-slate-50 border border-slate-200 p-4 rounded-lg print:border-none print:p-2">
                    <div><span className="font-bold text-slate-900 text-black font-black uppercase text-[10px] block">Residente</span> <span className="font-black text-base">{patientInfo?.name}</span></div>
                    <div><span className="font-bold text-slate-900 text-black font-black uppercase text-[10px] block">Fecha de Inicio</span> {pai.startDate ? new Date(pai.startDate).toLocaleDateString() : 'N/D'}</div>
                    <div><span className="font-bold text-slate-900 text-black font-black uppercase text-[10px] block">Próxima Revisión</span> {pai.nextReview ? new Date(pai.nextReview).toLocaleDateString() : 'N/D'}</div>
                    <div>
                        <span className="font-bold text-slate-900 text-black font-black uppercase text-[10px] block">Estado</span>
                        <span className={`font-black ${pai.status === 'APPROVED' ? 'text-emerald-800 font-black' : 'text-amber-600'}`}>{pai.status === 'APPROVED' ? 'VIGENTE (FIRMADO)' : 'Borrador'}</span>
                    </div>
                </div>

                {/* 1. Perfil */}
                <section className="mb-8 break-inside-avoid">
                    <h2 className="text-lg font-black bg-slate-800 text-white px-3 py-1 mb-4 uppercase tracking-wider">1. Identificación y Perfil del Residente</h2>
                    <table className="w-full text-sm border-collapse">
                        <tbody>
                            <tr className="border-b"><th className="py-2 text-left w-1/4 font-bold text-slate-900 text-black font-black">Edad</th><td className="py-2 font-medium">{patientInfo?.dateOfBirth ? `${new Date().getFullYear() - new Date(patientInfo.dateOfBirth).getFullYear()} años` : 'N/D'}</td></tr>
                            <tr className="border-b"><th className="py-2 text-left font-bold text-slate-900 text-black font-black">Habitación</th><td className="py-2 font-medium">{patientInfo?.roomNumber || 'N/A'}</td></tr>
                            <tr className="border-b"><th className="py-2 text-left font-bold text-slate-900 text-black font-black">Fuente de Apoyo</th><td className="py-2 font-medium">{pai.supportSource || 'N/D'}</td></tr>
                        </tbody>
                    </table>
                </section>

                {/* 2. Clinico */}
                <section className="mb-8 break-inside-avoid">
                    <h2 className="text-lg font-black bg-slate-800 text-white px-3 py-1 mb-4 uppercase tracking-wider">2. Resumen Clínico Actual</h2>
                    <table className="w-full text-sm border-collapse">
                        <tbody>
                            <tr className="border-b"><th className="py-2 text-left w-1/4 font-bold text-slate-900 text-black font-black">Diagnósticos</th><td className="py-2 font-medium">{pai.clinicalSummary || 'N/D'}</td></tr>
                            <tr className="border-b"><th className="py-2 text-left font-bold text-slate-900 text-black font-black">Dieta</th><td className="py-2 font-medium">{pai.dietDetails || patientInfo?.diet || 'N/D'}</td></tr>
                            <tr className="border-b"><th className="py-2 text-left font-bold text-slate-900 text-black font-black">Movilidad</th><td className="py-2 font-medium">{pai.mobility || 'N/D'}</td></tr>
                            <tr className="border-b"><th className="py-2 text-left font-bold text-slate-900 text-black font-black">Continencia</th><td className="py-2 font-medium">{pai.continence || 'N/D'}</td></tr>
                            <tr className="border-b"><th className="py-2 text-left font-bold text-slate-900 text-black font-black">Nivel Cognitivo</th><td className="py-2 font-medium">{pai.cognitiveLevel || 'N/D'}</td></tr>
                        </tbody>
                    </table>
                </section>

                {/* 3. Riesgos */}
                <section className="mb-8 break-inside-avoid">
                    <h2 className="text-lg font-black bg-slate-800 text-white px-3 py-1 mb-4 uppercase tracking-wider">3. Riesgos y Prioridades de Atención</h2>
                    <table className="w-full text-sm border border-slate-300">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="p-2 border border-slate-300 font-bold text-left">Área Prioritaria</th>
                                <th className="p-2 border border-slate-300 font-bold text-left">Hallazgo / Necesidad</th>
                                <th className="p-2 border border-slate-300 font-bold text-center">Prioridad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {risks.length > 0 ? risks.map((r: any, i: number) => (
                                <tr key={i}>
                                    <td className="p-2 border border-slate-300 font-bold">{r.area}</td>
                                    <td className="p-2 border border-slate-300">{r.finding}</td>
                                    <td className="p-2 border border-slate-300 text-center font-bold">{r.priority}</td>
                                </tr>
                            )) : <tr><td colSpan={3} className="p-4 text-center text-slate-700">Sin riesgos registrados</td></tr>}
                        </tbody>
                    </table>
                    <div className="mt-3 text-sm p-3 bg-slate-50 border border-slate-200"><span className="font-bold">Resumen Interdisciplinario:</span> {pai.interdisciplinarySummary || 'N/D'}</div>
                </section>

                {/* 4. Objetivos */}
                <section className="mb-8 break-inside-avoid">
                    <h2 className="text-lg font-black bg-slate-800 text-white px-3 py-1 mb-4 uppercase tracking-wider">4. Objetivos del PAI y Plan de Intervención</h2>
                    <table className="w-full text-sm border border-slate-300">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="p-2 border border-slate-300 font-bold text-left w-1/4">Objetivo</th>
                                <th className="p-2 border border-slate-300 font-bold text-left">Acción / Intervención</th>
                                <th className="p-2 border border-slate-300 font-bold text-center">Responsable</th>
                                <th className="p-2 border border-slate-300 font-bold text-center">Frecuencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {goals.length > 0 ? goals.map((g: any, i: number) => (
                                <tr key={i}>
                                    <td className="p-2 border border-slate-300 font-bold">{g.objective}</td>
                                    <td className="p-2 border border-slate-300">{g.action}</td>
                                    <td className="p-2 border border-slate-300 text-center text-xs">{g.responsible}</td>
                                    <td className="p-2 border border-slate-300 text-center text-xs">{g.frequency}</td>
                                </tr>
                            )) : <tr><td colSpan={4} className="p-4 text-center text-slate-700">Sin intervenciones registradas</td></tr>}
                        </tbody>
                    </table>
                </section>

                {/* Marketplace / Commercial Extension */}
                {recommendedServices.length > 0 && (
                    <section className="mb-8 break-inside-avoid print:bg-orange-50/50 p-4 border-2 border-orange-200">
                        <h2 className="text-lg font-black text-orange-900 mb-3 border-b border-orange-200 pb-2 uppercase tracking-wider">Asistencia Comercial / Servicios Recomendados ({hqInfo?.name})</h2>
                        <ul className="space-y-3">
                            {recommendedServices.map((rs: any, i: number) => (
                                <li key={i} className="text-sm flex flex-col md:flex-row md:justify-between border-b border-orange-100 pb-2">
                                    <div className="flex-1">
                                        <div className="font-black text-slate-800">{rs.serviceName}</div>
                                        <div className="text-slate-900 text-black font-black mt-1">{rs.description}</div>
                                    </div>
                                    <div className="font-black text-orange-700 mt-2 md:mt-0 whitespace-nowrap">Estimado: <br className="hidden md:block"/>{rs.price}</div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* 5. Seguimiento */}
                <section className="mb-16 break-inside-avoid">
                    <h2 className="text-lg font-black bg-slate-800 text-white px-3 py-1 mb-4 uppercase tracking-wider">5. Seguimiento, Educación y Preferencias</h2>
                    <ul className="space-y-3 text-sm">
                        <li><span className="font-bold">Educación al Cuidador/Familia:</span> {pai.familyEducation}</li>
                        <li><span className="font-bold">Preferencias del Residente:</span> {pai.preferences}</li>
                        <li><span className="font-bold">Criterios de Revisión:</span> {pai.revisionCriteria}</li>
                    </ul>
                </section>

                {/* SIGNATURES */}
                <section className="flex justify-between items-end mt-20 pt-10 break-inside-avoid">
                    <div className="text-center w-1/3 border-t-2 border-slate-400 pt-2">
                        <p className="font-black text-sm uppercase">Firma del Personal Clínico</p>
                        <p className="text-xs text-slate-800 text-black mt-1">Plan diseñado y avalado por Enfermería / Trabajo Social</p>
                    </div>
                    {pai.status === 'APPROVED' && (
                        <div className="text-center w-1/3 border-2 border-emerald-500 bg-emerald-50 rounded-lg p-2 transform rotate-2">
                            <p className="font-black text-emerald-800 text-lg uppercase">Firmado Clínicamente</p>
                            <p className="text-xs text-emerald-800 font-black font-bold mt-1">Zendity Authenticated ({pai.signedById?.split('-')[0]})</p>
                        </div>
                    )}
                </section>

                {/* Document Footer */}
                <div className="mt-16 pt-4 border-t border-slate-200 text-center text-xs text-slate-700 font-bold uppercase tracking-widest">
                    Página Generada Automáticamente vía Zendity OS
                </div>
            </div>
        </div>
    );
}
