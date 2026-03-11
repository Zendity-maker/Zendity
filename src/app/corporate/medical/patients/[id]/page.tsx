"use client";

import { useState, useEffect, use } from "react";
import { UserIcon, ArrowLeftIcon, ArrowRightOnRectangleIcon, CalendarDaysIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import PatientUlcersTab from "@/components/medical/upps/PatientUlcersTab";
import PatientFallRiskTab from "@/components/medical/fall-risk/PatientFallRiskTab";
import PatientEMARTab from "@/components/medical/emar/PatientEMARTab";
import PatientClinicalSummaryTab from "@/components/medical/patient/PatientClinicalSummaryTab";
import PatientFamilyTab from "@/components/medical/patient/PatientFamilyTab";

export default function PatientDossierPage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const [activeTab, setActiveTab] = useState("clinical");
    const [patientData, setPatientData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Modal States
    const [showDischargeModal, setShowDischargeModal] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);

    // Form States
    const [actionReason, setActionReason] = useState("");
    const [leaveType, setLeaveType] = useState("HOSPITAL");

    useEffect(() => {
        fetchPatientData();
    }, [params.id]);

    const fetchPatientData = async () => {
        try {
            const res = await fetch(`/api/corporate/patients/${params.id}/history-report`);
            const data = await res.json();
            if (data.success) {
                setPatientData(data.history);
            }
            setIsLoading(false);
        } catch (e) {
            console.error("Failed to load patient data:", e);
            setIsLoading(false);
        }
    };

    const handlePatientAction = async (action: string) => {
        try {
            const res = await fetch(`/api/corporate/patients/${params.id}/discharge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    leaveType: action === 'TEMPORARY_LEAVE' ? leaveType : undefined,
                    reason: actionReason,
                    date: new Date()
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Operación realizada con éxito.");
                setShowDischargeModal(false);
                setShowLeaveModal(false);
                fetchPatientData(); // Refresh to see new status
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const downloadHistoryReport = () => {
        if (!patientData) return;
        const blob = new Blob([JSON.stringify(patientData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Historial_Zendity_${patientData.name}_${new Date().toISOString().split("T")[0]}.json`;
        a.click();
    };

    if (isLoading) {
        return <div className="min-h-screen bg-neutral-50 p-6 flex items-center justify-center font-bold text-slate-500">Cargando expediente corporativo...</div>;
    }

    return (
        <div className="min-h-screen bg-neutral-50 p-6 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Nav de Retorno */}
                <Link href="/corporate/medical/upp-dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition">
                    <ArrowLeftIcon className="w-4 h-4" /> Volver al Tablero de UPPs
                </Link>

                {/* Cabecera del Expediente */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-5">
                    <div className="flex items-start gap-4">
                        <div className={`p-4 rounded-full flex-shrink-0 ${patientData?.status === 'ACTIVE' ? 'bg-indigo-50' : patientData?.status === 'TEMPORARY_LEAVE' ? 'bg-amber-50' : 'bg-slate-100'}`}>
                            <UserIcon className={`w-12 h-12 ${patientData?.status === 'ACTIVE' ? 'text-indigo-600' : patientData?.status === 'TEMPORARY_LEAVE' ? 'text-amber-600' : 'text-slate-400'}`} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{patientData?.name || "Residente No Encontrado"}</h1>
                                {patientData?.status === 'ACTIVE' && <span className="bg-emerald-100 text-emerald-700 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">ACTIVO</span>}
                                {patientData?.status === 'TEMPORARY_LEAVE' && <span className="bg-amber-100 text-amber-700 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">PERMISO ({patientData.leaveType})</span>}
                                {(patientData?.status === 'DISCHARGED' || patientData?.status === 'DECEASED') && <span className="bg-slate-200 text-slate-600 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">EGRESADO / INACTIVO</span>}
                            </div>
                            <p className="text-slate-500 mt-1 font-medium">ID: {patientData?.id.split('-')[0]} | Cuarto: {patientData?.roomNumber || 'Liberado'} | Dieta: {patientData?.diet || 'N/A'}</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0">
                        {patientData?.status === 'ACTIVE' && (
                            <>
                                <button onClick={() => setShowLeaveModal(true)} className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm">
                                    <CalendarDaysIcon className="w-5 h-5" /> Permiso Temporal
                                </button>
                                <button onClick={() => setShowDischargeModal(true)} className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm">
                                    <ArrowRightOnRectangleIcon className="w-5 h-5" /> Baja Definitiva
                                </button>
                            </>
                        )}
                        {patientData?.status === 'TEMPORARY_LEAVE' && (
                            <button onClick={() => handlePatientAction('RETURN')} className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm">
                                <UserIcon className="w-5 h-5" /> Retornar a la Residencia
                            </button>
                        )}
                        {(patientData?.status === 'DISCHARGED' || patientData?.status === 'DECEASED') && (
                            <button onClick={downloadHistoryReport} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm">
                                <DocumentArrowDownIcon className="w-5 h-5" /> Extraer Historia (JSON)
                            </button>
                        )}
                    </div>
                </div>

                {/* Simulador de Pestañas de Historial */}
                <div className="border-b border-neutral-200">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab("clinical")}
                            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${activeTab === 'clinical' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}
                        >
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
                            Registro UPPs (24h)
                        </button>
                        <button
                            onClick={() => setActiveTab("family")}
                            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${activeTab === 'family' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}
                        >
                            Familiares y Accesos
                        </button>
                        <button
                            onClick={() => setActiveTab("falls")}
                            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${activeTab === 'falls' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}
                        >
                            Riesgo de Caídas / Incidentes
                        </button>
                    </nav>
                </div>

                {/* Contenido Dinámico */}
                <div className="mt-6">
                    {activeTab === "clinical" && <PatientClinicalSummaryTab patientData={patientData} onRefresh={fetchPatientData} />}
                    {activeTab === "meds" && <PatientEMARTab patientId={params.id as string} />}
                    {activeTab === "upps" && <PatientUlcersTab />}
                    {activeTab === "falls" && <PatientFallRiskTab />}
                    {activeTab === "family" && <PatientFamilyTab patientId={params.id as string} />}
                </div>
            </div>

            {/* MODAL: BAJA DEFINITIVA */}
            {showDischargeModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Baja Definitiva</h3>
                        <p className="text-slate-500 font-medium mb-6 leading-relaxed">
                            Esta acción retirará a <strong className="text-rose-500">{patientData?.name}</strong> de las pantallas de los cuidadores, liberará su habitación y congelará su expediente histórico.
                        </p>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo de Baja</label>
                                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500" onChange={(e) => setLeaveType(e.target.value)}>
                                    <option value="DISCHARGED">Egreso / Reubicación</option>
                                    <option value="DECEASED">Fallecimiento</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas Oficiales de Cierre</label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-700 h-24 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    placeholder="Motivo clínico o administrativo del egreso..."
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowDischargeModal(false)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors">Cancelar</button>
                            <button onClick={() => handlePatientAction(leaveType === 'DECEASED' ? 'DECEASED' : 'DISCHARGE')} className="flex-1 px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-500/30 transition-colors">Confirmar Baja</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: PERMISO TEMPORAL */}
            {showLeaveModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Permiso Temporal</h3>
                        <p className="text-slate-500 font-medium mb-6 leading-relaxed">
                            Marca la ausencia temporal de <strong className="text-amber-600">{patientData?.name}</strong> para que los cuidadores en piso sean notificados en su censo, pero conservando su habitación asignada.
                        </p>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Destino</label>
                                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                                    <option value="HOSPITAL">Ingreso a Hospital / Sala de Emergencias</option>
                                    <option value="FAMILY_VISIT">Salida Familiar (Fin de Semana / Periodo Vacacional)</option>
                                    <option value="OTHER">Otro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas (Opcional)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    placeholder="Ej. Se lo llevó su hijo al cine."
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowLeaveModal(false)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors">Cancelar</button>
                            <button onClick={() => handlePatientAction('TEMPORARY_LEAVE')} className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 transition-colors">Autorizar Permiso</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
