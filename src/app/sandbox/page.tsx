"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ZenditySandboxPage() {
    const { user } = useAuth();

    // States
    const [step, setStep] = useState(1);
    const [simulating, setSimulating] = useState(false);

    // Results
    const [lifePlanResult, setLifePlanResult] = useState<string | null>(null);
    const [briefingResult, setBriefingResult] = useState<any>(null);

    // Mock Form Data
    const [employeeName, setEmployeeName] = useState("Carlos Mendoza");
    const [employeeRole, setEmployeeRole] = useState("CAREGIVER");
    const [patientName, setPatientName] = useState("Doña Elena Romero");
    const [patientColor, setPatientColor] = useState("GREEN");

    const runSimulation = async () => {
        setSimulating(true);
        try {
            const res = await fetch("/api/sandbox/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeName,
                    employeeRole,
                    patientName,
                    patientColor
                }),
            });
            const data = await res.json();

            if (data.success) {
                setLifePlanResult(data.lifePlan);
                setBriefingResult(data.briefing);
                setStep(4);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSimulating(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 lg:p-12 font-sans text-slate-800">
            <div className="max-w-5xl mx-auto space-y-12">

                {/* Header */}
                <div className="text-center animate-in slide-in-from-top-4 duration-700">
                    <span className="text-teal-600 font-black tracking-widest uppercase text-sm mb-2 block">Zona de Pruebas Director</span>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Simulador de Flujos Base <span className="text-teal-500">Zendity</span></h1>
                    <p className="text-slate-500 mt-4 max-w-2xl mx-auto text-lg">Valida la ingesta de datos, vinculación de roles y la orquestación de la Inteligencia Artificial (Life Planes & Briefings).</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Form Steps */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* Zendity People Form (Paso 1) */}
                        <div className={`bg-white rounded-xl p-6 shadow-sm border-2 transition-all duration-300 ${step === 1 ? 'border-teal-500 shadow-teal-500/20 shadow-xl' : 'border-slate-200 opacity-60'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${step === 1 ? 'bg-teal-500 text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
                                <h2 className="text-xl font-black">Zendity People</h2>
                            </div>
                            <p className="text-sm text-slate-500 font-medium mb-5">
                                Módulo de reclutamiento. Registra al Cuidador. El Rol define sus accesos en el App y su currícula en la Academia.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-1">Nombre</label>
                                    <input type="text" value={employeeName} onChange={e => setEmployeeName(e.target.value)} disabled={step !== 1} className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-50 font-semibold" />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-1">Rol Operativo</label>
                                    <select value={employeeRole} onChange={e => setEmployeeRole(e.target.value)} disabled={step !== 1} className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-50 font-bold text-teal-700">
                                        <option value="CAREGIVER">Cuidador (Caregiver)</option>
                                        <option value="NURSE">Enfermera (LPN/RN)</option>
                                    </select>
                                </div>
                                {step === 1 && (
                                    <button onClick={() => setStep(2)} className="w-full mt-2 bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition">Confirmar Staff</button>
                                )}
                            </div>
                        </div>

                        {/* Zendity Intake Form (Paso 2) */}
                        <div className={`bg-white rounded-xl p-6 shadow-sm border-2 transition-all duration-300 ${step === 2 ? 'border-indigo-500 shadow-indigo-500/20 shadow-xl' : 'border-slate-200 opacity-60'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${step === 2 ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
                                <h2 className="text-xl font-black">Zendity Intake</h2>
                            </div>
                            <p className="text-sm text-slate-500 font-medium mb-5">
                                La IA leerá este formulario para estructurar de inmediato el "Life Plan" de ingreso.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-1">Residente</label>
                                    <input type="text" value={patientName} onChange={e => setPatientName(e.target.value)} disabled={step !== 2} className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-50 font-semibold" />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-1">Zonificación</label>
                                    <select value={patientColor} onChange={e => setPatientColor(e.target.value)} disabled={step !== 2} className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-50 font-bold text-indigo-700">
                                        <option value="GREEN">GRUPO VERDE (Baja Dependencia)</option>
                                        <option value="YELLOW">GRUPO AMARILLO (Dep. Moderada)</option>
                                        <option value="RED">GRUPO ROJO (Alta Dependencia)</option>
                                    </select>
                                </div>
                                {step === 2 && (
                                    <button onClick={() => setStep(3)} className="w-full mt-2 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30">Confirmar Ingreso</button>
                                )}
                            </div>
                        </div>

                        {/* Ejecutar Simulación (Paso 3) */}
                        <div className={`bg-slate-900 rounded-xl p-6 shadow-xl border-2 transition-all duration-300 ${step === 3 ? 'border-teal-400 scale-105' : 'border-slate-800 opacity-60'}`}>
                            <div className="flex items-center gap-3 mb-4 text-white">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${step === 3 ? 'bg-teal-500' : 'bg-slate-700'}`}>3</span>
                                <h2 className="text-xl font-black">Orquestar Operación</h2>
                            </div>
                            <p className="text-sm text-slate-500 mb-6 font-medium">
                                Procesar Alta Médica, Invocar Zendity AI y Simular Login del Cuidador {employeeName}.
                            </p>

                            {step === 3 && (
                                <button
                                    onClick={runSimulation}
                                    disabled={simulating}
                                    className="w-full bg-teal-500 text-slate-900 font-black py-4 rounded-xl hover:bg-teal-400 transition shadow-xl shadow-teal-500/20 active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {simulating ? (
                                        <><span></span> <span className="animate-pulse">Analizando Datos Clínicos...</span></>
                                    ) : (
                                        <><span></span> <span className="">Iniciar Pruebas</span></>
                                    )}
                                </button>
                            )}
                        </div>

                    </div>

                    {/* Right Column: AI Results (Paso 4) */}
                    <div className="lg:col-span-2">
                        {step < 4 ? (
                            <div className="h-full bg-slate-200/50 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center animate-pulse">
                                <span className="text-6xl mb-4 grayscale opacity-50"></span>
                                <h3 className="text-2xl font-black text-slate-500">Motor AI en Espera</h3>
                                <p className="text-slate-500 mt-2 max-w-sm">Completa los pasos en el panel izquierdo para simular el procesamiento de un nuevo residente.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">

                                {/* Life Plan Result */}
                                <div className="bg-white rounded-xl p-8 shadow-xl border border-slate-200 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 border-b border-l border-emerald-100 rounded-bl-3xl bg-emerald-50 text-xs font-black text-emerald-600 uppercase tracking-widest">
                                        Generado en Intake
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2 mb-2">
                                        <span className="text-emerald-500"></span> Life Plan Autogenerado
                                    </h3>
                                    <p className="text-slate-500 text-sm font-semibold mb-6">Basado en el perfil médico de {patientName}</p>

                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 prose prose-slate max-w-none text-sm font-medium">
                                        <div dangerouslySetInnerHTML={{ __html: lifePlanResult?.replace(/\n/g, '<br/>') || "" }} />
                                    </div>
                                </div>

                                {/* Zendi Briefing Result */}
                                <div className="bg-[#1e293b] text-white rounded-xl p-8 shadow-2xl relative overflow-hidden border border-slate-700">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px]"></div>
                                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]"></div>

                                    <div className="relative z-10">
                                        <div className="inline-block px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-teal-300 uppercase tracking-widest mb-4 border border-white/10">
                                            Zendity Care Tablet (Vista Cuidador)
                                        </div>
                                        <h3 className="text-3xl font-black flex items-center gap-3 mb-6">
                                            <span></span> Zendi Morning Briefing
                                        </h3>
                                        <p className="text-slate-500 font-medium mb-6">
                                            Lo que escucha <strong>{employeeName}</strong> al escanear su badge para el <strong>Grupo {patientColor}</strong>:
                                        </p>

                                        <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-6 border border-slate-700 shadow-inner">
                                            <p className="text-lg leading-relaxed text-teal-50 font-medium italic">
                                                "{briefingResult?.ttsMessage}"
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={() => setStep(1)} className="w-full bg-slate-200 text-slate-600 font-bold py-4 rounded-xl hover:bg-slate-300 transition">
                                    Reiniciar Simulación
                                </button>

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
