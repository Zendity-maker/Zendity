"use client";

import { useState, useEffect } from "react";
import { useAuth } from '@/context/AuthContext';
import Link from "next/link";
import {
    BeakerIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    MoonIcon,
    SunIcon,
    ChevronDownIcon,
    ChevronUpIcon
} from "@heroicons/react/24/outline";

export default function EMARDashboardPage() {
    const { user } = useAuth();
    const [patients, setPatients] = useState<any[]>([]);
    const [activeFilter, setActiveFilter] = useState("8AM"); // 8AM, 5PM, 8PM, PRN
    const [loadingData, setLoadingData] = useState(true);
    const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

    const fetchPatients = async () => {
        try {
            const res = await fetch("/api/emar");
            const data = await res.json();
            if (data.success) {
                setPatients(data.patients);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    // -- Modales de Novedad Clínica --
    const [selectedMed, setSelectedMed] = useState<any>(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [actionNotes, setActionNotes] = useState("");
    const [actionType, setActionType] = useState<"ADMINISTERED" | "REFUSED" | "OMITTED" | null>(null);

    const openActionModal = (med: any, patientInfo: any, type: "ADMINISTERED" | "REFUSED" | "OMITTED") => {
        setSelectedMed({ ...med, patientName: patientInfo.name, room: patientInfo.room });
        setActionType(type);
        setIsActionModalOpen(true);
    };

    const confirmAction = async () => {
        if (!selectedMed || !actionType) return;
        if (actionType !== "ADMINISTERED" && !actionNotes.trim()) {
            return alert("Debes justificar clínicamente por qué se Rechazó/Omitió la dosis.");
        }

        try {
            const res = await fetch("/api/emar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientMedicationId: selectedMed.id,
                    status: actionType,
                    notes: actionNotes,
                    scheduledFor: selectedMed.time !== 'PRN' ? selectedMed.time : null
                })
            });

            const data = await res.json();
            if (data.success) {
                // Actualización Optimista del Frontend
                const updatedPatients = patients.map(p => ({
                    ...p,
                    medications: p.medications.map((m: any) =>
                        m.id === selectedMed.id ? { ...m, status: actionType } : m
                    )
                }));
                setPatients(updatedPatients);
                setTimeout(() => alert(` Transacción Exitosa: Fármaco [${actionType}] guardado irrevocablemente en el sistema.`), 100);
            } else {
                alert("Error al guardar firma biométrica.");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión al servidor Zendity.");
        } finally {
            setIsActionModalOpen(false);
            setActionNotes("");
            setSelectedMed(null);
        }
    };

    // Tipado de autorización extendido para satisfacer Role Enum de Prisma
    const isAuthorized = user?.role === 'NURSE' || user?.role === 'ADMIN' || user?.role === 'DIRECTOR' || user?.role === 'CAREGIVER';

    if (!isAuthorized) {
        return <div className="p-8 text-center text-red-500 font-bold">Acceso Restringido: Módulo Clínico eMAR.</div>;
    }

    // Filtro Lógico
    const filterFn = (m: any) => {
        if (activeFilter === "PRN") return m.time === "PRN";
        if (activeFilter === "8AM") return m.time.includes("8") && m.time.includes("AM") && m.time !== "PRN";
        if (activeFilter === "5PM") return m.time.includes("5") && m.time.includes("PM") && m.time !== "PRN";
        if (activeFilter === "8PM") return m.time.includes("8") && m.time.includes("PM") && m.time !== "PRN";
        return true;
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* 1. Header & KPI Sincronizados */}
                <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <span className="bg-teal-100 text-teal-600 p-2 rounded-xl"><BeakerIcon className="w-8 h-8" /></span>
                            eMAR Corporativo (Medications)
                        </h1>
                        <p className="text-slate-500 text-sm mt-2 font-medium">
                            Rondas de Suministro Controlado. Firma electrónica y seguimiento de adherencia.
                        </p>
                    </div>

                    {/* Botones de Ronda Rápida */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveFilter("8AM")}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${activeFilter === '8AM' ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <SunIcon className="w-5 h-5" /> 8:00 AM
                        </button>
                        <button
                            onClick={() => setActiveFilter("5PM")}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${activeFilter === '5PM' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <ClockIcon className="w-5 h-5" /> 5:00 PM
                        </button>
                        <button
                            onClick={() => setActiveFilter("8PM")}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${activeFilter === '8PM' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <MoonIcon className="w-5 h-5" /> 8:00 PM
                        </button>
                        <button
                            onClick={() => setActiveFilter("PRN")}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${activeFilter === 'PRN' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <BeakerIcon className="w-5 h-5" /> P.R.N.
                        </button>
                    </div>
                </div>

                {loadingData ? (
                    <div className="p-12 text-center animate-pulse">
                        <BeakerIcon className="w-12 h-12 text-teal-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-teal-700">Enlazando con Farmacia...</h2>
                        <p className="text-sm font-medium text-slate-400 mt-2">Buscando prescripciones y horarios B2B.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {patients.map(patient => {
                            const filteredMeds = patient.medications.filter(filterFn);
                            if (filteredMeds.length === 0) return null; // No renderizar si no tiene prescipciones en este turno

                            const isExpanded = expandedPatientId === patient.id;

                            return (
                                <div key={patient.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">

                                    <div
                                        className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => setExpandedPatientId(isExpanded ? null : patient.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 font-black flex items-center justify-center border-2 border-white shadow-sm">
                                                {patient.room}
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-black text-slate-800">{patient.name}</h2>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredMeds.length} Fármacos Asignados</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Link href={`/corporate/medical/patients/${patient.id}`} className="text-teal-600 font-bold text-sm hover:underline" onClick={(e) => e.stopPropagation()}>
                                                Ver Historial
                                            </Link>
                                            {isExpanded ? (
                                                <ChevronUpIcon className="w-6 h-6 text-slate-400" />
                                            ) : (
                                                <ChevronDownIcon className="w-6 h-6 text-slate-400" />
                                            )}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2">
                                            {filteredMeds.map((med: any) => (
                                                <div key={med.id} className={`p-6 flex justify-between items-center transition-colors ${med.status !== 'PENDING' ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}>

                                                    <div className="flex gap-5">
                                                        {/* Status Indicator Icon */}
                                                        <div className="mt-1">
                                                            {med.status === 'PENDING' && <ClockIcon className="w-6 h-6 text-slate-300" />}
                                                            {med.status === 'ADMINISTERED' && <CheckCircleIcon className="w-6 h-6 text-emerald-500" />}
                                                            {med.status === 'REFUSED' && <XCircleIcon className="w-6 h-6 text-rose-500" />}
                                                            {med.status === 'OMITTED' && <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />}
                                                        </div>

                                                        <div>
                                                            <div className="flex items-center gap-3">
                                                                <h3 className={`font-black text-lg ${med.status !== 'PENDING' ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800'}`}>
                                                                    {med.name}
                                                                </h3>
                                                                {med.time === 'PRN' ? (
                                                                    <span className="bg-rose-100 text-rose-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">SOS / PRN</span>
                                                                ) : (
                                                                    <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">{med.time}</span>
                                                                )}
                                                            </div>

                                                            <div className="flex gap-4 mt-2">
                                                                <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                                                    <span className="inline-block w-2 h-2 rounded-full bg-teal-400"></span>
                                                                    Vía {med.route}
                                                                </p>
                                                                <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                                                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-400"></span>
                                                                    Nota: {med.instructions}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons (Firma Electrónica) */}
                                                    {med.status === 'PENDING' ? (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => openActionModal(med, patient, 'ADMINISTERED')}
                                                                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all"
                                                            >
                                                                Suministrar
                                                            </button>
                                                            <button
                                                                onClick={() => openActionModal(med, patient, 'REFUSED')}
                                                                className="bg-white text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all"
                                                            >
                                                                Rechazó
                                                            </button>
                                                            <button
                                                                onClick={() => openActionModal(med, patient, 'OMITTED')}
                                                                className="bg-white text-amber-600 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all"
                                                            >
                                                                Omitir
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                                                            Registrado 
                                                        </div>
                                                    )}

                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Empty State Guard */}
                        {patients.every(p => p.medications.filter(filterFn).length === 0) && (
                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center">
                                <BeakerIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                <h3 className="text-xl font-black text-slate-400">Ronda Limpia</h3>
                                <p className="text-slate-400 mt-2 font-medium">No hay prescripciones activas para este horario de recuento.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. MODAL DE BIO-FIRMA CLINICA */}
                {isActionModalOpen && selectedMed && (
                    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className={`bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border-t-8 
                            ${actionType === 'ADMINISTERED' ? 'border-emerald-500' :
                                actionType === 'REFUSED' ? 'border-rose-500' : 'border-amber-500'}
                        `}>
                            <div className="p-6">
                                <h3 className="text-xl font-black text-slate-800 mb-1">
                                    {actionType === 'ADMINISTERED' ? 'Confirmar Suministro' :
                                        actionType === 'REFUSED' ? 'Registrar Rechazo' : 'Omitir Dosis'}
                                </h3>
                                <p className="text-slate-500 text-sm font-medium mb-6">Residente: <span className="font-bold text-slate-700">{selectedMed.patientName} (Hab. {selectedMed.room})</span></p>

                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6">
                                    <p className="font-black text-lg text-slate-800">{selectedMed.name}</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{selectedMed.route}  {selectedMed.time}</p>
                                </div>

                                {actionType !== 'ADMINISTERED' && (
                                    <div className="mb-6">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Justificación Médica (Obligatorio) </label>
                                        <textarea
                                            value={actionNotes}
                                            onChange={(e) => setActionNotes(e.target.value)}
                                            placeholder={actionType === 'REFUSED' ? "Ej. Residente escupió la pastilla..." : "Ej. Médico ordenó suspender por fiebre..."}
                                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none min-h-[100px]"
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={confirmAction}
                                    className={`w-full py-3.5 rounded-xl font-black text-white shadow-md transition-all 
                                        ${actionType === 'ADMINISTERED' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' :
                                            actionType === 'REFUSED' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' :
                                                'bg-amber-500 hover:bg-amber-600 shadow-amber-200'}
                                    `}
                                >
                                    Firmar con PIN Virtual
                                </button>
                                <button
                                    onClick={() => { setIsActionModalOpen(false); setActionNotes(""); setSelectedMed(null); }}
                                    className="w-full py-3 mt-2 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar Operación
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
