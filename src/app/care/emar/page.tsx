"use client";

import React, { useState, useEffect } from "react";
import { 
  fetchShiftPendingDoses, 
  markDoseAsGiven, 
  markDoseException 
} from "@/actions/emar/emar.actions";
import { MedStatus } from "@prisma/client";

const DEMO_HQ = "00000000-0000-0000-0000-000000000001";
const DEMO_USER = "CAREGIVER-01"; // Enfermera en turno

export default function EmarTabletTimeline() {
  const [doses, setDoses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States para manejar excepciones táctiles
  const [activeExceptionDose, setActiveExceptionDose] = useState<string | null>(null);
  const [exceptionReason, setExceptionReason] = useState("Rechazo");
  const [processingDose, setProcessingDose] = useState<string | null>(null);

  useEffect(() => {
    loadDoses();
  }, []);

  const loadDoses = async () => {
    setLoading(true);
    const res = await fetchShiftPendingDoses(DEMO_HQ);
    if (res.success && res.data) {
      setDoses(res.data);
    }
    setLoading(false);
  };

  const handleGiven = async (adminId: string) => {
    setProcessingDose(adminId);
    const res = await markDoseAsGiven(adminId, DEMO_USER);
    if (res.success) {
      loadDoses(); // Recarga la UI
    } else {
      alert("Error al sincronizar toma.");
    }
    setProcessingDose(null);
  };

  const submitException = async (adminId: string) => {
    setProcessingDose(adminId);
    const status = exceptionReason === "Rechazo" ? MedStatus.REFUSED : MedStatus.HELD;
    const res = await markDoseException(adminId, status, `Registrado rápido: ${exceptionReason}`, DEMO_USER);
    if (res.success) {
      setActiveExceptionDose(null);
      loadDoses();
    }
    setProcessingDose(null);
  };

  // Botón simulado PRN
  const handlePRN = () => {
    alert("Activando Flujo Aislado PRN. (Modulo en construcción Fase 4)");
  };

  const pendingDoses = doses.filter(d => d.status === "PENDING");

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* Header Fijo */}
      <div className="bg-slate-900 text-white p-8 shadow-2xl sticky top-0 z-10 flex justify-between items-center rounded-b-3xl">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Ruta Clínica (eMAR)</h1>
          <p className="text-slate-500 mt-2 text-lg font-medium">Turno Actual. Filtrado: Solo Pendientes.</p>
        </div>
        <button 
          onClick={handlePRN}
          className="bg-red-500 hover:bg-red-600 text-white font-black py-4 px-8 rounded-full shadow-lg border-b-4 border-red-700 active:translate-y-1 active:border-b-0 transition-all text-lg"
        >
          💊 S.O.S (Administrar PRN)
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-4 mt-6">
        {loading ? (
          <p className="text-center text-slate-500 font-bold text-2xl mt-16 animate-pulse">Cargando Ruta de Medicación...</p>
        ) : pendingDoses.length === 0 ? (
          <div className="bg-white rounded-[3rem] p-24 text-center shadow-sm border-2 border-dashed border-slate-200 mt-10">
            <span className="text-7xl mb-6 block">☕️</span>
            <h2 className="text-4xl font-black text-slate-500">Ruta Despejada</h2>
            <p className="text-slate-500 mt-4 text-xl font-medium">No tienes medicinas pendientes en este bloque horario.</p>
          </div>
        ) : (
          <div className="space-y-8 mt-8">
            {pendingDoses.map((dose) => (
              <div key={dose.id} className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border-2 border-slate-100 overflow-hidden flex flex-col md:flex-row transition-all hover:border-slate-300">
                
                {/* Info Card - Left Side */}
                <div className="p-8 md:w-2/3 border-b md:border-b-0 md:border-r-2 border-slate-100 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-amber-100 text-amber-900 font-black px-4 py-2 rounded-xl text-lg tracking-wider">
                      {dose.scheduledFor} HRS
                    </span>
                    <span className="text-lg font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                      ID: {dose.id.slice(0, 5).toUpperCase()}
                    </span>
                  </div>
                  
                  <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">
                    {dose.patientMedication?.medication?.name || "Medicamento Omitido"}
                  </h2>
                  <p className="text-2xl text-slate-500 font-medium mb-8 leading-relaxed">
                    Instrucción: {dose.patientMedication?.instructions || "Sin nota médica"}
                  </p>
                  
                  <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl flex items-center gap-5">
                    <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-md">
                      {dose.patientMedication?.patient?.name?.charAt(0) || "P"}
                    </div>
                    <div>
                      <p className="font-black text-blue-950 text-2xl">{dose.patientMedication?.patient?.name || "Paciente A"}</p>
                      <p className="text-lg font-medium text-blue-700/70">Asignación Validada</p>
                    </div>
                  </div>
                </div>

                {/* Acciones Táctiles (Right Side) */}
                <div className="p-8 md:w-1/3 flex flex-col gap-4 justify-center bg-slate-50">
                  {activeExceptionDose === dose.id ? (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                      <p className="font-black text-slate-800 text-lg mb-3">Razón de Excepción:</p>
                      <select 
                        className="w-full p-5 rounded-2xl border-2 border-slate-200 shadow-sm mb-5 text-xl font-bold text-slate-700 bg-white"
                        value={exceptionReason}
                        onChange={(e) => setExceptionReason(e.target.value)}
                        disabled={processingDose === dose.id}
                      >
                        <option value="Rechazo">Rechazó tomarla</option>
                        <option value="Vomito">Vomitó / Escupió</option>
                        <option value="Dormido">Demasiado Dormido</option>
                        <option value="Sintomas">Retención por Síntomas</option>
                      </select>
                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={() => submitException(dose.id)}
                          disabled={processingDose === dose.id}
                          className="w-full py-5 text-white font-black text-xl bg-slate-900 hover:bg-black rounded-2xl shadow-xl active:scale-95 transition-transform disabled:opacity-50"
                        >
                          {processingDose === dose.id ? "SELLANDO..." : "CONFIRMAR EXCEPCIÓN"}
                        </button>
                        <button 
                          onClick={() => setActiveExceptionDose(null)}
                          disabled={processingDose === dose.id}
                          className="w-full py-5 text-slate-500 font-bold text-lg bg-white border-2 border-slate-200 hover:bg-slate-100 rounded-2xl disabled:opacity-50"
                        >
                          CANCELAR
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleGiven(dose.id)}
                        disabled={processingDose === dose.id}
                        className="w-full py-8 bg-emerald-500 hover:bg-emerald-600 text-white text-3xl font-black rounded-3xl shadow-xl shadow-emerald-500/30 border-b-8 border-emerald-700 active:translate-y-2 active:border-b-0 transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-1"
                      >
                        <span>{processingDose === dose.id ? "IMPARTIENDO..." : "IMPARTIR"}</span>
                        {!processingDose && <span className="text-emerald-100 text-sm font-bold uppercase tracking-widest">Toque para Sellar</span>}
                      </button>
                      <button 
                        onClick={() => setActiveExceptionDose(dose.id)}
                        disabled={processingDose === dose.id}
                        className="w-full py-5 mt-3 bg-white text-red-600 text-xl font-black rounded-2xl border-4 border-red-50 hover:bg-red-50 hover:border-red-100 active:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        EXCEPCIÓN MÉDICA
                      </button>
                    </>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
