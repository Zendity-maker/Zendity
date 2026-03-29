"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveIntakeDraft, submitIntake } from "@/actions/intake/intake.actions";
import { User, Stethoscope, Activity, Pill, CheckCircle, Save, AlertCircle, ChevronRight, Check, ActivitySquare } from "lucide-react";

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

  const tabs = [ 
    { num: 1, title: "Identidad Base", desc: "Demografía y HQ", icon: User },
    { num: 2, title: "Triage Clínico", desc: "Alergias y Dx", icon: Stethoscope },
    { num: 3, title: "PAI y Riesgos", desc: "Dieta, UPP, Caídas", icon: Activity },
    { num: 4, title: "Log Farmacológico", desc: "eMAR Borrador", icon: Pill },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center py-6 px-4 md:px-8 font-sans">
      <div className="w-full max-w-[1600px] flex flex-col space-y-8">
        
        {/* HEADER CABINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-8 md:p-10 rounded-[3rem] shadow-sm border border-slate-200">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[1.5rem] bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-sm shrink-0">
              <ActivitySquare size={32} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Intake Maestro</h1>
              <p className="text-slate-500 mt-1 font-bold tracking-widest uppercase text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse"></span>
                Cabina de Admisión Clínica Centralizada
              </p>
            </div>
          </div>
          
          <div className="mt-6 md:mt-0 flex items-center gap-4 bg-slate-50 p-4 lg:px-8 rounded-[2rem] border border-slate-100 shadow-inner">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Estado del Sincronismo</span>
              {saveStatus === "SAVING" && (
                <div className="flex items-center gap-2 text-amber-600 font-extrabold text-sm bg-amber-50 px-4 py-1.5 rounded-full border border-amber-100 shadow-sm">
                  <Save className="w-4 h-4 animate-bounce" /> Autoguardando...
                </div>
              )}
              {saveStatus === "SAVED" && (
                <div className="flex items-center gap-2 text-teal-700 font-extrabold text-sm bg-teal-50 px-4 py-1.5 rounded-full border border-teal-100 shadow-sm">
                  <CheckCircle className="w-4 h-4" /> Borrador Asegurado
                </div>
              )}
              {saveStatus === "IDLE" && (
                <div className="flex items-center gap-2 text-slate-500 font-bold text-sm bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
                  <Check className="w-4 h-4 text-emerald-500" /> Al día en la Nube
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CONTENEDOR SPLIT-VIEW */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 flex-1">
          
          {/* SIDEBAR TABS (Índice de Navegación) */}
          <div className="lg:w-[360px] flex flex-col gap-6 shrink-0">
            <div className="bg-white rounded-[3rem] p-6 shadow-sm border border-slate-200 flex flex-col gap-3">
              <h3 className="font-extrabold text-slate-800 text-lg px-4 mb-2">Bloques de Admisión</h3>
              {tabs.map(tab => {
                const isActive = activeTab === tab.num;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.num}
                    onClick={() => jumpToTab(tab.num)}
                    className={`w-full text-left flex items-center p-5 rounded-[2rem] transition-all group ${
                      isActive 
                        ? "bg-slate-900 shadow-lg translate-x-2" 
                        : "bg-transparent hover:bg-slate-50 border border-transparent hover:border-slate-100 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center shrink-0 transition-colors shadow-sm ${isActive ? "bg-slate-800 text-teal-400" : "bg-white border border-slate-100 text-slate-500 group-hover:bg-slate-200"}`}>
                      <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <div className="ml-5 flex-1">
                      <span className={`block font-black text-base md:text-lg mb-1 ${isActive ? "text-white" : "text-slate-900"}`}>{tab.title}</span>
                      <span className={`block text-[11px] font-bold uppercase tracking-wider ${isActive ? "text-slate-400" : "text-slate-500"}`}>{tab.desc}</span>
                    </div>
                    {isActive && <ChevronRight className="w-6 h-6 text-slate-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* BOTÓN DE CIERRE MAESTRO */}
            <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-200 mt-auto flex flex-col gap-4">
               <div className="text-center px-4 mb-2">
                   <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Validación Final</span>
               </div>
               <button 
                  onClick={handleSubmit} 
                  disabled={isSaving || !formData.patientId}
                  className={`w-full py-6 px-4 rounded-[2.5rem] font-black text-xl tracking-tight transition-all flex flex-col items-center justify-center gap-2 group
                      ${(isSaving || !formData.patientId) 
                          ? 'bg-slate-100 text-slate-400 border-2 border-slate-200 cursor-not-allowed shadow-inner' 
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/30 active:scale-[0.98]'}`}
               >
                  <span className="flex items-center gap-2 text-center leading-none">
                      {isSaving ? "EMITIENDO ADMISIÓN..." : "COMPLETAR INGRESO OFICIAL"}
                  </span>
                  {!isSaving && formData.patientId && (
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-200 mt-1">
                          Bloqueará la edición inicial
                      </span>
                  )}
               </button>
            </div>
          </div>

          {/* AREA DE TRABAJO CENTRAL (Bento Form) */}
          <div className="flex-1 bg-white rounded-[3rem] p-8 lg:p-14 shadow-sm border border-slate-200 min-h-[660px] flex flex-col overflow-hidden relative">
            
            {/* BACKGROUND ELEMENT TO MAKE WHITE BLOCKS POP */}
            <div className="absolute inset-0 bg-slate-50/50 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col flex-1 h-full">
                {activeTab === 1 && (
                   <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                      <div className="mb-12">
                        <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                          <User className="w-10 h-10 text-teal-600" /> Identidad Fundamental
                        </h2>
                        <p className="text-slate-500 font-bold text-lg mt-3">Registra el nombre legal para inicializar el expediente clínico en la base de datos.</p>
                      </div>
                      
                      <div className="space-y-10 flex-1">
                         <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                           <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Nombre Completo (Obligatorio)</label>
                           <input 
                             type="text" 
                             value={formData.name}
                             onChange={(e) => handleFieldChange("name", e.target.value)}
                             className="w-full bg-slate-50 hover:bg-white focus:bg-white border-2 border-slate-200 rounded-[2rem] px-8 py-6 text-2xl font-black text-slate-900 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all shadow-inner placeholder:text-slate-300"
                             placeholder="Ej: Roberto Sánchez Díaz"
                           />
                         </div>
                         
                         <div className="bg-white p-8 rounded-[2.5rem] border-y border-r border-slate-200 border-l-[8px] border-l-teal-500 shadow-sm flex gap-6 items-start">
                           <div className="bg-teal-50 p-4 rounded-[1.5rem] shrink-0">
                               <AlertCircle className="w-8 h-8 text-teal-600" />
                           </div>
                           <div>
                              <h4 className="font-black text-slate-900 text-xl mb-2">Punto de Control Operativo</h4>
                              <p className="text-base text-slate-600 font-medium leading-relaxed">
                                Al introducir el nombre, el sistema crea un anclaje seguro en la base de datos <code className="bg-slate-100 text-teal-700 px-2 py-1 rounded-lg text-sm font-bold">Draft Mode</code>. Todos los módulos posteriores de demografía, facturación y familiares B2C se conectarán a esta identidad central de forma automática.
                              </p>
                           </div>
                         </div>
                      </div>
                   </div>
                )}

                {activeTab === 2 && (
                   <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                      <div className="mb-12">
                        <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                          <Stethoscope className="w-10 h-10 text-teal-600" /> Triage Clínico Base
                        </h2>
                        <p className="text-slate-500 font-bold text-lg mt-3">Evaluación médica inicial para el conocimiento táctico del equipo de enfermería.</p>
                      </div>
                      
                      <div className="space-y-8 flex-1">
                         <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border-y border-r border-slate-200 border-l-[8px] border-l-rose-500 shadow-sm flex flex-col">
                           <label className="flex items-center gap-3 text-sm font-black text-rose-700 uppercase tracking-widest mb-4">
                              <AlertCircle className="w-6 h-6" strokeWidth={3} /> Alergias Conocidas (Crítico)
                           </label>
                           <input 
                             type="text" 
                             value={formData.allergies}
                             onChange={(e) => handleFieldChange("allergies", e.target.value)}
                             className="w-full bg-rose-50/30 hover:bg-white focus:bg-white border-2 border-rose-200 rounded-[2rem] px-8 py-6 text-xl text-rose-900 font-black focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all shadow-inner placeholder:text-rose-300"
                             placeholder="Ej: Penicilina, Sulfa. Escribir 'NINGUNA' si no aplica."
                           />
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                             <label className="block text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Diagnóstico Principal</label>
                             <textarea 
                               value={formData.diagnoses}
                               onChange={(e) => handleFieldChange("diagnoses", e.target.value)}
                               className="w-full flex-1 bg-slate-50 hover:bg-white border-2 border-slate-200 rounded-[2rem] p-6 text-slate-800 font-semibold text-lg focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all shadow-inner resize-none min-h-[220px]"
                               placeholder="Ej: Alzheimer moderado, Hipertensión controlada..."
                             />
                           </div>
                           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
                             <label className="block text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Historia y Cirugías</label>
                             <textarea 
                               value={formData.medicalHistory}
                               onChange={(e) => handleFieldChange("medicalHistory", e.target.value)}
                               className="w-full flex-1 bg-slate-50 hover:bg-white border-2 border-slate-200 rounded-[2rem] p-6 text-slate-800 font-semibold text-lg focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all shadow-inner resize-none min-h-[220px]"
                               placeholder="Sumario de historial clínico pasado y cirugías mayores..."
                             />
                           </div>
                         </div>
                      </div>
                   </div>
                )}

                {activeTab === 3 && (
                   <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                      <div className="mb-10">
                        <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                          <Activity className="w-10 h-10 text-teal-600" /> Plan de Vida (PAI) y Riesgos
                        </h2>
                        <p className="text-slate-500 font-bold text-lg mt-3">Parametrización modular de logística de cuidados y vulnerabilidad.</p>
                      </div>
                      
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 flex-1">
                         {/* BENTO IZQUIERDO: Parametrización Logística */}
                         <div className="space-y-10">
                             <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-200 shadow-sm">
                                <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-6">Movilidad y Asistencia</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {[ 
                                      { id: "INDEPENDENT", label: "Independiente", icon: "🚶‍♂️" },
                                      { id: "ASSISTED", label: "Apoyo Menor", icon: "🦯" },
                                      { id: "WHEELCHAIR", label: "Silla Ruedas", icon: "🦽" },
                                      { id: "BEDRIDDEN", label: "Encamado", icon: "🛏️" }
                                    ].map(m => (
                                       <button
                                           key={m.id}
                                           type="button"
                                           onClick={() => handleFieldChange("mobilityLevel", m.id)}
                                           className={`p-5 rounded-[2rem] border-4 transition-all flex flex-col xl:flex-row items-center gap-4 active:scale-95 ${
                                             formData.mobilityLevel === m.id 
                                               ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-md ring-4 ring-teal-500/20' 
                                               : 'bg-slate-50 border-transparent shadow-inner text-slate-500 hover:bg-slate-100 hover:border-slate-200'
                                           }`}
                                       >
                                           <span className={`text-4xl bg-white w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-sm ${formData.mobilityLevel === m.id ? 'shadow-teal-200' : 'shadow-slate-200'}`}>{m.icon}</span>
                                           <span className="font-black text-sm md:text-base text-center xl:text-left leading-tight">{m.label}</span>
                                       </button>
                                    ))}
                                </div>
                             </div>
                             
                             <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-200 shadow-sm">
                                <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-6">Régimen Dietético</label>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                                           className={`p-6 rounded-[2rem] font-black text-base transition-all border-4 active:scale-95 flex items-center justify-center ${
                                             formData.dietSpecifics === d.id 
                                                ? 'bg-slate-800 border-slate-800 text-white shadow-lg ring-4 ring-slate-800/20' 
                                                : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100 hover:border-slate-200 shadow-inner'
                                           }`}
                                       >
                                           {d.label}
                                       </button>
                                    ))}
                                </div>
                             </div>
                         </div>
    
                         {/* BENTO DERECHO: Sliders Táctiles de Riesgo */}
                         <div className="space-y-10">
                             {/* Slider Downton */}
                             <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                                <div className={`absolute top-0 left-0 w-2 h-full transition-colors duration-500 ${formData.downtonScore > 2 ? 'bg-rose-500' : 'bg-teal-400'}`}></div>
                                <div className="flex justify-between items-center mb-10 pl-4">
                                  <div>
                                      <label className="text-2xl font-black text-slate-800 block mb-1">Riesgo de Caídas</label>
                                      <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Escala Downton</span>
                                  </div>
                                  <div className={`w-20 h-20 rounded-[1.5rem] flex flex-col items-center justify-center shadow-lg border-2 transition-colors duration-500 ${formData.downtonScore > 2 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-teal-50 border-teal-200 text-teal-600'}`}>
                                      <span className="text-4xl font-black leading-none">{formData.downtonScore}</span>
                                  </div>
                                </div>
                                
                                <div className="px-4 pb-4">
                                  <input 
                                    type="range" 
                                    min="0" max="6" step="1"
                                    value={formData.downtonScore}
                                    onChange={(e) => handleFieldChange("downtonScore", parseInt(e.target.value))}
                                    className={`w-full h-10 rounded-full appearance-none outline-none cursor-pointer transition-all focus:ring-4 focus:ring-offset-4 focus:ring-slate-200 shadow-inner ${formData.downtonScore > 2 ? 'bg-rose-100' : 'bg-teal-100'}`}
                                    style={{ 
                                        WebkitAppearance: 'none',
                                        background: `linear-gradient(to right, ${formData.downtonScore > 2 ? '#f43f5e' : '#14b8a6'} ${(formData.downtonScore / 6) * 100}%, ${formData.downtonScore > 2 ? '#ffe4e6' : '#ccfbf1'} ${(formData.downtonScore / 6) * 100}%)`
                                    }}
                                  />
                                  <div className="flex justify-between text-sm font-bold text-slate-500 mt-6 px-2">
                                    <span>0 (Bajo Riesgo)</span>
                                    <span className="text-rose-600">Crítico (6)</span>
                                  </div>
                                </div>
                             </div>
    
                             {/* Slider Braden */}
                             <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                                <div className={`absolute top-0 left-0 w-2 h-full transition-colors duration-500 ${formData.bradenScore < 14 ? 'bg-rose-500' : 'bg-teal-400'}`}></div>
                                <div className="flex justify-between items-center mb-10 pl-4">
                                  <div>
                                      <label className="text-2xl font-black text-slate-800 block mb-1">Riesgo UPPs (Úlceras)</label>
                                      <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Escala Braden</span>
                                  </div>
                                  <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center shadow-lg border-2 transition-colors duration-500 ${formData.bradenScore < 14 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-teal-50 border-teal-200 text-teal-600'}`}>
                                      <span className="text-4xl font-black leading-none">{formData.bradenScore}</span>
                                  </div>
                                </div>
                                
                                <div className="px-4 pb-4">
                                  <input 
                                    type="range" 
                                    min="6" max="23" step="1"
                                    value={formData.bradenScore}
                                    onChange={(e) => handleFieldChange("bradenScore", parseInt(e.target.value))}
                                    className={`w-full h-10 rounded-full appearance-none outline-none cursor-pointer transition-all focus:ring-4 focus:ring-offset-4 focus:ring-slate-200 shadow-inner ${formData.bradenScore < 14 ? 'bg-rose-100' : 'bg-teal-100'}`}
                                    style={{ 
                                        WebkitAppearance: 'none',
                                        background: `linear-gradient(to right, ${formData.bradenScore < 14 ? '#f43f5e' : '#14b8a6'} ${((formData.bradenScore - 6) / 17) * 100}%, ${formData.bradenScore < 14 ? '#ffe4e6' : '#ccfbf1'} ${((formData.bradenScore - 6) / 17) * 100}%)`
                                    }}
                                  />
                                  <div className="flex justify-between text-sm font-bold text-slate-500 mt-6 px-2">
                                    <span className="text-rose-600">Crítico (6)</span>
                                    <span>Sin Riesgo (23)</span>
                                  </div>
                                </div>
                             </div>
                         </div>
                      </div>
                   </div>
                )}

                {activeTab === 4 && (
                   <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                      <div className="mb-10">
                        <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                          <Pill className="w-10 h-10 text-teal-600" /> Inventario Farmacológico (eMAR)
                        </h2>
                        <p className="text-slate-500 font-bold text-lg mt-3">Dipeo primario de boticas o recetas médicas entrantes para conciliación posterior.</p>
                      </div>
                      
                      <div className="space-y-8 flex-1 flex flex-col">
                         <div className="bg-white p-8 rounded-[2.5rem] border-y border-r border-slate-200 border-l-[8px] border-l-amber-400 shadow-sm flex gap-6 items-start">
                            <div className="bg-amber-50 p-4 rounded-[1.5rem] shrink-0">
                                <ActivitySquare className="w-8 h-8 text-amber-600" />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900 text-xl mb-2">Validación Médica Requerida</h4>
                              <p className="text-base text-slate-600 font-medium leading-relaxed">
                                Cualquier medicamento ingresado en este inventario permanecerá en estado <code className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-sm font-bold">DORMANT</code>. Ninguna tableta de enfermería exigirá la administración de la dosis hasta que el médico titular acceda al perfil y presione <span className="text-teal-600 font-extrabold uppercase tracking-widest text-xs mx-1">Approve & Synthesize</span>.
                              </p>
                            </div>
                         </div>
                         <div className="flex-1 flex flex-col bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                           <label className="block text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Recetario Directo / Transcripción</label>
                           <textarea 
                             value={formData.rawMedications}
                             onChange={(e) => handleFieldChange("rawMedications", e.target.value)}
                             className="w-full flex-1 bg-slate-50 hover:bg-white border-2 border-slate-200 rounded-[2rem] p-8 text-slate-800 font-mono text-lg md:text-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all shadow-inner resize-none min-h-[300px] leading-relaxed"
                             placeholder="Ej:
Losartan 50mg, por las mañanas
Tylenol PM, si tiene dolor en la noche
Vitamina C"
                           />
                         </div>
                      </div>
                   </div>
                )}

            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
