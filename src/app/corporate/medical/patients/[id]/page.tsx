"use client";

import { useState } from "react";
import { UserIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import PatientUlcersTab from "@/components/medical/upps/PatientUlcersTab";
import PatientFallRiskTab from "@/components/medical/fall-risk/PatientFallRiskTab";
import PatientEMARTab from "@/components/medical/emar/PatientEMARTab";

export default function PatientDossierPage({ params }: { params: { id: string } }) {
    const [activeTab, setActiveTab] = useState("upps");

    return (
        <div className="min-h-screen bg-neutral-50 p-6 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Nav de Retorno */}
                <Link href="/corporate/medical/upp-dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition">
                    <ArrowLeftIcon className="w-4 h-4" /> Volver al Tablero de UPPs
                </Link>

                {/* Cabecera del Expediente */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex items-start gap-5">
                    <div className="bg-indigo-50 p-4 rounded-full flex-shrink-0">
                        <UserIcon className="w-12 h-12 text-indigo-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Expediente Médico de Prueba</h1>
                            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Alto Riesgo Cutáneo</span>
                        </div>
                        <p className="text-slate-500 mt-1">ID: {params.id} | Edad: 78 Años | Habitación: 12B</p>
                    </div>
                </div>

                {/* Simulador de Pestañas de Historial */}
                <div className="border-b border-neutral-200">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <button className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition cursor-not-allowed">
                            Resumen Clínico
                        </button>
                        <button
                            onClick={() => setActiveTab("meds")}
                            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${activeTab === 'meds' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}
                        >
                            Medicamentos
                        </button>
                        <button
                            onClick={() => setActiveTab("upps")}
                            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${activeTab === 'upps' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}
                        >
                            Integridad Cutánea / UPPs
                        </button>
                        <button
                            onClick={() => setActiveTab("falls")}
                            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${activeTab === 'falls' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}
                        >
                            Riesgo de Caídas / Incidentes
                        </button>
                    </nav>
                </div>

                {/* Contenido (Lazy Loading de la Fase 23 & 24) */}
                <div className="mt-6">
                    {activeTab === "upps" && <PatientUlcersTab />}
                    {activeTab === "falls" && <PatientFallRiskTab />}
                    {activeTab === "meds" && <PatientEMARTab patientId={params.id} />}
                </div>
            </div>
        </div>
    );
}
