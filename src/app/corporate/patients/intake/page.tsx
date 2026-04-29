"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { saveIntakeDraft, submitIntake } from "@/actions/intake/intake.actions";
import { User, Stethoscope, Activity, Pill, CheckCircle, Save, AlertCircle, ChevronRight, Check, ActivitySquare, FileText, Upload, Phone, CreditCard, ShieldCheck, Hospital, X as XIcon, ClipboardCheck } from "lucide-react";
import { confirmIntake } from "@/actions/intake/intake.actions";

export default function IntakeWizardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const hqId = (user as any)?.hqId || (user as any)?.headquartersId || "";

  const [activeTab, setActiveTab] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED">("IDLE");
  
  const [tempMedName, setTempMedName] = useState("");
  const [tempMedTimes, setTempMedTimes] = useState<string[]>([]);
  const LOCAL_AVAILABLE_TIMES = [
    "05:00 AM",
    "06:00 AM",
    "08:00 AM",
    "12:00 PM",
    "02:00 PM",
    "05:00 PM",
    "08:00 PM",
    "10:00 PM",
    "PRN"
  ];

  const [formData, setFormData] = useState({
    patientId: "",
    name: "",
    headquartersId: hqId,
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

  // TAB 5 — Documentos e Identificación (Sprint P: +idNumber, +medicareNumber, +medicaidNumber)
  const [tab5Data, setTab5Data] = useState({
    dateOfBirth: "",
    roomNumber: "",
    ssnLastFour: "",
    insurancePlanName: "",
    insurancePolicyNumber: "",
    preferredHospital: "",
    photoUrl: "",
    medicalPlanUrl: "",
    medicareCardUrl: "",
    idCardUrl: "",
    idNumber: "",
    medicareNumber: "",
    medicaidNumber: "",
    address: "",
  });
  const [tab5Family, setTab5Family] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    accessLevel: "Full",
    relationship: "",
    address: "",
    idCardUrl: "",
    isPrimary: false,
  });
  const [tab5Saving, setTab5Saving] = useState(false);
  const [tab5Error, setTab5Error] = useState<string | null>(null);

  // Panel de revisiones pendientes (PENDIENTE_REVISION)
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoadingPending(true);
      try {
        const res = await fetch('/api/corporate/intake/pending-list');
        const data = await res.json();
        if (data.success) setPendingReviews(data.intakes ?? []);
      } catch {}
      setLoadingPending(false);
    };
    load();
  }, []);

  const handleConfirm = async (patientId: string) => {
    if (!confirm('¿Confirmar clínicamente este ingreso? Esta acción es irreversible.')) return;
    setConfirmingId(patientId);
    try {
      const res = await confirmIntake(patientId);
      if (res.success) {
        setPendingReviews(prev => prev.filter(r => r.patientId !== patientId));
      } else {
        alert('Error al confirmar: ' + (res.error ?? 'Error desconocido'));
      }
    } catch {
      alert('Error inesperado al confirmar.');
    }
    setConfirmingId(null);
  };

  const daysSince = (dateStr: string) => {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  };

  // TAB 6 — Documentos Zendi (Sprint P)
  const [documents, setDocuments] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [docCategory, setDocCategory] = useState("ID_CARD");
  const [docTitle, setDocTitle] = useState("");
  const [analyzeResult, setAnalyzeResult] = useState<any>(null);
  const [docError, setDocError] = useState<string | null>(null);

  // Debounced Auto-Save
  useEffect(() => {
    const handler = setTimeout(() => {
      handleAutoSave(formData);
    }, 2000); // Auto-save after 2s of inactivity

    return () => clearTimeout(handler);
  }, [formData]);

  const medicationsList = React.useMemo(() => {
    if (!formData.rawMedications) return [];
    try {
      return JSON.parse(formData.rawMedications);
    } catch {
      return [];
    }
  }, [formData.rawMedications]);

  const addMedication = () => {
    if (!tempMedName.trim()) return;
    const newList = [...medicationsList, { name: tempMedName.trim(), scheduleTimes: tempMedTimes.length > 0 ? tempMedTimes : ["PRN"] }];
    handleFieldChange("rawMedications", JSON.stringify(newList));
    setTempMedName("");
    setTempMedTimes([]);
  };

  const removeMedication = (index: number) => {
    const newList = medicationsList.filter((_: any, i: number) => i !== index);
    handleFieldChange("rawMedications", JSON.stringify(newList));
  };

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
    { num: 5, title: "Documentos e Identificación", desc: "Seguro, ID, Familiar", icon: FileText },
    { num: 6, title: "Análisis Zendi", desc: "Subir docs → análisis IA", icon: Upload },
  ];

  // Cargar datos del Patient + FamilyMember cuando entra al Tab 5
  useEffect(() => {
    if (activeTab !== 5 || !formData.patientId) return;
    let cancelled = false;
    (async () => {
      try {
        const [pRes, fRes] = await Promise.all([
          fetch(`/api/care/resident-summary?patientId=${formData.patientId}`),
          fetch(`/api/corporate/family?patientId=${formData.patientId}`),
        ]);
        const pData = await pRes.json();
        const fData = await fRes.json();
        if (cancelled) return;
        if (pData.success && pData.patient) {
          const p = pData.patient;
          setTab5Data({
            dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : "",
            roomNumber: p.roomNumber || "",
            ssnLastFour: p.ssnLastFour || "",
            insurancePlanName: p.insurancePlanName || "",
            insurancePolicyNumber: p.insurancePolicyNumber || "",
            preferredHospital: p.preferredHospital || "",
            photoUrl: p.photoUrl || "",
            medicalPlanUrl: p.medicalPlanUrl || "",
            medicareCardUrl: p.medicareCardUrl || "",
            idCardUrl: p.idCardUrl || "",
            idNumber: p.idNumber || "",
            medicareNumber: p.medicareNumber || "",
            medicaidNumber: p.medicaidNumber || "",
            address: p.address || "",
          });
        }
        if (fData.success && fData.familyMembers?.length > 0) {
          const primary = fData.familyMembers.find((f: any) => f.isPrimary) || fData.familyMembers.find((f: any) => f.accessLevel === "Full") || fData.familyMembers[0];
          setTab5Family({
            id: primary.id || "",
            name: primary.name || "",
            email: primary.email || "",
            phone: primary.phone || "",
            accessLevel: primary.accessLevel || "Full",
            relationship: primary.relationship || "",
            address: primary.address || "",
            idCardUrl: primary.idCardUrl || "",
            isPrimary: !!primary.isPrimary,
          });
        }
      } catch (e) {
        console.error("[Tab5 load]", e);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, formData.patientId]);

  const saveTab5Patient = async () => {
    if (!formData.patientId) return;
    setTab5Saving(true);
    setTab5Error(null);
    try {
      const res = await fetch(`/api/corporate/patients/${formData.patientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateOfBirth: tab5Data.dateOfBirth || null,
          roomNumber: tab5Data.roomNumber || null,
          ssnLastFour: tab5Data.ssnLastFour || null,
          insurancePlanName: tab5Data.insurancePlanName || null,
          insurancePolicyNumber: tab5Data.insurancePolicyNumber || null,
          preferredHospital: tab5Data.preferredHospital || null,
          photoUrl: tab5Data.photoUrl || null,
          medicalPlanUrl: tab5Data.medicalPlanUrl || null,
          medicareCardUrl: tab5Data.medicareCardUrl || null,
          idCardUrl: tab5Data.idCardUrl || null,
          // Sprint P
          idNumber: tab5Data.idNumber || null,
          medicareNumber: tab5Data.medicareNumber || null,
          medicaidNumber: tab5Data.medicaidNumber || null,
          address: tab5Data.address || null,
        }),
      });
      if (!res.ok) throw new Error("Error guardando datos del residente");
    } catch (e: any) {
      setTab5Error(e.message || "Error guardando");
    } finally {
      setTab5Saving(false);
    }
  };

  const saveTab5Family = async () => {
    if (!formData.patientId || !tab5Family.name || !tab5Family.email) {
      setTab5Error("Nombre y email del familiar son requeridos");
      return;
    }
    setTab5Saving(true);
    setTab5Error(null);
    try {
      const res = await fetch(`/api/corporate/patients/${formData.patientId}/family`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tab5Family.name,
          email: tab5Family.email,
          phone: tab5Family.phone || null,
          accessLevel: tab5Family.accessLevel,
          relationship: tab5Family.relationship || null,
          address: tab5Family.address || null,
          idCardUrl: tab5Family.idCardUrl || null,
          isPrimary: tab5Family.isPrimary,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Error guardando familiar");
      setTab5Family(prev => ({ ...prev, id: data.familyMember?.id || prev.id }));
    } catch (e: any) {
      setTab5Error(e.message || "Error guardando");
    } finally {
      setTab5Saving(false);
    }
  };

  // Auto-save Tab 5 Patient fields (debounced 2s)
  useEffect(() => {
    if (activeTab !== 5 || !formData.patientId) return;
    const t = setTimeout(() => { saveTab5Patient(); }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab5Data]);

  // ───────────────────────────────────────────────────────────────
  // Tab 6 — Documentos Zendi (Sprint P)
  // ───────────────────────────────────────────────────────────────
  const fetchDocuments = async () => {
    if (!formData.patientId) return;
    try {
      const res = await fetch(`/api/corporate/intake/documents?patientId=${formData.patientId}`);
      const data = await res.json();
      if (data.success) setDocuments(data.documents || []);
    } catch (e) { console.error("[Tab6 fetch docs]", e); }
  };

  useEffect(() => {
    if (activeTab === 6 && formData.patientId) fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, formData.patientId]);

  // Sube imagen → redimensiona → POST analyze-document → guarda
  // solo análisis (el archivo NO se persiste, se descarta tras analizar).
  const handleDocumentUpload = async (file: File) => {
    if (!file || !formData.patientId) return;
    if (!docTitle.trim()) {
      setDocError("Escribe un título para el documento antes de subir");
      return;
    }
    setDocError(null);
    setAnalyzing(true);
    setAnalyzeResult(null);

    try {
      // Resize a 1200px max para Vision (mejor calidad que 500 de perfil)
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let w = img.width;
            let h = img.height;
            const MAX = 1200;
            if (w > h && w > MAX) { h = Math.round((h * MAX) / w); w = MAX; }
            else if (h > MAX) { w = Math.round((w * MAX) / h); h = MAX; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Canvas no disponible"));
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          };
          img.onerror = () => reject(new Error("Imagen inválida"));
          img.src = ev.target?.result as string;
        };
        reader.onerror = () => reject(new Error("FileReader error"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/corporate/intake/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: formData.patientId,
          category: docCategory,
          title: docTitle.trim(),
          fileBase64: base64,
          fileType: "image/jpeg",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setDocError(data.error || "Zendi no pudo analizar el documento");
        return;
      }
      setAnalyzeResult(data);
      setDocTitle("");
      await fetchDocuments();
      // base64 del archivo se descarta en scope local — nunca persiste
    } catch (e: any) {
      setDocError(e.message || "Error subiendo documento");
    } finally {
      setAnalyzing(false);
    }
  };

  // Aplicar sugerencias del análisis al perfil del residente
  const applySuggestionsToPatient = async () => {
    if (!analyzeResult || !formData.patientId) return;
    const s = analyzeResult.suggestions?.patient || {};
    setTab5Data(prev => ({
      ...prev,
      idNumber: s.idNumber || prev.idNumber,
      dateOfBirth: s.dateOfBirth || prev.dateOfBirth,
      insurancePlanName: s.insurancePlanName || prev.insurancePlanName,
      insurancePolicyNumber: s.insurancePolicyNumber || prev.insurancePolicyNumber,
      medicareNumber: s.medicareNumber || prev.medicareNumber,
      medicaidNumber: s.medicaidNumber || prev.medicaidNumber,
      preferredHospital: s.preferredHospital || prev.preferredHospital,
    }));
    // Pre-cargar meds del análisis en el Log farmacológico
    const meds = analyzeResult.suggestions?.medications || [];
    if (meds.length > 0) {
      const current = medicationsList;
      const merged = [...current, ...meds.map((m: any) => ({
        name: m.name,
        scheduleTimes: Array.isArray(m.scheduleTimes) && m.scheduleTimes.length > 0 ? m.scheduleTimes : ["PRN"],
      }))];
      handleFieldChange("rawMedications", JSON.stringify(merged));
    }
    setAnalyzeResult(null);
    alert("Campos sugeridos aplicados al perfil. Revisa el Tab 5 y el Log Farmacológico.");
  };

  // Uploader reutilizable: redimensiona a JPEG 70%, devuelve base64
  const handleImageUpload = (field: keyof typeof tab5Data, maxWidth: number = 800) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL("image/jpeg", 0.7);
        setTab5Data(prev => ({ ...prev, [field]: base64 }));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center py-6 px-4 md:px-8 font-sans">
      <div className="w-full max-w-[1600px] flex flex-col space-y-8">
        
        {/* ── PANEL REVISIONES PENDIENTES ──────────────────────────── */}
        {(loadingPending || pendingReviews.length > 0) && (
          <div className="bg-rose-50 border border-rose-200 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-5 h-5 text-rose-600" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-rose-700 tracking-tight">
                  Ingresos pendientes de confirmación clínica
                </h2>
                <p className="text-xs text-rose-500 font-bold mt-0.5">
                  Estos residentes completaron el formulario de admisión y esperan tu revisión final.
                </p>
              </div>
              {pendingReviews.length > 0 && (
                <span className="ml-auto min-w-[28px] h-[28px] flex items-center justify-center bg-rose-500 rounded-full text-[13px] font-black text-white">
                  {pendingReviews.length}
                </span>
              )}
            </div>

            {loadingPending ? (
              <p className="text-sm text-rose-400 font-bold animate-pulse px-2">Cargando revisiones...</p>
            ) : (
              <div className="space-y-3">
                {pendingReviews.map(intake => {
                  const days = daysSince(intake.updatedAt);
                  const isConfirming = confirmingId === intake.patientId;
                  return (
                    <div key={intake.patientId} className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 border border-rose-100 shadow-sm gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-rose-500" strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-800 truncate">{intake.patient?.name ?? '—'}</p>
                          <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                            En revisión desde hace{' '}
                            <span className={days >= 3 ? 'text-rose-600' : 'text-amber-600'}>
                              {days === 0 ? 'hoy' : `${days} día${days !== 1 ? 's' : ''}`}
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleConfirm(intake.patientId)}
                        disabled={isConfirming}
                        className="shrink-0 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition shadow-sm"
                      >
                        {isConfirming ? (
                          <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full inline-block" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" strokeWidth={2.5} />
                        )}
                        {isConfirming ? 'Confirmando...' : 'Confirmar ingreso'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Estado del Sincronismo</span>
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
                      <span className={`block text-[11px] font-bold uppercase tracking-wider ${isActive ? "text-slate-500" : "text-slate-500"}`}>{tab.desc}</span>
                    </div>
                    {isActive && <ChevronRight className="w-6 h-6 text-slate-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* BOTÓN DE CIERRE MAESTRO */}
            <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-200 mt-auto flex flex-col gap-4">
               <div className="text-center px-4 mb-2">
                   <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Validación Final</span>
               </div>
               <button 
                  onClick={handleSubmit} 
                  disabled={isSaving || !formData.patientId}
                  className={`w-full py-6 px-4 rounded-[2.5rem] font-black text-xl tracking-tight transition-all flex flex-col items-center justify-center gap-2 group
                      ${(isSaving || !formData.patientId) 
                          ? 'bg-slate-100 text-slate-500 border-2 border-slate-200 cursor-not-allowed shadow-inner' 
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
                             className="w-full bg-slate-50 hover:bg-white focus:bg-white border-2 border-slate-200 rounded-[2rem] px-8 py-6 text-2xl font-black text-slate-900 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all shadow-inner placeholder:text-slate-500"
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
                                      <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Escala Downton</span>
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
                                      <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Escala Braden</span>
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
                        <p className="text-slate-500 font-bold text-lg mt-3">Ingresa los medicamentos uno a uno y asigna sus horarios de distribución obligatorios.</p>
                      </div>
                      
                      <div className="space-y-6 flex-1 flex flex-col">
                         
                         <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                           <label className="block text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Añadir Nuevo Medicamento</label>
                           <div className="flex flex-col md:flex-row gap-4 mb-6">
                             <input 
                               type="text" 
                               value={tempMedName}
                               onChange={(e) => setTempMedName(e.target.value)}
                               placeholder="Ej: Losartan 50mg"
                               className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-[1.5rem] px-6 py-4 font-black text-slate-800 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none"
                             />
                             <button
                               onClick={addMedication}
                               disabled={!tempMedName.trim()}
                               className="px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-black text-lg rounded-[1.5rem] transition-all disabled:opacity-50"
                             >
                               Añadir
                             </button>
                           </div>
                           
                           <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Horarios Asignados (Opcional, defecto PRN)</label>
                           <div className="flex flex-wrap gap-2">
                             {LOCAL_AVAILABLE_TIMES.map(time => (
                               <label key={time} className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${tempMedTimes.includes(time) ? 'bg-teal-50 border-teal-500 text-teal-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                 <input type="checkbox" className="hidden" checked={tempMedTimes.includes(time)} onChange={() => {
                                   if (time === "PRN") setTempMedTimes(["PRN"]);
                                   else setTempMedTimes(prev => prev.includes(time) ? prev.filter(t => t !== time) : [...prev.filter(t => t !== "PRN"), time]);
                                 }} />
                                 {time}
                               </label>
                             ))}
                           </div>
                         </div>
                         
                         <div className="flex-1 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 p-6">
                           <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Borradores Listos para Insertar ({medicationsList.length})</h4>
                           {medicationsList.length === 0 ? (
                             <p className="text-center text-slate-500 font-medium py-10">No hay medicamentos en la lista. Comienza agregando uno arriba.</p>
                           ) : (
                             <div className="space-y-3">
                               {medicationsList.map((med: any, index: number) => (
                                 <div key={index} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                                   <div>
                                     <h5 className="font-black text-slate-800">{med.name}</h5>
                                     <div className="flex gap-2 mt-1 flex-wrap">
                                       {med.scheduleTimes.map((t: string) => (
                                         <span key={t} className="bg-teal-50 text-teal-700 text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-lg border border-teal-100">{t}</span>
                                       ))}
                                     </div>
                                   </div>
                                   <button onClick={() => removeMedication(index)} className="text-rose-500 hover:bg-rose-50 px-4 py-2 border border-transparent hover:border-rose-100 rounded-xl font-bold text-sm transition-colors">Quitar</button>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>

                      </div>
                   </div>
                )}

                {activeTab === 5 && (
                   <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                      <div className="mb-10">
                        <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                          <FileText className="w-10 h-10 text-teal-600" /> Documentos e Identificación
                        </h2>
                        <p className="text-slate-500 font-bold text-lg mt-3">
                          Datos legales, tarjetas y contacto de emergencia — aparecen en el Resumen de Residente oficial.
                        </p>
                      </div>

                      {!formData.patientId && (
                        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-sm font-bold text-amber-800">
                          <AlertCircle className="w-5 h-5 inline mr-2" />
                          Completa la Identidad Base primero para habilitar este bloque.
                        </div>
                      )}

                      {formData.patientId && (
                      <div className="space-y-8">

                        {/* SECCIÓN 1 — Datos del residente */}
                        <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                          <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                            <User className="w-5 h-5 text-teal-600" /> Datos del residente
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Fecha de nacimiento</label>
                              <input
                                type="date"
                                value={tab5Data.dateOfBirth}
                                onChange={(e) => setTab5Data(p => ({ ...p, dateOfBirth: e.target.value }))}
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Habitación</label>
                              <input
                                type="text"
                                value={tab5Data.roomNumber}
                                onChange={(e) => setTab5Data(p => ({ ...p, roomNumber: e.target.value }))}
                                placeholder="Ej: 12B"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
                                Seguro Social (últimos 4 dígitos)
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={4}
                                pattern="[0-9]{4}"
                                value={tab5Data.ssnLastFour}
                                onChange={(e) => setTab5Data(p => ({ ...p, ssnLastFour: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                                placeholder="####"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold font-mono text-slate-800 focus:outline-none focus:border-teal-400 tracking-widest"
                              />
                              <p className="text-[10px] text-slate-500 font-bold mt-1">Solo los últimos 4 dígitos por HIPAA</p>
                            </div>
                          </div>
                        </section>

                        {/* SECCIÓN 2 — Plan médico */}
                        <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                          <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-teal-600" /> Plan médico y traslados
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Nombre del plan</label>
                              <input
                                type="text"
                                value={tab5Data.insurancePlanName}
                                onChange={(e) => setTab5Data(p => ({ ...p, insurancePlanName: e.target.value }))}
                                placeholder="Ej: MCS, Triple-S, Medicare"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Número de contrato</label>
                              <input
                                type="text"
                                value={tab5Data.insurancePolicyNumber}
                                onChange={(e) => setTab5Data(p => ({ ...p, insurancePolicyNumber: e.target.value }))}
                                placeholder="Ej: 125 13 6458 00"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold font-mono text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
                                <Hospital className="w-3.5 h-3.5 inline mr-1" /> Hospital preferido de traslado
                              </label>
                              <input
                                type="text"
                                value={tab5Data.preferredHospital}
                                onChange={(e) => setTab5Data(p => ({ ...p, preferredHospital: e.target.value }))}
                                placeholder="Ej: Centro Médico de PR"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                          </div>
                        </section>

                        {/* SECCIÓN 2.5 — Identificadores (Sprint P) */}
                        <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                          <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-teal-600" /> Identificadores adicionales
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Número de ID / Licencia</label>
                              <input
                                type="text"
                                value={tab5Data.idNumber}
                                onChange={(e) => setTab5Data(p => ({ ...p, idNumber: e.target.value }))}
                                placeholder="Ej: 1234-5678-9012"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold font-mono text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Dirección previa</label>
                              <input
                                type="text"
                                value={tab5Data.address}
                                onChange={(e) => setTab5Data(p => ({ ...p, address: e.target.value }))}
                                placeholder="Ej: 123 Calle X, San Juan"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Número Medicare (MBI)</label>
                              <input
                                type="text"
                                value={tab5Data.medicareNumber}
                                onChange={(e) => setTab5Data(p => ({ ...p, medicareNumber: e.target.value }))}
                                placeholder="Ej: 1EG4-TE5-MK72"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold font-mono text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Número Medicaid</label>
                              <input
                                type="text"
                                value={tab5Data.medicaidNumber}
                                onChange={(e) => setTab5Data(p => ({ ...p, medicaidNumber: e.target.value }))}
                                placeholder="Ej: 000-00-0000"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold font-mono text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                          </div>
                        </section>

                        {/* SECCIÓN 3 — Documentos / imágenes */}
                        <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                          <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-teal-600" /> Documentos (imágenes)
                          </h3>
                          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0" />
                            <p className="text-sm text-indigo-800 font-medium leading-relaxed">
                              Estos documentos se almacenan de forma segura y aparecen en el <b>Resumen de Residente</b> para emergencias.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <UploadCard
                              label="Foto del residente"
                              value={tab5Data.photoUrl}
                              onUpload={handleImageUpload("photoUrl", 400)}
                              onClear={() => setTab5Data(p => ({ ...p, photoUrl: "" }))}
                              color="teal"
                            />
                            <UploadCard
                              label="Tarjeta de seguro médico"
                              value={tab5Data.medicalPlanUrl}
                              onUpload={handleImageUpload("medicalPlanUrl")}
                              onClear={() => setTab5Data(p => ({ ...p, medicalPlanUrl: "" }))}
                              color="indigo"
                            />
                            <UploadCard
                              label="Tarjeta Medicare"
                              hint="(opcional)"
                              value={tab5Data.medicareCardUrl}
                              onUpload={handleImageUpload("medicareCardUrl")}
                              onClear={() => setTab5Data(p => ({ ...p, medicareCardUrl: "" }))}
                              color="slate"
                            />
                            <UploadCard
                              label="ID gubernamental"
                              value={tab5Data.idCardUrl}
                              onUpload={handleImageUpload("idCardUrl")}
                              onClear={() => setTab5Data(p => ({ ...p, idCardUrl: "" }))}
                              color="amber"
                            />
                          </div>
                        </section>

                        {/* SECCIÓN 4 — Contacto de emergencia / familiar */}
                        <section className="bg-white p-6 md:p-8 rounded-[2rem] border-y border-r border-slate-200 border-l-[8px] border-l-teal-500 shadow-sm">
                          <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Phone className="w-5 h-5 text-teal-600" /> Contacto de emergencia / Familiar principal
                          </h3>
                          <p className="text-sm text-slate-500 font-medium mb-5">
                            Este familiar aparecerá como contacto primario en el Resumen de Residente para paramédicos.
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Nombre completo</label>
                              <input
                                type="text"
                                value={tab5Family.name}
                                onChange={(e) => setTab5Family(p => ({ ...p, name: e.target.value }))}
                                placeholder="Ej: María Pérez"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Email</label>
                              <input
                                type="email"
                                value={tab5Family.email}
                                onChange={(e) => setTab5Family(p => ({ ...p, email: e.target.value }))}
                                placeholder="maria@email.com"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Teléfono</label>
                              <input
                                type="tel"
                                value={tab5Family.phone}
                                onChange={(e) => setTab5Family(p => ({ ...p, phone: e.target.value }))}
                                placeholder="Ej: 787-555-1234"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Nivel de acceso</label>
                              <select
                                value={tab5Family.accessLevel}
                                onChange={(e) => setTab5Family(p => ({ ...p, accessLevel: e.target.value }))}
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              >
                                <option value="Full">Acceso completo</option>
                                <option value="Read-Only">Solo lectura</option>
                              </select>
                            </div>
                            {/* Sprint P — Datos extra del familiar encargado */}
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Relación</label>
                              <input
                                type="text"
                                value={tab5Family.relationship}
                                onChange={(e) => setTab5Family(p => ({ ...p, relationship: e.target.value }))}
                                placeholder="Ej: Hija, Esposo, Sobrino"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Dirección del familiar</label>
                              <input
                                type="text"
                                value={tab5Family.address}
                                onChange={(e) => setTab5Family(p => ({ ...p, address: e.target.value }))}
                                placeholder="Ej: 45 Calle Y, Bayamón"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              />
                            </div>
                            <div className="md:col-span-2 flex items-center gap-3 p-4 rounded-xl bg-teal-50 border border-teal-200">
                              <input
                                type="checkbox"
                                id="fam-isprimary"
                                checked={tab5Family.isPrimary}
                                onChange={(e) => setTab5Family(p => ({ ...p, isPrimary: e.target.checked }))}
                                className="w-5 h-5 accent-teal-600"
                              />
                              <label htmlFor="fam-isprimary" className="font-bold text-teal-900 text-sm cursor-pointer">
                                Marcar como encargado primario (único por residente — aparecerá en contratos legales)
                              </label>
                            </div>
                          </div>
                          <button
                            onClick={saveTab5Family}
                            disabled={tab5Saving || !tab5Family.name || !tab5Family.email}
                            className="mt-5 px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-black rounded-xl text-sm transition-colors flex items-center gap-2"
                          >
                            {tab5Saving ? (<><Save className="w-4 h-4 animate-spin" /> Guardando...</>) : (<><CheckCircle className="w-4 h-4" /> {tab5Family.id ? "Actualizar familiar" : "Guardar familiar"}</>)}
                          </button>
                        </section>

                        {tab5Error && (
                          <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 text-sm font-bold text-rose-700">
                            {tab5Error}
                          </div>
                        )}
                      </div>
                      )}
                   </div>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB 6 — Análisis Zendi de documentos (Sprint P) */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {activeTab === 6 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                    <div className="mb-10">
                      <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                        <Upload className="w-10 h-10 text-teal-600" /> Análisis Zendi de Documentos
                      </h2>
                      <p className="text-slate-500 font-bold text-lg mt-3">
                        Sube un ID, tarjeta de seguro, receta médica o historial hospitalario. Zendi extrae los datos y te deja aplicarlos al perfil con un click. <span className="text-teal-700">El archivo original NO se guarda</span> — solo el análisis estructurado.
                      </p>
                    </div>

                    {!formData.patientId && (
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-sm font-bold text-amber-800">
                        <AlertCircle className="w-5 h-5 inline mr-2" />
                        Completa la Identidad Base primero para habilitar este bloque.
                      </div>
                    )}

                    {formData.patientId && (
                      <div className="space-y-8">
                        {/* Formulario de subida */}
                        <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                          <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-teal-600" /> Subir documento
                          </h3>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Categoría</label>
                              <select
                                value={docCategory}
                                onChange={(e) => setDocCategory(e.target.value)}
                                disabled={analyzing}
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400"
                              >
                                <option value="ID_CARD">ID / Licencia</option>
                                <option value="INSURANCE_CARD">Tarjeta de seguro</option>
                                <option value="MEDICARE_CARD">Tarjeta Medicare</option>
                                <option value="MEDICAL_RECORD">Expediente médico</option>
                                <option value="HOSPITAL_DISCHARGE">Alta hospitalaria</option>
                                <option value="LAB_RESULT">Resultado laboratorio</option>
                                <option value="PRESCRIPTION">Receta médica</option>
                                <option value="POWER_OF_ATTORNEY">Poder legal / Tutor</option>
                                <option value="SOCIAL_WORK_NOTE">Nota trabajo social</option>
                                <option value="OTHER">Otro</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Título del documento</label>
                              <input
                                type="text"
                                value={docTitle}
                                onChange={(e) => setDocTitle(e.target.value)}
                                placeholder="Ej: Receta Dr. Rivera 2026-04-15"
                                disabled={analyzing}
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-teal-400 disabled:opacity-50"
                              />
                            </div>
                          </div>

                          <label className={`block border-2 border-dashed rounded-2xl p-10 text-center transition-all ${analyzing ? 'border-amber-300 bg-amber-50 cursor-wait' : 'border-teal-300 bg-teal-50 hover:bg-teal-100 cursor-pointer'}`}>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleDocumentUpload(f);
                                e.target.value = "";
                              }}
                              className="hidden"
                              disabled={analyzing}
                            />
                            {analyzing ? (
                              <>
                                <Save className="w-10 h-10 text-amber-600 animate-spin mx-auto mb-3" />
                                <p className="font-black text-amber-800 text-lg">Zendi está analizando...</p>
                                <p className="text-sm text-amber-700 font-medium mt-1">Extrayendo campos del documento con GPT-4o Vision</p>
                              </>
                            ) : (
                              <>
                                <Upload className="w-10 h-10 text-teal-600 mx-auto mb-3" />
                                <p className="font-black text-teal-800 text-lg">Toca para subir imagen</p>
                                <p className="text-sm text-teal-700 font-medium mt-1">JPEG, PNG o WEBP. Los PDFs no se soportan — convierte a imagen primero.</p>
                              </>
                            )}
                          </label>

                          {docError && (
                            <div className="mt-4 bg-rose-50 border-2 border-rose-200 rounded-xl p-4 text-sm font-bold text-rose-700">
                              <AlertCircle className="w-4 h-4 inline mr-2" />
                              {docError}
                            </div>
                          )}
                        </section>

                        {/* Resultado del último análisis */}
                        {analyzeResult && (
                          <section className="bg-white p-6 md:p-8 rounded-[2rem] border-2 border-teal-300 shadow-md">
                            <div className="flex items-center justify-between mb-5">
                              <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-teal-600" /> Análisis completado
                              </h3>
                              {analyzeResult.suggestions?.confidence != null && (
                                <span className="text-[10px] font-black uppercase tracking-widest bg-teal-100 text-teal-800 px-3 py-1.5 rounded-full border border-teal-200">
                                  Confianza {Math.round((analyzeResult.suggestions.confidence || 0) * 100)}%
                                </span>
                              )}
                            </div>
                            {analyzeResult.summary && (
                              <p className="text-sm text-slate-700 font-medium bg-slate-50 rounded-xl p-4 mb-5 leading-relaxed border border-slate-200">
                                {analyzeResult.summary}
                              </p>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 text-xs">
                              {Object.entries(analyzeResult.suggestions?.patient || {}).filter(([, v]) => v).map(([k, v]) => (
                                <div key={k} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                  <div className="font-black text-slate-500 uppercase tracking-widest text-[9px] mb-1">{k}</div>
                                  <div className="font-bold text-slate-800 text-sm">{String(v)}</div>
                                </div>
                              ))}
                              {(analyzeResult.suggestions?.medications || []).length > 0 && (
                                <div className="md:col-span-2 bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                                  <div className="font-black text-indigo-700 uppercase tracking-widest text-[9px] mb-2">Medicamentos extraídos</div>
                                  <ul className="space-y-1 text-sm font-bold text-indigo-900">
                                    {analyzeResult.suggestions.medications.map((m: any, i: number) => (
                                      <li key={i}>
                                        {m.name} {m.dose ? `· ${m.dose}` : ""} {m.scheduleTimes?.length > 0 ? `· ${m.scheduleTimes.join(", ")}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(analyzeResult.suggestions?.clinical?.diagnoses || []).length > 0 && (
                                <div className="md:col-span-2 bg-amber-50 rounded-lg p-3 border border-amber-200">
                                  <div className="font-black text-amber-700 uppercase tracking-widest text-[9px] mb-1">Diagnósticos</div>
                                  <div className="text-sm font-bold text-amber-900">{analyzeResult.suggestions.clinical.diagnoses.join(", ")}</div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={applySuggestionsToPatient}
                                className="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" /> Aplicar al perfil
                              </button>
                              <button
                                onClick={() => setAnalyzeResult(null)}
                                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                              >
                                Descartar
                              </button>
                            </div>
                          </section>
                        )}

                        {/* Historial */}
                        <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                          <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-teal-600" /> Historial de análisis ({documents.length})
                          </h3>
                          {documents.length === 0 ? (
                            <p className="text-sm text-slate-500 font-medium">Aún no se han analizado documentos para este residente.</p>
                          ) : (
                            <div className="divide-y divide-slate-100">
                              {documents.map((d) => (
                                <div key={d.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-black text-slate-800 truncate">{d.title}</p>
                                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                      {d.category} · {new Date(d.uploadedAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })} · por {d.uploadedBy?.name || '—'}
                                    </p>
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
                                    Analizado
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>
                    )}
                  </div>
                )}

            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

/* Card reutilizable para uploads de imágenes */
function UploadCard({ label, hint, value, onUpload, onClear, color }: {
  label: string;
  hint?: string;
  value: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  color: "teal" | "indigo" | "amber" | "slate";
}) {
  const colorMap = {
    teal: { border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700" },
    indigo: { border: "border-indigo-200", bg: "bg-indigo-50", text: "text-indigo-700" },
    amber: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700" },
    slate: { border: "border-slate-200", bg: "bg-slate-50", text: "text-slate-700" },
  }[color];

  return (
    <div className={`rounded-2xl border-2 border-dashed ${colorMap.border} p-4 ${colorMap.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-black uppercase tracking-wider ${colorMap.text}`}>{label}</span>
        {hint && <span className="text-[9px] text-slate-500 font-bold">{hint}</span>}
      </div>
      {value ? (
        <div className="relative">
          <img src={value} alt={label} className="w-full h-24 object-cover rounded-lg border border-white shadow-sm" />
          <button
            onClick={onClear}
            className="absolute top-1 right-1 bg-white rounded-full p-1 shadow hover:bg-rose-50"
            type="button"
          >
            <XIcon className="w-3 h-3 text-rose-500" />
          </button>
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center h-24 cursor-pointer rounded-lg bg-white/50 hover:bg-white transition-colors ${colorMap.text}`}>
          <Upload className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold">Subir imagen</span>
          <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
        </label>
      )}
    </div>
  );
}
