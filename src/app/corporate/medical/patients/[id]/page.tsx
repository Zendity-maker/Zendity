"use client";

import { useState, useEffect, use, useRef } from "react";
import { UserIcon, ArrowLeftIcon, ArrowRightOnRectangleIcon, CalendarDaysIcon, DocumentArrowDownIcon, PencilIcon, DocumentTextIcon, CameraIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import PatientUlcersTab from "@/components/medical/upps/PatientUlcersTab";
import PatientFallRiskTab from "@/components/medical/fall-risk/PatientFallRiskTab";
import PatientEMARTab from "@/components/medical/emar/PatientEMARTab";
import PatientClinicalSummaryTab from "@/components/medical/patient/PatientClinicalSummaryTab";
import PatientFamilyTab from "@/components/medical/patient/PatientFamilyTab";
import PatientBillingTab from "@/components/medical/patient/PatientBillingTab";

export default function PatientDossierPage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const [activeTab, setActiveTab] = useState("clinical");
    const [patientData, setPatientData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Modal States
    const [showDischargeModal, setShowDischargeModal] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showDietModal, setShowDietModal] = useState(false);

    // Form States
    const [actionReason, setActionReason] = useState("");
    const [leaveType, setLeaveType] = useState("HOSPITAL");
    const [newDiet, setNewDiet] = useState("Regular (Sólida)");

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

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 400; // Compresión optima para la base de datos Text/String 
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const base64Photo = canvas.toDataURL("image/jpeg", 0.7); // 70% quality

                    try {
                        const res = await fetch(`/api/corporate/patients/${params.id}/photo`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ photoUrl: base64Photo })
                        });
                        const data = await res.json();
                        if (data.success) {
                            setPatientData((prev: any) => ({ ...prev, photoUrl: base64Photo }));
                        } else {
                            alert("Error subiendo foto: " + data.error);
                        }
                    } catch (err) {
                        alert("Error de conexión al subir la foto.");
                    }
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
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

    const handleUpdateDiet = async () => {
        try {
            const res = await fetch(`/api/corporate/patients/${params.id}/diet`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ diet: newDiet })
            });
            const data = await res.json();
            if (data.success) {
                setShowDietModal(false);
                fetchPatientData();
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

    if (!patientData) {
        return <div className="min-h-screen bg-neutral-50 p-6 flex items-center justify-center font-bold text-rose-500">Error: No se pudo cargar el expediente corporativo del residente. Verifica tus permisos o si el paciente existe.</div>;
    }

    return (
        <div className="min-h-screen bg-neutral-50 p-6 font-sans">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handlePhotoUpload} />
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Nav de Retorno */}
                <Link href="/corporate/medical/upp-dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition">
                    <ArrowLeftIcon className="w-4 h-4" /> Volver al Tablero Clínico
                </Link>

                {/* Cabecera del Expediente */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-5">
                    <div className="flex items-start gap-4">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`relative group cursor-pointer w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border-4 border-white shadow-sm ${patientData?.status === 'ACTIVE' ? 'bg-indigo-50' : patientData?.status === 'TEMPORARY_LEAVE' ? 'bg-amber-50' : 'bg-slate-100'}`}
                        >
                            {patientData?.photoUrl ? (
                                <img src={patientData.photoUrl} alt={patientData.name} className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon className={`w-8 h-8 ${patientData?.status === 'ACTIVE' ? 'text-indigo-600' : patientData?.status === 'TEMPORARY_LEAVE' ? 'text-amber-600' : 'text-slate-400'}`} />
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <CameraIcon className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{patientData?.name || "Residente No Encontrado"}</h1>
                                {patientData?.status === 'ACTIVE' && <span className="bg-emerald-100 text-emerald-700 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">ACTIVO</span>}
                                {patientData?.status === 'TEMPORARY_LEAVE' && <span className="bg-amber-100 text-amber-700 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">PERMISO ({patientData.leaveType})</span>}
                                {(patientData?.status === 'DISCHARGED' || patientData?.status === 'DECEASED') && <span className="bg-slate-200 text-slate-600 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">EGRESADO / INACTIVO</span>}
                            </div>
                            <div className="text-slate-500 mt-1 font-medium flex-wrap flex items-center gap-2">
                                <span>ID: {patientData?.id?.split('-')[0]}</span> |
                                <span>Cuarto: {patientData?.roomNumber || 'Liberado'}</span> |
                                <span className="flex items-center bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-700">
                                    Dieta: {patientData?.diet || 'Regular (Sólida)'}
                                </span>
                                {patientData?.status !== 'DISCHARGED' && patientData?.status !== 'DECEASED' && (
                                    <button onClick={() => { setNewDiet(patientData?.diet || "Regular (Sólida)"); setShowDietModal(true); }} className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 rounded-lg transition-all ml-1 border border-indigo-200 shadow-sm text-xs uppercase tracking-wide active:scale-95" title="Cambiar Dieta">
                                        <PencilIcon className="w-3.5 h-3.5 stroke-2" /> Editar Dieta
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0">
                        {patientData?.status === 'ACTIVE' && (
                            <>
                                <Link href={`/corporate/medical/patients/${patientData.id}/pai`} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm">
                                    <DocumentTextIcon className="w-5 h-5" /> Expediente PAI
                                </Link>
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
                        <button
                            onClick={() => setActiveTab("billing")}
                            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${activeTab === 'billing' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}
                        >
                            Facturación y Cuotas
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
                    {activeTab === "billing" && <PatientBillingTab patientId={params.id as string} patientData={patientData} onRefresh={fetchPatientData} />}
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

                        <div className="flex gap-4 pt-4 border-t border-slate-100">
                            <button onClick={() => setShowDischargeModal(false)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cancelar</button>
                            <button onClick={() => handlePatientAction(leaveType === 'DECEASED' ? 'DECEASED' : 'DISCHARGED')} className="flex-1 px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-500/30 transition-colors">Confirmar Baja</button>
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

            {/* MODAL: CAMBIAR DIETA */}
            {showDietModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Prescripción de Dieta</h3>
                        <p className="text-slate-500 font-medium mb-6 leading-relaxed">
                            Ajusta el tipo de alimentación para el expediente clínico de <strong className="text-indigo-600">{patientData?.name}</strong>. Esto impactará de inmediato en el Módulo de Cocina.
                        </p>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Clasificación Nutricional</label>
                                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={newDiet} onChange={(e) => setNewDiet(e.target.value)}>
                                    <option value="Regular (Sólida)">Regular (Sólida)</option>
                                    <option value="Puré (Mojada)">Puré (Mojada)</option>
                                    <option value="Tubo PEG (1.5 Cal)">Alimentación por Sonda PEG</option>
                                    <option value="Diabética / Baja en Azúcar">Diabética / Baja en Azúcar (Sólida)</option>
                                    <option value="Baja en Sal">Baja en Sal (Sólida)</option>
                                    <option value="Líquidos Claros">Líquidos Claros</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowDietModal(false)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cancelar</button>
                            <button onClick={handleUpdateDiet} className="flex-1 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-colors">Actualizar Dieta</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
