"use client";

import React, { useState, useEffect } from "react";
import { fetchEmarDrafts, approveMedicationDraft, discardMedicationDraft } from "@/actions/emar/emar.actions";

// Simulating logged-in User and HQ for MVP purposes
const DEMO_HQ = "00000000-0000-0000-0000-000000000001";
const DEMO_USER = "SUPERVISOR-MD-01";

export default function EmarConciliationPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States para el Modal de Aprobación
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [formFrequency, setFormFrequency] = useState("DIARIO");
  const [formTimes, setFormTimes] = useState("08:00");

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    setLoading(true);
    const res = await fetchEmarDrafts(DEMO_HQ);
    if (res.success && res.data) {
      setDrafts(res.data);
    }
    setLoading(false);
  };

  const handleOpenApprove = (draft: any) => {
    setSelectedDraft(draft);
    setFormFrequency("DIARIO");
    setFormTimes("08:00");
    setIsModalOpen(true);
  };

  const submitApprove = async () => {
    if (!selectedDraft) return;
    
    const res = await approveMedicationDraft({
      patientMedicationId: selectedDraft.id,
      frequency: formFrequency,
      scheduleTimes: formTimes,
      userId: DEMO_USER
    });

    if (res.success) {
      alert("Medicamento Activado Exitosamente.");
      setIsModalOpen(false);
      loadDrafts();
    } else {
      alert("Error: " + res.error);
    }
  };

  const handleDiscard = async (draftId: string) => {
    const reason = prompt("¿Razón para descartar esta receta?");
    if (!reason) return;

    const res = await discardMedicationDraft({
      patientMedicationId: draftId,
      userId: DEMO_USER,
      reason: reason
    });

    if (res.success) {
      loadDrafts();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Bandeja de Conciliación (eMAR)</h1>
          <p className="text-gray-500 mt-2">
            Revisión clínica de prescripciones en estado borrador capturadas en Intake.
          </p>
        </div>

        {loading ? (
          <p>Cargando bandeja...</p>
        ) : drafts.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-gray-500 text-lg">No hay borradores pendientes.</h3>
            <p className="text-gray-400 text-sm mt-1">El intake está al día.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {drafts.map((draft) => (
              <div key={draft.id} className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-orange-400 flex flex-col md:flex-row items-start md:items-center justify-between">
                
                {/* Info del Borrador */}
                <div className="mb-4 md:mb-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded font-bold">
                      DRAFT PENDIENTE
                    </span>
                    <span className="text-sm text-gray-500">Origen: Captura Inicial de Intake</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {draft.medication?.name || "Medicamento Crudo"}
                  </h3>
                  <p className="text-gray-600 mt-1">
                     <span className="font-semibold">Residente:</span> {draft.patient?.name || "Desconocido"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 italic">
                    Notas de Origen: "{draft.instructions}"
                  </p>
                </div>

                {/* Acciones Rápidas */}
                <div className="flex gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => handleDiscard(draft.id)}
                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    Descartar (D/C)
                  </button>
                  <button 
                    onClick={() => alert("Módulo Edición en Construcción Iterativa")}
                    className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    Editar Med
                  </button>
                  <button 
                    onClick={() => handleOpenApprove(draft)}
                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition"
                  >
                    Establecer Horario y Activar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE APROBACIÓN */}
      {isModalOpen && selectedDraft && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center p-4 z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
            <h2 className="text-2xl font-bold mb-1">Activar Prescripción</h2>
            <p className="text-gray-500 text-sm mb-6">Esta acción conectará a {selectedDraft.medication?.name} al reloj diario del PAI de {selectedDraft.patient?.name}.</p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-semibold mb-1">Frecuencia Clínica</label>
                <select 
                  className="w-full border p-2 rounded"
                  value={formFrequency}
                  onChange={(e) => setFormFrequency(e.target.value)}
                >
                  <option value="DIARIO">Diario</option>
                  <option value="CADA_8_HORAS">Cada 8 Horas</option>
                  <option value="CADA_12_HORAS">Cada 12 Horas</option>
                  <option value="PRN">Solo por Razón Necesaria (PRN)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Horarios Fijos (Separados por coma)</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded"
                  placeholder="Ej: 08:00, 14:00"
                  value={formTimes}
                  onChange={(e) => setFormTimes(e.target.value)}
                />
                <p className="text-xs text-blue-600 mt-1">El Cronjob generará botones para estos horarios.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 text-gray-600 font-semibold border rounded-lg"
              >
                Cancelar
              </button>
              <button 
                onClick={submitApprove}
                className="flex-1 py-3 text-white font-bold bg-green-600 rounded-lg shadow-lg hover:bg-green-700"
              >
                Sign-Off / Aprobar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
