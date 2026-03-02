"use client";

import { useState } from "react";
import { PlusIcon, PhotoIcon, CheckCircleIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";

export default function PatientUlcersTab() {
    const [logs, setLogs] = useState([
        {
            id: "log1",
            date: "2026-03-01 10:15",
            nurse: "Camila Torres (RN)",
            woundSize: "3x4 cm",
            treatment: "Limpieza con Salina + Vendaje Hidrocoloide + Barrera de Zinc",
            notes: "El tejido presenta leve mejoría en los bordes. Paciente reportó dolor 3/10 durante la curación.",
            hasPhoto: true,
            stage: 2,
        },
        {
            id: "log2",
            date: "2026-02-28 09:30",
            nurse: "Luis Méndez (LPN)",
            woundSize: "3x4.5 cm",
            treatment: "Limpieza profunda + Gasa vaselinada",
            notes: "Herida descubierta durante el baño en Stage 2. Se notificó al médico de guardia.",
            hasPhoto: false,
            stage: 2,
        }
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Cabecera del Tab */}
            <div className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-neutral-100">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Integridad Cutánea y Curaciones</h3>
                    <p className="text-sm text-neutral-500 mt-1">Bitácora Oficial de Úlceras por Presión (Compliance del Dpto. Salud)</p>
                </div>
                <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
                    <PlusIcon className="w-5 h-5" />
                    Registrar Curación Hoy
                </button>
            </div>

            {/* Resumen del Problema Actual */}
            <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl flex items-start gap-4">
                <div className="bg-rose-100 p-3 rounded-xl">
                    <ExclamationTriangleIcon className="w-8 h-8 text-rose-600" />
                </div>
                <div>
                    <h4 className="font-bold text-rose-900 text-lg">Úlcera Activa: Talón Derecho (Stage 2)</h4>
                    <p className="text-rose-700 text-sm mt-1">Identificada el 28 de Feb, 2026. Requiere curación interdiaria y protocolo de rotación cada 2 horas.</p>
                    <div className="mt-3 flex gap-2">
                        <span className="bg-white text-rose-800 text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-rose-100">Curas: 2</span>
                        <button className="text-rose-600 bg-white hover:bg-rose-100 transition text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-rose-100 flex gap-1 items-center">
                            <CheckCircleIcon className="w-4 h-4" /> Marcar como Resuelta
                        </button>
                    </div>
                </div>
            </div>

            {/* Timeline Histórico */}
            <div className="pl-4">
                <h4 className="font-semibold text-slate-600 mb-6 flex gap-2 items-center">
                    <DocumentCheckIcon className="w-5 h-5" /> Historial de Evolución ("UlcerLog")
                </h4>

                <div className="border-l-2 border-slate-200 ml-3 space-y-8 pb-4">
                    {logs.map((log, index) => (
                        <div key={log.id} className="relative pl-8">
                            {/* Timeline Dot */}
                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-indigo-50" />

                            <div className="bg-white border border-neutral-100 p-5 rounded-2xl shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">Stage {log.stage}</span>
                                        <span className="text-sm font-medium text-slate-500 ml-3">{log.date}</span>
                                    </div>
                                    {log.hasPhoto && (
                                        <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg">
                                            <PhotoIcon className="w-4 h-4" /> Foto Adjunta en Expediente
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                                        <p className="text-xs text-neutral-500 font-semibold uppercase">Tamaño de Herida</p>
                                        <p className="font-medium text-slate-800 mt-0.5">{log.woundSize}</p>
                                    </div>
                                    <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                                        <p className="text-xs text-neutral-500 font-semibold uppercase">Enfermero(a) a Cargo</p>
                                        <p className="font-medium text-slate-800 mt-0.5">{log.nurse}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs text-neutral-500 font-semibold uppercase mt-1 mb-1">Tratamiento Aplicado</p>
                                    <p className="text-sm text-slate-700 bg-blue-50/50 p-3 rounded-xl border border-blue-50">{log.treatment}</p>
                                </div>

                                <div className="mt-3">
                                    <p className="text-xs text-neutral-500 font-semibold uppercase mt-1 mb-1">Notas Clínicas</p>
                                    <p className="text-sm text-slate-600 italic">"{log.notes}"</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Stub para que compile el Dashboard General si no está instalado
function ExclamationTriangleIcon(props: any) {
    return (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    );
}
