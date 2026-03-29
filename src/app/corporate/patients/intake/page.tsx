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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {/* Columna Izquierda: Parametrización Logística (Toggles/Selectores Visuales) */}
                   <div className="space-y-6">
                       <div>
                          <label className="block text-sm font-black text-slate-700 uppercase tracking-widest mb-3">Movilidad y Asistencia</label>
                          <div className="grid grid-cols-2 gap-3">
                              {[ 
                                { id: "INDEPENDENT", label: "Independiente", icon: "🚶‍♂️" },
                                { id: "ASSISTED", label: "Apoyo Menor", icon: "🦯" },
                                { id: "WHEELCHAIR", label: "Silla de Ruedas", icon: "🦽" },
                                { id: "BEDRIDDEN", label: "Encamado Total", icon: "🛏️" }
                              ].map(m => (
                                 <button
                                     key={m.id}
                                     type="button"
                                     onClick={() => handleFieldChange("mobilityLevel", m.id)}
                                     className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center active:scale-95 ${formData.mobilityLevel === m.id ? 'bg-indigo-50 border-indigo-500 text-indigo-800 shadow-md scale-105' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-slate-50'}`}
                                 >
                                     <span className="text-3xl">{m.icon}</span>
                                     <span className="text-xs font-bold leading-tight">{m.label}</span>
                                 </button>
                              ))}
                          </div>
                       </div>
                       
                       <div>
                          <label className="block text-sm font-black text-slate-700 uppercase tracking-widest mb-3">Régimen Dietético</label>
                          <div className="grid grid-cols-2 gap-3">
                              {[ 
                                { id: "REGULAR", label: "Regular" },
                                { id: "BLANDA", label: "Blanda" },
                                { id: "PUREE", label: "Puré" },
                                { id: "DIABETICA", label: "Diabética" }
                              ].map(d => (
                                 <button
                                     key={d.id}
                                     type="button"
                                     onClick={() => handleFieldChange("dietSpecifics", d.id)}
                                     className={`p-3 rounded-2xl font-bold transition-all border-2 active:scale-95 ${formData.dietSpecifics === d.id ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-orange-200'}`}
                                 >
                                     {d.label}
                                 </button>
                              ))}
                          </div>
                       </div>
                   </div>

                   {/* Columna Derecha: Sliders de Riesgo Clínico */}
                   <div className="space-y-6">
                       <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm relative overflow-hidden">
                          <div className={`absolute top-0 left-0 w-2 h-full ${formData.downtonScore > 2 ? 'bg-rose-500' : 'bg-emerald-400'}`}></div>
                          <div className="flex justify-between items-center mb-6 pl-2">
                            <div>
                                <label className="text-xl font-black text-slate-800 block">Riesgo de Caídas</label>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Escala Downton</span>
                            </div>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border-2 ${formData.downtonScore > 2 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                                <span className="text-2xl font-black">{formData.downtonScore}</span>
                            </div>
                          </div>
                          
                          <input 
                            type="range" 
                            min="0" max="6" step="1"
                            value={formData.downtonScore}
                            onChange={(e) => handleFieldChange("downtonScore", parseInt(e.target.value))}
                            className={`w-full h-6 rounded-full appearance-none outline-none shadow-inner cursor-pointer transition-colors ${formData.downtonScore > 2 ? 'bg-rose-200' : 'bg-emerald-100'}`}
                            style={{ 
                                WebkitAppearance: 'none',
                                background: `linear-gradient(to right, ${formData.downtonScore > 2 ? '#f43f5e' : '#34d399'} ${(formData.downtonScore / 6) * 100}%, ${formData.downtonScore > 2 ? '#ffe4e6' : '#d1fae5'} ${(formData.downtonScore / 6) * 100}%)`
                            }}
                          />
                          <div className="flex justify-between text-xs font-bold text-slate-400 mt-3 px-1">
                            <span>0 (Bajo)</span>
                            <span>Crítico (6)</span>
                          </div>
                       </div>

                       <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm relative overflow-hidden">
                          <div className={`absolute top-0 left-0 w-2 h-full ${formData.bradenScore < 14 ? 'bg-rose-500' : 'bg-emerald-400'}`}></div>
                          <div className="flex justify-between items-center mb-6 pl-2">
                            <div>
                                <label className="text-xl font-black text-slate-800 block">Riesgo UPPs (Úlceras)</label>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Escala Braden</span>
                            </div>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border-2 ${formData.bradenScore < 14 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                                <span className="text-2xl font-black">{formData.bradenScore}</span>
                            </div>
                          </div>
                          
                          <input 
                            type="range" 
                            min="6" max="23" step="1"
                            value={formData.bradenScore}
                            onChange={(e) => handleFieldChange("bradenScore", parseInt(e.target.value))}
                            className={`w-full h-6 rounded-full appearance-none outline-none shadow-inner cursor-pointer transition-colors ${formData.bradenScore < 14 ? 'bg-rose-200' : 'bg-emerald-100'}`}
                            style={{ 
                                WebkitAppearance: 'none',
                                background: `linear-gradient(to right, ${formData.bradenScore < 14 ? '#f43f5e' : '#34d399'} ${((formData.bradenScore - 6) / 17) * 100}%, ${formData.bradenScore < 14 ? '#ffe4e6' : '#d1fae5'} ${((formData.bradenScore - 6) / 17) * 100}%)`
                            }}
                          />
                          <div className="flex justify-between text-xs font-bold text-slate-400 mt-3 px-1">
                            <span>Crítico (6)</span>
                            <span>Sin Riesgo (23)</span>
                          </div>
                       </div>
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
