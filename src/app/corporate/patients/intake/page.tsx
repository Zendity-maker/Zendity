"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveIntakeDraft, submitIntake } from "@/actions/intake/intake.actions";

export default function IntakeWizardPage() {
  const router = useRouter();
  
  // Fake HQ for UI Dev
  const DEMO_HQ_ID = "00000000-0000-0000-0000-000000000001";

  const [activeTab, setActiveTab] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED">("IDLE");
  
  const [formData, setFormData] = useState({
    patientId: "",
    name: "",
    headquartersId: DEMO_HQ_ID,
    medicalHistory: "",
    allergies: "",
    diagnoses: "",
    mobilityLevel: "INDEPENDENT",
    continenceLevel: "CONTINENT",
    dietSpecifics: "REGULAR",
    downtonScore: 0,
    bradenScore: 23,
    rawMedications: "",
  });

  // Debounced Auto-Save
  useEffect(() => {
    const handler = setTimeout(() => {
      handleAutoSave(formData);
    }, 2000); // Auto-save after 2s of inactivity

    return () => clearTimeout(handler);
  }, [formData]);

  const handleAutoSave = async (data: typeof formData) => {
    // Identity is fiercely Required to even start the draft
    if (!data.name || data.name.trim() === "") return;
    
    setSaveStatus("SAVING");
    const res = await saveIntakeDraft({
      patientId: data.patientId || undefined,
      headquartersId: data.headquartersId,
      name: data.name,
      medicalHistory: data.medicalHistory,
      allergies: data.allergies,
      diagnoses: data.diagnoses,
      mobilityLevel: data.mobilityLevel,
      continenceLevel: data.continenceLevel,
      dietSpecifics: data.dietSpecifics,
      downtonScore: Number(data.downtonScore),
      bradenScore: Number(data.bradenScore),
      rawMedications: data.rawMedications,
    });

    if (res.success && res.patientId) {
      if (!data.patientId) {
        setFormData(prev => ({ ...prev, patientId: res.patientId! }));
      }
      setSaveStatus("SAVED");
      setTimeout(() => setSaveStatus("IDLE"), 2000);
    }
  };

  const handleFieldChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const jumpToTab = (tabIndex: number) => {
    // Triggers manual auto-save right before jumping
    handleAutoSave(formData);
    setActiveTab(tabIndex);
  };

  const handleSubmit = async () => {
    // Soft validation
    if (!formData.patientId) return alert("Debe ingresar la identidad primero.");
    if (!formData.allergies) return alert("Advertencia: Alergias no especificadas.");
    
    setIsSaving(true);
    const res = await submitIntake(formData.patientId);
    if (res.success) {
      alert("¡Ingreso Completado! Residente en Radar Operativo.");
      router.push("/corporate/patients");
    } else {
      alert("Error al emitir Intake: " + res.error);
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4 sm:px-6">
      
      {/* HEADER WIZARD */}
      <div className="max-w-4xl w-full mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Registro Maestro de Ingreso (Intake)</h1>
          <p className="text-gray-500 mt-1">
            Módulo asíncrono. Los cambios se guardan automáticamente en estado Borrador (INGRESADO).
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Status Nube
          </span>
          {saveStatus === "SAVING" && <span className="text-yellow-600 font-bold bg-yellow-50 px-3 py-1 rounded">Autoguardando...</span>}
          {saveStatus === "SAVED" && <span className="text-green-600 font-bold bg-green-50 px-3 py-1 rounded">Borrador Asegurado</span>}
          {saveStatus === "IDLE" && <span className="text-gray-400">Al día</span>}
        </div>
      </div>

      <div className="max-w-4xl w-full bg-white shadow-xl rounded-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* SIDEBAR TABS */}
        <div className="w-full md:w-64 bg-gray-100 p-6 border-r border-gray-200">
          <nav className="space-y-2">
            {[ 
              { num: 1, title: "Identidad Base", desc: "Demografía y HQ" },
              { num: 2, title: "Triage Clínico", desc: "Alergias y Dx" },
              { num: 3, title: "PAI y Riesgos", desc: "Dieta, UPP, Caídas" },
              { num: 4, title: "Log Farmacológico", desc: "eMAR Borrador" },
            ].map(tab => (
              <button
                key={tab.num}
                onClick={() => jumpToTab(tab.num)}
                className={`w-full text-left flex flex-col px-4 py-3 rounded-xl transition ${
                  activeTab === tab.num 
                    ? "bg-blue-600 text-white shadow-md" 
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span className="font-semibold text-sm">Paso {tab.num}</span>
                <span className={`text-xs mt-0.5 ${activeTab === tab.num ? "text-blue-200" : "text-gray-500"}`}>
                  {tab.title}
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-12">
             <button 
                onClick={handleSubmit} 
                disabled={isSaving || !formData.patientId}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg transition"
             >
                {isSaving ? "Emitiendo..." : "Completar Ingreso"}
             </button>
             <p className="text-xs text-center text-gray-500 mt-3 px-2">
               Al emitir, el residente pasa a "Pendiente de Revisión" en Piso.
             </p>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 p-8 bg-white min-h-[550px]">
          
          {activeTab === 1 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Identidad del Residente</h2>
                <div className="space-y-5">
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre Completo (Obligatorio)</label>
                     <input 
                       type="text" 
                       value={formData.name}
                       onChange={(e) => handleFieldChange("name", e.target.value)}
                       className="w-full border-gray-300 rounded-lg p-3 border focus:ring-2 focus:ring-blue-500 outline-none"
                       placeholder="Ej: Roberto Sánchez Díaz"
                     />
                   </div>
                   <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                     <p className="text-sm text-gray-600">Nota Operativa: Llenar el nombre crea el anclaje del borrador (Draft). El resto de los campos de identidad y familiar primario se conectarán aquí.</p>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 2 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Triage Clínico Día Cero</h2>
                <div className="space-y-5">
                   <div>
                     <label className="block text-sm font-semibold text-red-600 mb-1">Alergias Conocidas (Crítico)</label>
                     <input 
                       type="text" 
                       value={formData.allergies}
                       onChange={(e) => handleFieldChange("allergies", e.target.value)}
                       className="w-full border-red-200 bg-red-50 rounded-lg p-3 border focus:ring-2 focus:ring-red-500 outline-none"
                       placeholder="Ej: Penicilina, Sulfa. Escribir NINGUNA si no aplica."
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Diagnóstico Principal de Ingreso</label>
                     <textarea 
                       value={formData.diagnoses}
                       onChange={(e) => handleFieldChange("diagnoses", e.target.value)}
                       className="w-full border-gray-300 rounded-lg p-3 border focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                       placeholder="Ej: Alzheimer moderado, Hipertensión controlada."
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Historia Médica / Cirugías Previas</label>
                     <textarea 
                       value={formData.medicalHistory}
                       onChange={(e) => handleFieldChange("medicalHistory", e.target.value)}
                       className="w-full border-gray-300 rounded-lg p-3 border focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                       placeholder="Breve sumario clínico..."
                     />
                   </div>
                </div>
             </div>
          )}

          {activeTab === 3 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Plan de Vida (PAI) y Riesgos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Dieta Inicial</label>
                      <select 
                         value={formData.dietSpecifics} 
                         onChange={(e) => handleFieldChange("dietSpecifics", e.target.value)}
                         className="w-full p-3 border border-gray-300 rounded-lg"
                      >
                         <option value="REGULAR">Regular</option>
                         <option value="BLANDA">Blanda / Fácil Masticación</option>
                         <option value="PUREE">Puré / Procesada</option>
                         <option value="DIABETICA">Diabética</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Movilidad Asistida</label>
                      <select 
                         value={formData.mobilityLevel} 
                         onChange={(e) => handleFieldChange("mobilityLevel", e.target.value)}
                         className="w-full p-3 border border-gray-300 rounded-lg"
                      >
                         <option value="INDEPENDENT">Independiente (Camina solo)</option>
                         <option value="ASSISTED">Requiere Apoyo / Andador</option>
                         <option value="WHEELCHAIR">Silla de Ruedas</option>
                         <option value="BEDRIDDEN">Encamado Total</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Puntuación Downton (Caídas)</label>
                      <input 
                        type="number" 
                        value={formData.downtonScore}
                        onChange={(e) => handleFieldChange("downtonScore", parseInt(e.target.value))}
                        className="w-full border-gray-300 rounded-lg p-3 border"
                      />
                      <p className="text-xs text-gray-500 mt-1">Si es &gt;2 se activará riesgo Automático.</p>
                   </div>
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Puntuación Braden (UPPs)</label>
                      <input 
                        type="number" 
                        value={formData.bradenScore}
                        onChange={(e) => handleFieldChange("bradenScore", parseInt(e.target.value))}
                        className="w-full border-gray-300 rounded-lg p-3 border"
                      />
                      <p className="text-xs text-gray-500 mt-1">Si es {"<14"} se activará riesgo de Úlceras.</p>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 4 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Inventario Lógico (eMAR)</h2>
                <div className="space-y-5">
                   <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <h4 className="font-bold text-orange-800 text-sm mb-1">Pre-Conciliación Farmacológica</h4>
                      <p className="text-sm text-orange-700">
                        Escriba una línea por medicamento. No se activarán dosis reales en la Tablet de enfermería hasta que un Médico efectúe <strong>Approve</strong> en la Cabina Clínica.
                      </p>
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Recetas Crudas o Funda de Boticas</label>
                     <textarea 
                       value={formData.rawMedications}
                       onChange={(e) => handleFieldChange("rawMedications", e.target.value)}
                       className="w-full border-gray-300 rounded-lg p-3 border focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed min-h-[250px] font-mono text-sm"
                       placeholder="Ej:&#10;Losartan 50mg, por las mañanas&#10;Tylenol PM, si tiene dolor en la noche&#10;Vitamina C"
                     />
                   </div>
                </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
}
