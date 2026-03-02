"use client";

import { useState, useEffect } from "react";
import { UserCircleIcon, ClockIcon, ExclamationTriangleIcon, PlusCircleIcon, DocumentTextIcon, MapPinIcon } from "@heroicons/react/24/outline";
import DeclareUlcerModal from "@/components/medical/upps/DeclareUlcerModal";

// Tipos simulados para la UI inicial (Se conectarán a Prisma en la próxima iteración)
interface BedriddenPatient {
    id: string;
    name: string;
    room: string;
    lastRotation: Date;
    activeUlcers: number;
}

export default function UPPsDashboard() {
    const [currentTime, setCurrentTime] = useState(new Date());

    // Simulación de Estado Clínico
    const [patients, setPatients] = useState<BedriddenPatient[]>([
        { id: "1", name: "María Elena García", room: "12B", lastRotation: new Date(Date.now() - 1000 * 60 * 60 * 0.5), activeUlcers: 0 }, // 30 min (Verde)
        { id: "2", name: "Roberto Sánchez", room: "08A", lastRotation: new Date(Date.now() - 1000 * 60 * 60 * 1.5), activeUlcers: 1 }, // 1.5 hs (Amarillo)
        { id: "3", name: "Carmen Rivera", room: "15C", lastRotation: new Date(Date.now() - 1000 * 60 * 60 * 2.5), activeUlcers: 2 }, // 2.5 hs (Rojo - ¡Alerta!)
        { id: "4", name: "Arthur Dent", room: "01A", lastRotation: new Date(Date.now() - 1000 * 60 * 60 * 0.1), activeUlcers: 0 }, // Recién rotado
    ]);

    const [isModalOpen, setIsModalOpen] = useState(false);

    // Reloj Master UI
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    // Función de Lógica de Negocio (Compliance as a Service)
    const getRiskStatus = (lastRotation: Date) => {
        const diffMs = currentTime.getTime() - lastRotation.getTime();
        const diffHs = diffMs / (1000 * 60 * 60);

        if (diffHs >= 2) return { color: "bg-red-500", text: "text-red-600", border: "border-red-500", label: "Rotación Expirada", pulse: true };
        if (diffHs >= 1.5) return { color: "bg-yellow-400", text: "text-yellow-600", border: "border-yellow-400", label: "Rotación Próxima", pulse: false };
        return { color: "bg-emerald-500", text: "text-emerald-600", border: "border-emerald-500", label: "Seguro", pulse: false };
    };

    const handleManualRotation = (patientId: string) => {
        // Simula el botón de enfermería que resetea el reloj a 0 (Insert de PosturalChangeLog)
        setPatients((prev) =>
            prev.map(p => p.id === patientId ? { ...p, lastRotation: new Date() } : p)
        );
    };

    return (
        <div className="min-h-screen bg-neutral-50 p-6 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Cabecera Estratégica */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                            <ExclamationTriangleIcon className="w-8 h-8 text-rose-500" />
                            Tablero de Control de UPPs
                        </h1>
                        <p className="text-neutral-500 mt-1">Monitoreo de Integridad Cutánea y Reloj de Rotación Postural Obligatoria.</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-medium border border-indigo-100 hover:bg-indigo-100 transition">
                            <DocumentTextIcon className="w-5 h-5" />
                            Ver Protocolo
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-rose-600 text-white px-5 py-2 rounded-xl font-medium shadow-sm hover:bg-rose-700 transition"
                        >
                            <PlusCircleIcon className="w-5 h-5" />
                            Declarar Nueva Úlcera
                        </button>
                    </div>
                </div>

                {/* Analíticas Globales */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col">
                        <span className="text-sm font-medium text-neutral-500">Pacientes Encamados</span>
                        <span className="text-3xl font-bold text-slate-800 mt-2">{patients.length}</span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col">
                        <span className="text-sm font-medium text-neutral-500">Úlceras Activas (Sede)</span>
                        <span className="text-3xl font-bold text-rose-600 mt-2">
                            {patients.reduce((acc, curr) => acc + curr.activeUlcers, 0)}
                        </span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col col-span-2 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <ClockIcon className="w-24 h-24" />
                        </div>
                        <span className="text-sm font-medium text-neutral-500">Hora Oficial del Servidor</span>
                        <span className="text-3xl font-bold text-slate-800 mt-2 tracking-widest">{currentTime.toLocaleTimeString()}</span>
                    </div>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-4">Relojes de Riesgo Cutáneo (En Vivo)</h2>

                {/* Grid de Pacientes */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {patients.map((patient) => {
                        const status = getRiskStatus(patient.lastRotation);
                        // Formateo para leer visualmente hace cuántos MINUTOS fue la rotación
                        const minutesSince = Math.floor((currentTime.getTime() - patient.lastRotation.getTime()) / 60000);

                        return (
                            <div key={patient.id} className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden flex flex-col relative transition-all duration-300 ${status.border} ${status.pulse ? 'ring-4 ring-red-100' : ''}`}>

                                {/* Cabecera Tarjeta */}
                                <div className="p-5 border-b border-neutral-100 flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <UserCircleIcon className="w-12 h-12 text-neutral-300" />
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-lg leading-tight">{patient.name}</h3>
                                            <p className="text-sm text-neutral-500 flex items-center gap-1 mt-1">
                                                <MapPinIcon className="w-4 h-4" /> Hab: {patient.room}
                                            </p>
                                        </div>
                                    </div>
                                    {/* Semáforo Redondo */}
                                    <div className={`w-5 h-5 rounded-full ${status.color} ${status.pulse ? 'animate-ping' : ''}`} />
                                </div>

                                {/* Cuerpo Tarjeta (Datos Clínicos) */}
                                <div className="p-5 bg-neutral-50/50 flex-grow grid grid-cols-2 gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Úlceras</span>
                                        <span className={`text-lg font-bold mt-1 ${patient.activeUlcers > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                                            {patient.activeUlcers} Activas
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Última Rotación</span>
                                        <span className={`text-lg font-bold mt-1 ${status.text}`}>
                                            Hace {minutesSince} min
                                        </span>
                                    </div>
                                </div>

                                {/* Controles de Enfermería */}
                                <div className="p-4 bg-white flex gap-2">
                                    <button
                                        onClick={() => handleManualRotation(patient.id)}
                                        className="flex-1 bg-slate-800 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-slate-700 transition"
                                    >
                                        Registrar Rotación
                                    </button>
                                    <a
                                        href={`/corporate/medical/patients/${patient.id}`}
                                        className="px-4 py-2.5 bg-neutral-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-neutral-200 transition text-center"
                                    >
                                        Ver Bitácora
                                    </a>
                                </div>

                            </div>
                        );
                    })}
                </div>
            </div>

            <DeclareUlcerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                patients={patients.map(p => ({ id: p.id, name: p.name }))}
            />
        </div>
    );
}
