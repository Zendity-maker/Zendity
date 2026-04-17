"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { UserIcon, ArrowLeftIcon, ArrowRightOnRectangleIcon, CalendarDaysIcon, DocumentArrowDownIcon, PencilIcon, DocumentTextIcon, CameraIcon } from "@heroicons/react/24/outline";
import { HeartCrack, FileText } from "lucide-react";
import Link from "next/link";
import PatientUlcersTab from "@/components/medical/upps/PatientUlcersTab";
import PatientFallRiskTab from "@/components/medical/fall-risk/PatientFallRiskTab";
import PatientEMARTab from "@/components/medical/emar/PatientEMARTab";
import PatientClinicalSummaryTab from "@/components/medical/patient/PatientClinicalSummaryTab";
import PatientFamilyTab from "@/components/medical/patient/PatientFamilyTab";
import PatientBillingTab from "@/components/medical/patient/PatientBillingTab";
import PatientReportsTab from "@/components/medical/patient/PatientReportsTab";
import PatientSocialWorkTab from "@/components/medical/patient/PatientSocialWorkTab";
import ResidentSummaryPrint from "@/components/medical/patient/ResidentSummaryPrint";

export default function PatientDossierPage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("clinical");
    const [patientData, setPatientData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const router = useRouter();

    // Modal States
    const [showDischargeModal, setShowDischargeModal] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showDietModal, setShowDietModal] = useState(false);
    const [hospModal, setHospModal] = useState(false);

    // Form States
    const [actionReason, setActionReason] = useState("");
    const [leaveType, setLeaveType] = useState("HOSPITAL");
    const [newDiet, setNewDiet] = useState("Regular (Sólida)");
    const [hospReason, setHospReason] = useState("");
    const [isHospitalizing, setIsHospitalizing] = useState(false);

    // Transfer print modal (flujo hospitalización)
    const [transferData, setTransferData] = useState<any | null>(null);
    // Resumen on-demand (botón prominente, independiente de hospitalización)
    const [summaryOpen, setSummaryOpen] = useState(false);

    // Deceased from TEMPORARY_LEAVE
    const [showDeceasedFromLeaveModal, setShowDeceasedFromLeaveModal] = useState(false);
    const [deceasedFromLeaveReason, setDeceasedFromLeaveReason] = useState("");
    const [isProcessingDeceased, setIsProcessingDeceased] = useState(false);

    // Toast State
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(t);
        }
    }, [toast]);

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

    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "", roomNumber: "", dateOfBirth: "",
        diet: "", allergies: "", diagnoses: "", colorGroup: "",
        idCardUrl: "", medicalPlanUrl: "", medicareCardUrl: "",
        // FASE 82 — datos legales y de seguro
        ssnLastFour: "", insurancePlanName: "", insurancePolicyNumber: "", preferredHospital: "",
        // FASE 84 — dirección previa
        address: ""
    });
    const [isSaving, setIsSaving] = useState(false);
    const idInputRef = useRef<HTMLInputElement>(null);
    const medicalInputRef = useRef<HTMLInputElement>(null);
    const medicareInputRef = useRef<HTMLInputElement>(null);

    const openEditModal = () => {
        setEditForm({
            name: patientData?.name || "",
            roomNumber: patientData?.roomNumber || "",
            dateOfBirth: patientData?.dateOfBirth ? new Date(patientData.dateOfBirth).toISOString().split('T')[0] : "",
            diet: patientData?.diet || "Regular (Sólida)",
            allergies: patientData?.intakeData?.allergies || "",
            diagnoses: patientData?.intakeData?.diagnoses || "",
            idCardUrl: patientData?.idCardUrl || "",
            medicalPlanUrl: patientData?.medicalPlanUrl || "",
            medicareCardUrl: patientData?.medicareCardUrl || "",
            colorGroup: patientData?.colorGroup || "UNASSIGNED",
            // FASE 82 — datos legales y de seguro
            ssnLastFour: patientData?.ssnLastFour || "",
            insurancePlanName: patientData?.insurancePlanName || "",
            insurancePolicyNumber: patientData?.insurancePolicyNumber || "",
            preferredHospital: patientData?.preferredHospital || "",
            // FASE 84 — dirección previa
            address: patientData?.address || ""
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/corporate/patients/${params.id}`, {
                method: "PUT", headers: {"Content-Type": "application/json"},
                body: JSON.stringify(editForm)
            });
            if (res.ok) {
                setShowEditModal(false);
                fetchPatientData();
            } else {
                alert("Error guardando el perfil.");
            }
        } catch(e) { }
        setIsSaving(false);
    };

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 800; // Optimal for readability while saving space
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const base64Photo = canvas.toDataURL("image/jpeg", 0.7);
                    setEditForm(prev => ({ ...prev, [fieldName]: base64Photo }));
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
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

    const handleHospitalize = async () => {
        if (!hospReason.trim() || !patientData) return;
        setIsHospitalizing(true);
        try {
            const res = await fetch("/api/care/hospitalize", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: patientData.id,
                    reason: hospReason.trim(),
                    headquartersId: patientData.headquartersId,
                })
            });
            const data = await res.json();
            if (data.success) {
                setHospModal(false);
                // Abre modal con resumen imprimible
                setTransferData({
                    patient: data.patient,
                    author: data.author,
                    transferReason: data.transferReason || hospReason.trim(),
                    transferDate: data.transferDate || new Date().toISOString(),
                });
                setHospReason("");
            } else {
                setToast({ msg: data.error || "Error al registrar hospitalización.", type: 'err' });
            }
        } catch (err) {
            setToast({ msg: "Error de conexión.", type: 'err' });
        } finally {
            setIsHospitalizing(false);
        }
    };

    const closeTransferModal = () => {
        setTransferData(null);
        fetchPatientData(); // refresca status del paciente en la UI
    };

    const handleDeceasedFromLeave = async () => {
        setIsProcessingDeceased(true);
        try {
            const res = await fetch(`/api/corporate/patients/${params.id}/discharge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: 'DECEASED',
                    reason: deceasedFromLeaveReason,
                    date: new Date()
                })
            });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: "Fallecimiento registrado. Expediente congelado.", type: 'ok' });
                setShowDeceasedFromLeaveModal(false);
                setDeceasedFromLeaveReason("");
                fetchPatientData();
            } else {
                setToast({ msg: data.error || "Error al registrar fallecimiento.", type: 'err' });
            }
        } catch (e) {
            setToast({ msg: "Error de conexión.", type: 'err' });
        } finally {
            setIsProcessingDeceased(false);
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
                        <div className="flex flex-col items-center gap-2">
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative group cursor-pointer w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border-4 border-white shadow-sm ${patientData?.status === 'ACTIVE' ? 'bg-indigo-50' : patientData?.status === 'TEMPORARY_LEAVE' ? 'bg-amber-50' : 'bg-slate-100'}`}
                            >
                                {patientData?.photoUrl ? (
                                    <img src={patientData.photoUrl} alt={patientData.name} className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className={`w-8 h-8 ${patientData?.status === 'ACTIVE' ? 'text-indigo-600' : patientData?.status === 'TEMPORARY_LEAVE' ? 'text-amber-600' : 'text-slate-500'}`} />
                                )}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <CameraIcon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 px-3 py-1 rounded-full shadow-sm transition-colors flex items-center gap-1">
                                <CameraIcon className="w-3 h-3" /> Subir Foto
                            </button>
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
                                    <>
                                    <button onClick={() => { setNewDiet(patientData?.diet || "Regular (Sólida)"); setShowDietModal(true); }} className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 rounded-lg transition-all ml-1 border border-indigo-200 shadow-sm text-xs uppercase tracking-wide active:scale-95" title="Cambiar Dieta">
                                        <PencilIcon className="w-3.5 h-3.5 stroke-2" /> Editar Dieta
                                    </button>
                                    <button onClick={openEditModal} className="flex items-center gap-1.5 px-3 py-1 bg-white text-slate-700 font-bold hover:bg-slate-50 rounded-lg transition-all ml-1 border border-slate-200 shadow-sm text-xs uppercase tracking-wide active:scale-95" title="Editar Perfil General">
                                        <PencilIcon className="w-3.5 h-3.5 stroke-2" /> Editar Perfil
                                    </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full md:w-auto mt-4 md:mt-0">
                        {/* Botón Resumen de Residente — SIEMPRE visible */}
                        <button
                            onClick={() => setSummaryOpen(true)}
                            className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm"
                            title="Genera PDF oficial con datos clínicos, medicamentos, alergias y tarjetas"
                        >
                            <FileText className="w-5 h-5" /> Imprimir Resumen
                        </button>
                        {patientData?.status === 'ACTIVE' && (
                            <>
                                <Link href={`/corporate/medical/patients/${patientData.id}/pai`} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm">
                                    <DocumentTextIcon className="w-5 h-5" /> Expediente PAI
                                </Link>
                                <Link href={`/care/patient/emar-print?patientId=${patientData.id}`} target="_blank" className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm">
                                    <DocumentTextIcon className="w-5 h-5" /> Auditoría eMAR
                                </Link>
                                <button onClick={() => setShowLeaveModal(true)} className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm">
                                    <CalendarDaysIcon className="w-5 h-5" /> Permiso Temporal
                                </button>
                                <button
                                    onClick={() => setHospModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-all active:scale-95 shadow-sm"
                                >
                                    🚑 Hospitalización de Emergencia
                                </button>
                                <button onClick={() => setShowDischargeModal(true)} className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm">
                                    <ArrowRightOnRectangleIcon className="w-5 h-5" /> Baja Definitiva
                                </button>
                            </>
                        )}
                        {patientData?.status === 'TEMPORARY_LEAVE' && (
                            <>
                                <button onClick={() => handlePatientAction('RETURN')} className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm">
                                    <UserIcon className="w-5 h-5" /> {patientData.leaveType === 'HOSPITAL' ? 'Alta Hospitalaria — Retornar' : 'Retornar a la Residencia'}
                                </button>
                                <button onClick={() => setShowDeceasedFromLeaveModal(true)} className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm">
                                    <HeartCrack className="w-5 h-5" /> Registrar Fallecimiento
                                </button>
                            </>
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
                            onClick={() => setActiveTab("social")}
                            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${activeTab === 'social' ? 'border-violet-500 text-violet-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}
                        >
                            Trabajo Social
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
                        <button
                            onClick={() => setActiveTab("reports")}
                            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${activeTab === 'reports' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}
                        >
                            Reportes Triage
                        </button>
                    </nav>
                </div>

                {/* Contenido Dinámico */}
                <div className="mt-6 print:mt-0">
                    <div className="print:hidden">
                        {activeTab === "clinical" && <PatientClinicalSummaryTab patientData={patientData} onRefresh={fetchPatientData} />}
                        {activeTab === "meds" && <PatientEMARTab patientId={params.id as string} />}
                        {activeTab === "upps" && <PatientUlcersTab patientId={params.id as string} />}
                        {activeTab === "falls" && <PatientFallRiskTab patientId={params.id as string} />}
                        {activeTab === "family" && <PatientFamilyTab patientId={params.id as string} />}
                        {activeTab === "social" && <PatientSocialWorkTab patientId={params.id as string} />}
                        {activeTab === "billing" && <PatientBillingTab patientId={params.id as string} patientData={patientData} onRefresh={fetchPatientData} />}
                    </div>
                    {/* Hacemos que la pantalla de reportes siempre sea visible si vamos a imprimir, asumiendo que el usuario está en la pestaña reportes */}
                    <div className={activeTab === "reports" ? "block" : "hidden print:block"}>
                        <PatientReportsTab patientId={params.id as string} patientName={patientData?.name} />
                    </div>
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

            {/* MODAL: EDITAR PERFIL */}
            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                            <PencilIcon className="w-6 h-6 text-indigo-600" />
                            Editar Perfil del Residente
                        </h3>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo</label>
                                    <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-500 outline-none" placeholder="Nombre completo" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Habitación</label>
                                    <input type="text" value={editForm.roomNumber} onChange={e => setEditForm({...editForm, roomNumber: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-500 outline-none" placeholder="Ej: 104-A" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Fecha de Nacimiento</label>
                                    <input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm({...editForm, dateOfBirth: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Alergias Conocidas</label>
                                    <input type="text" value={editForm.allergies} onChange={e => setEditForm({...editForm, allergies: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-500 outline-none text-rose-600 font-medium" placeholder="Ej: Penicilina, Nueces" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Diagnósticos Principales</label>
                                <textarea value={editForm.diagnoses} onChange={e => setEditForm({...editForm, diagnoses: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-500 outline-none min-h-[60px]" placeholder="Ej: Hipertensión, Diabetes Tipo 2..." />
                            </div>

                            {/* FASE 82/84 — Datos Legales y Seguro */}
                            <div className="pt-4 border-t border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-1 tracking-tight">Datos Legales y Seguro</h4>
                                <p className="text-xs text-slate-500 mb-4 font-medium">Información sensible para trámites con hospitales, aseguradoras y agencias reguladoras.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">SSN (últimos 4 dígitos)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={4}
                                            value={editForm.ssnLastFour}
                                            onChange={e => setEditForm({...editForm, ssnLastFour: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-500 outline-none font-mono tracking-widest"
                                            placeholder="••••"
                                        />
                                        <p className="text-[11px] text-slate-400 mt-1 font-medium">HIPAA: solo se almacenan los últimos 4 dígitos.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Hospital Preferido de Traslado</label>
                                        <input
                                            type="text"
                                            value={editForm.preferredHospital}
                                            onChange={e => setEditForm({...editForm, preferredHospital: e.target.value})}
                                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-500 outline-none"
                                            placeholder="Ej: Hospital Auxilio Mutuo"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Nombre del Plan Médico</label>
                                        <input
                                            type="text"
                                            value={editForm.insurancePlanName}
                                            onChange={e => setEditForm({...editForm, insurancePlanName: e.target.value})}
                                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-500 outline-none"
                                            placeholder="Ej: MCS, Triple-S, Medicare"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Número de Contrato / Póliza</label>
                                        <input
                                            type="text"
                                            value={editForm.insurancePolicyNumber}
                                            onChange={e => setEditForm({...editForm, insurancePolicyNumber: e.target.value})}
                                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-500 outline-none font-mono"
                                            placeholder="Ej: ABC-123456789"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Dirección Previa del Residente</label>
                                        <input
                                            type="text"
                                            value={editForm.address}
                                            onChange={e => setEditForm({...editForm, address: e.target.value})}
                                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-indigo-500 outline-none"
                                            placeholder="Ej: Calle Luna 123, Urb. Los Pinos, San Juan, PR 00926"
                                        />
                                    </div>
                                </div>
                            </div>

                            {['DIRECTOR', 'ADMIN', 'NURSE'].includes(user?.role || '') && (
                                <div className="pt-4 border-t border-slate-100">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Grupo de Color</label>
                                    <div className="flex gap-3">
                                        {[
                                            { key: 'RED', bg: 'bg-red-500', ring: 'ring-red-500', label: 'Rojo' },
                                            { key: 'YELLOW', bg: 'bg-yellow-400', ring: 'ring-yellow-400', label: 'Amarillo' },
                                            { key: 'GREEN', bg: 'bg-green-500', ring: 'ring-green-500', label: 'Verde' },
                                            { key: 'BLUE', bg: 'bg-blue-500', ring: 'ring-blue-500', label: 'Azul' },
                                        ].map(c => {
                                            const isActive = editForm.colorGroup === c.key;
                                            return (
                                                <button
                                                    key={c.key}
                                                    type="button"
                                                    onClick={() => setEditForm({ ...editForm, colorGroup: c.key })}
                                                    className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl transition-all ${
                                                        isActive
                                                            ? `bg-slate-100 ring-2 ring-offset-2 ${c.ring} scale-105`
                                                            : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                                                    }`}
                                                >
                                                    <div className={`w-6 h-6 rounded-full ${c.bg} ${isActive ? 'ring-2 ring-white shadow-lg' : ''}`} />
                                                    <span className={`text-xs font-bold ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>{c.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-4 tracking-tight">Documentos Vitales (Fotos)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 relative group cursor-pointer hover:border-indigo-400 transition" onClick={() => idInputRef.current?.click()}>
                                        <input type="file" accept="image/*" className="hidden" ref={idInputRef} onChange={e => handleDocumentUpload(e, 'idCardUrl')} />
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Identificación ID</p>
                                        <div className="aspect-[4/3] bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                                            {editForm.idCardUrl ? <img src={editForm.idCardUrl} alt="ID" className="w-full h-full object-cover" /> : <CameraIcon className="w-8 h-8 text-slate-500" />}
                                        </div>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 relative group cursor-pointer hover:border-indigo-400 transition" onClick={() => medicalInputRef.current?.click()}>
                                        <input type="file" accept="image/*" className="hidden" ref={medicalInputRef} onChange={e => handleDocumentUpload(e, 'medicalPlanUrl')} />
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Plan Médico</p>
                                        <div className="aspect-[4/3] bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                                            {editForm.medicalPlanUrl ? <img src={editForm.medicalPlanUrl} alt="Plan Medico" className="w-full h-full object-cover" /> : <CameraIcon className="w-8 h-8 text-slate-500" />}
                                        </div>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 relative group cursor-pointer hover:border-indigo-400 transition" onClick={() => medicareInputRef.current?.click()}>
                                        <input type="file" accept="image/*" className="hidden" ref={medicareInputRef} onChange={e => handleDocumentUpload(e, 'medicareCardUrl')} />
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Tarjeta Medicare</p>
                                        <div className="aspect-[4/3] bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                                            {editForm.medicareCardUrl ? <img src={editForm.medicareCardUrl} alt="Medicare" className="w-full h-full object-cover" /> : <CameraIcon className="w-8 h-8 text-slate-500" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-6 mt-6 border-t border-slate-100">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cancelar</button>
                            <button onClick={handleSaveEdit} disabled={isSaving} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-colors disabled:opacity-50">
                                {isSaving ? "Guardando..." : "Guardar Cambios"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {hospModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200">
                        <h3 className="text-xl font-black text-slate-800 mb-1">Hospitalización de Emergencia</h3>
                        <p className="text-slate-500 text-sm font-medium mb-6">El residente será marcado como <strong>Traslado Hospitalario</strong>. El triage recibirá una alerta clínica inmediata.</p>
                        <textarea
                            value={hospReason}
                            onChange={e => setHospReason(e.target.value)}
                            placeholder="Motivo del traslado — Ej: Fractura de cadera, dificultad respiratoria..."
                            className="w-full h-24 bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-rose-400 outline-none resize-none mb-6"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setHospModal(false); setHospReason(""); }}
                                className="flex-1 py-4 rounded-[2rem] bg-slate-100 text-slate-600 font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleHospitalize}
                                disabled={!hospReason.trim() || isHospitalizing}
                                className="flex-1 py-4 rounded-[2rem] bg-rose-600 text-white font-black text-sm uppercase tracking-widest hover:bg-rose-700 transition-colors disabled:opacity-40"
                            >
                                {isHospitalizing ? "Registrando..." : "Confirmar Traslado"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: FALLECIMIENTO DESDE TEMPORARY_LEAVE */}
            {showDeceasedFromLeaveModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-red-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <HeartCrack className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">Registrar Fallecimiento</h3>
                        </div>
                        <p className="text-slate-500 font-medium mb-6 leading-relaxed">
                            ¿Confirmas el fallecimiento de <strong className="text-red-600">{patientData?.name}</strong>?
                            <br />
                            <span className="text-red-500 text-sm font-bold">Esta acción es permanente.</span>
                        </p>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas (lugar, fecha, causa si se conoce)</label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-700 h-28 focus:outline-none focus:ring-2 focus:ring-red-400"
                                    placeholder="Ej: Fallecimiento en Hospital Municipal. Causa: Insuficiencia cardíaca..."
                                    value={deceasedFromLeaveReason}
                                    onChange={(e) => setDeceasedFromLeaveReason(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => { setShowDeceasedFromLeaveModal(false); setDeceasedFromLeaveReason(""); }}
                                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeceasedFromLeave}
                                disabled={!deceasedFromLeaveReason.trim() || isProcessingDeceased}
                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-colors disabled:opacity-40"
                            >
                                {isProcessingDeceased ? "Registrando..." : "Confirmar Fallecimiento"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div
                    className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-[2rem] shadow-xl font-bold text-sm flex items-center gap-3 cursor-pointer ${toast.type === 'ok' ? 'bg-teal-900 text-teal-100' : 'bg-rose-900 text-rose-100'}`}
                    onClick={() => setToast(null)}
                >
                    {toast.msg}
                </div>
            )}

            {/* Resumen on-demand (botón Imprimir Resumen) */}
            {summaryOpen && patientData?.id && (
                <ResidentSummaryPrint
                    patientId={patientData.id}
                    onClose={() => setSummaryOpen(false)}
                />
            )}

            {/* Resumen post-hospitalización (flujo automático tras hospitalizar) */}
            {transferData && (
                <ResidentSummaryPrint
                    patientId={transferData.patient?.id || patientData?.id}
                    transferReason={transferData.transferReason}
                    authorName={transferData.author?.name}
                    authorRole={transferData.author?.role}
                    transferDate={transferData.transferDate}
                    titleOverride="Resumen de Traslado Hospitalario"
                    onClose={closeTransferModal}
                />
            )}
        </div>
    );
}
