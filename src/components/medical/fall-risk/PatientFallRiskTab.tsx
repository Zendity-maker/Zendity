"use client";

import { useState } from "react";
import { PlusIcon, ExclamationTriangleIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";

// MOCK DATA (Simulando fetches de NextJS/Prisma)
const MOCK_TIMELINE: any[] = [];

export default function PatientFallRiskTab() {
    const [isAssessing, setIsAssessing] = useState(false);
    const [isReportingFall, setIsReportingFall] = useState(false);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
            {/* Cabecera y Controles */}
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-slate-50">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardDocumentCheckIcon className="w-5 h-5 text-indigo-500" />
                        Historial de Movilidad y Caídas
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Escala de Morse y Bitácora de Sucesos</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsAssessing(true)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2 px-4 rounded-xl shadow-sm transition flex items-center gap-2 text-sm border border-indigo-200"
                    >
                        <ClipboardDocumentCheckIcon className="w-4 h-4" />
                        Escala Morse (Evaluación)
                    </button>
                    <button
                        onClick={() => setIsReportingFall(true)}
                        className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-4 rounded-xl shadow-md transition flex items-center gap-2 text-sm"
                    >
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        Reportar Caída de Emergencia
                    </button>
                </div>
            </div>

            {MOCK_TIMELINE.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center bg-white">
                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                        <ExclamationTriangleIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Sin Reportes Registrados</h3>
                    <p className="text-slate-500 font-medium max-w-sm mt-2">
                        No hay evaluaciones de riesgo de caídas ni incidentes reportados para este residente bajo el protocolo de Triage.
                    </p>
                </div>
            ) : (
                <div className="p-8">
                    <div className="relative border-l-2 border-indigo-100 ml-3 space-y-10 pl-8">
                        {MOCK_TIMELINE.map((entry) => (
                            <div key={entry.id} className="relative">

                                {/* Icono del Timeline */}
                                {entry.type === 'ASSESSMENT' ? (
                                    <div className="absolute -left-[42px] top-1 w-8 h-8 rounded-full bg-indigo-100 border-4 border-white flex items-center justify-center">
                                        <ClipboardDocumentCheckIcon className="w-4 h-4 text-indigo-600" />
                                    </div>
                                ) : (
                                    <div className="absolute -left-[42px] top-1 w-8 h-8 rounded-full bg-rose-100 border-4 border-white flex items-center justify-center animate-pulse">
                                        <ExclamationTriangleIcon className="w-4 h-4 text-rose-600" />
                                    </div>
                                )}

                                {/* Tarjeta de Contenido */}
                                {entry.type === 'ASSESSMENT' ? (
                                    <div className="bg-white border text-sm border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="font-bold text-slate-800">Evaluación Paramétrica (Morse)</h3>
                                                <p className="text-xs text-slate-500 mt-0.5">{entry.date} • <span className="text-indigo-600">{entry.nurse}</span></p>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider 
                                                ${entry.riskLevel === 'HIGH' ? 'bg-rose-100 text-rose-700' :
                                                    entry.riskLevel === 'MODERATE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                Riesgo {entry.riskLevel} (Score: {entry.morseScore})
                                            </div>
                                        </div>
                                        <p className="text-slate-600 mt-3">{entry.notes}</p>
                                    </div>
                                ) : (
                                    <div className="bg-rose-50 border text-sm border-rose-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="font-bold text-rose-800">Incidente Registrado: ¡Caída Fuerte!</h3>
                                                <p className="text-xs text-rose-600 mt-0.5">{entry.date} • <span className="font-medium underline">{entry.nurse}</span></p>
                                            </div>
                                            <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-200 text-rose-800">
                                                Lugar: {entry.location}
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wide">Desarrollo del Accidente</p>
                                                <p className="text-rose-900 font-medium mt-1">{entry.notes}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wide">Medidas Tomadas (Severidad: {entry.severity})</p>
                                                <p className="text-rose-900 font-medium mt-1">{entry.action}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Simulated Modals (For visual completeness in tests) */}
            {
                isAssessing && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-2xl w-96 shadow-2xl">
                            <h3 className="font-bold text-lg mb-4">Nueva Escala de Morse</h3>
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500">¿Ha tenido caídas previas (últimos 3 meses)?</p>
                                <select className="w-full border rounded-lg p-2 text-sm"><option>Sí (25 puntos)</option><option>No (0 puntos)</option></select>
                                <div className="mt-6 flex justify-end gap-3">
                                    <button onClick={() => setIsAssessing(false)} className="px-4 py-2 text-sm font-medium text-gray-600">Cancelar</button>
                                    <button onClick={() => setIsAssessing(false)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Guardar Evaluación</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isReportingFall && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-2xl w-[500px] shadow-2xl border-2 border-rose-500">
                            <h3 className="font-bold text-lg text-rose-600 mb-4 flex items-center gap-2">
                                <ExclamationTriangleIcon className="w-6 h-6" /> Declarar Emergencia
                            </h3>
                            <div className="space-y-4">
                                <div><label className="text-xs font-bold">Lugar Exacto de la Caída</label><input type="text" className="w-full border rounded-lg p-2 mt-1" placeholder="Ej. Baño 102B" /></div>
                                <div><label className="text-xs font-bold">Novedades Clínicas</label><textarea className="w-full border rounded-lg p-2 mt-1 h-20" placeholder="Descripción física..."></textarea></div>
                                <div className="mt-6 flex justify-end gap-3">
                                    <button onClick={() => setIsReportingFall(false)} className="px-4 py-2 text-sm font-medium text-gray-600">Cancelar</button>
                                    <button onClick={() => setIsReportingFall(false)} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold shadow-md">Registrar Incidente Oficial</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
}
