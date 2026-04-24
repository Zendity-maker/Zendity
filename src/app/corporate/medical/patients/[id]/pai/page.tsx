"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeftIcon, PlusIcon, TrashIcon, PrinterIcon, SparklesIcon } from "@heroicons/react/24/outline";
import ZendiEnhanceTextarea from "@/components/medical/pai/ZendiEnhanceTextarea";

export default function PAICreatorPage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const { user } = useAuth();
    const router = useRouter();

    const [patientInfo, setPatientInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

    // --- FORM STATES ---
    const [paiId, setPaiId] = useState<string | null>(null);
    const [status, setStatus] = useState("DRAFT");
    const [paiType, setPaiType] = useState("INITIAL");
    const [familyVersion, setFamilyVersion] = useState("");
    const [showFamilyPreview, setShowFamilyPreview] = useState(false);
    const [supportSource, setSupportSource] = useState("");
    const [clinicalSummary, setClinicalSummary] = useState("");
    const [continence, setContinence] = useState("");
    const [cognitiveLevel, setCognitiveLevel] = useState("");
    const [mobility, setMobility] = useState("");
    const [dietDetails, setDietDetails] = useState("");
    const [interdisciplinarySummary, setInterdisciplinarySummary] = useState("");
    
    // Arrays para Data JSON
    const [risks, setRisks] = useState<{ area: string; finding: string; priority: string }[]>([]);
    const [goals, setGoals] = useState<{ objective: string; action: string; responsible: string; frequency: string; indicator: string }[]>([]);
    const [recommendedServices, setRecommendedServices] = useState<{ serviceName: string; description: string; price: string; category: string }[]>([]);

    const [familyEducation, setFamilyEducation] = useState("");
    const [preferences, setPreferences] = useState("");
    const [monitoringMethod, setMonitoringMethod] = useState("");
    const [revisionCriteria, setRevisionCriteria] = useState("");
    const [startDate, setStartDate] = useState("");
    const [nextReview, setNextReview] = useState("");

    // Firma
    const [signedById, setSignedById] = useState<string | null>(null);

    useEffect(() => {
        fetchPAI();
    }, [params.id]);

    const fetchPAI = async () => {
        try {
            // Obtener info base del residente
            const patRes = await fetch(`/api/corporate/patients/${params.id}`);
            const patData = await patRes.json();
            if (patData.success) {
                setPatientInfo(patData.patient);
                setDietDetails(patData.patient.diet || "");
            }

            // Obtener PAI
            const res = await fetch(`/api/corporate/patients/${params.id}/pai`);
            const data = await res.json();
            if (data.success && data.lifePlan) {
                const p = data.lifePlan;
                setPaiId(p.id);
                setStatus(p.status || "DRAFT");
                setPaiType(p.type || "INITIAL");
                setFamilyVersion(p.familyVersion || "");
                setSupportSource(p.supportSource || "");
                setClinicalSummary(p.clinicalSummary || "");
                setContinence(p.continence || "");
                setCognitiveLevel(p.cognitiveLevel || "");
                setMobility(p.mobility || "");
                if (p.dietDetails) setDietDetails(p.dietDetails);
                setInterdisciplinarySummary(p.interdisciplinarySummary || "");
                
                setRisks(p.risks && Array.isArray(p.risks) ? p.risks : []);
                setGoals(p.goals && Array.isArray(p.goals) ? p.goals : []);
                setRecommendedServices(p.recommendedServices && Array.isArray(p.recommendedServices) ? p.recommendedServices : []);
                
                setFamilyEducation(p.familyEducation || "");
                setPreferences(p.preferences || "");
                setMonitoringMethod(p.monitoringMethod || "");
                setRevisionCriteria(p.revisionCriteria || "");

                if (p.startDate) setStartDate(new Date(p.startDate).toISOString().split('T')[0]);
                if (p.nextReview) setNextReview(new Date(p.nextReview).toISOString().split('T')[0]);
                setSignedById(p.signedById);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (isSigning = false) => {
        if (isSigning && !familyVersion.trim()) {
            setShowFamilyPreview(true);
            showToast("⚠️ Genera o escribe la versión familiar antes de aprobar.");
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                id: paiId || undefined,
                type: paiType,
                status: isSigning ? "APPROVED" : status,
                familyVersion: familyVersion || null,
                supportSource, clinicalSummary, continence, cognitiveLevel, mobility, dietDetails,
                risks, interdisciplinarySummary, goals, familyEducation, preferences, monitoringMethod, revisionCriteria,
                recommendedServices,
                startDate: startDate || new Date().toISOString(),
                nextReview: nextReview || null,
                signedById: isSigning ? user?.id : signedById
            };

            const res = await fetch(`/api/corporate/patients/${params.id}/pai`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                if (!paiId && data.lifePlan?.id) setPaiId(data.lifePlan.id);
                setStatus(data.lifePlan?.status || status);
                showToast(isSigning
                    ? data.emailSent ? "✅ PAI aprobado y recibo enviado a la familia." : "✅ PAI firmado y aprobado."
                    : "✓ Borrador guardado.");
                if (isSigning) setTimeout(() => router.push(`/corporate/medical/patients/${params.id}`), 1800);
            } else {
                showToast("Error: " + data.error);
            }
        } catch (e) {
            console.error(e);
            showToast("Error de conexión.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleZendiAutoGen = async () => {
        if (!confirm("Esto utilizará IA para reescribir y estructurar el PAI en blanco utilizando el Historial Clínico de Ingreso del Residente. ¿Deseas continuar?")) return;
        setIsGeneratingAI(true);
        try {
            const res = await fetch(`/api/corporate/patients/${params.id}/pai/ai-build`, { method: "POST" });
            const data = await res.json();
            if (data.success && data.aiGeneratedPai) {
                const ai = data.aiGeneratedPai;
                if (ai.clinicalSummary) setClinicalSummary(ai.clinicalSummary);
                if (ai.cognitiveLevel) setCognitiveLevel(ai.cognitiveLevel);
                if (ai.mobility) setMobility(ai.mobility);
                if (ai.continence) setContinence(ai.continence);
                if (ai.dietDetails) setDietDetails(ai.dietDetails);
                if (ai.interdisciplinarySummary) setInterdisciplinarySummary(ai.interdisciplinarySummary);
                if (ai.familyEducation) setFamilyEducation(ai.familyEducation);
                if (ai.revisionCriteria) setRevisionCriteria(ai.revisionCriteria);
                if (ai.risks?.length) setRisks(ai.risks);
                if (ai.goals?.length) setGoals(ai.goals);
                if (data.familyVersion) setFamilyVersion(data.familyVersion);
                showToast("✅ Zendi completó el PAI con datos clínicos reales. Revisa y ajusta antes de firmar.");
            } else {
                showToast("Zendi AI no pudo procesar el historial: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión con Zendi AI.");
        } finally {
            setIsGeneratingAI(false);
        }
    };

    if (isLoading) return <div className="p-10 font-bold text-center animate-pulse">Cargando Plataforma PAI...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans pb-32">

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm animate-in slide-in-from-bottom-4">
                    {toast}
                </div>
            )}

            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header Nav */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <Link href={`/corporate/medical/patients/${params.id}`} className="text-slate-500 font-bold flex items-center gap-2 hover:text-slate-800 transition">
                        <ArrowLeftIcon className="w-4 h-4" /> Volver al Expediente
                    </Link>
                    <div className="flex items-center gap-3">
                        <Link href={`/corporate/medical/patients/${params.id}/pai/print`} target="_blank" className="bg-white border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition flex items-center gap-2">
                            <PrinterIcon className="w-5 h-5" /> Imprimir PAI
                        </Link>
                        <button onClick={() => handleSave(false)} disabled={isSaving} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold px-4 py-2.5 rounded-xl transition">
                            {isSaving ? "Guardando..." : "Guardar Borrador"}
                        </button>
                        <button onClick={() => handleSave(true)} disabled={isSaving || status === 'APPROVED'} className={`font-bold px-6 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 ${status === 'APPROVED' ? 'bg-emerald-500 text-white cursor-not-allowed opacity-80' : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'}`}>
                            {status === 'APPROVED' ? " PAI Vigente (Firmado)" : "Firmar Clínicamente"}
                        </button>
                    </div>
                </div>

                {/* Patient Header */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">Plan Asistencial Individualizado (PAI)</h1>
                        <p className="text-slate-500 font-bold mt-1 text-lg">Residente: <span className="text-indigo-600">{patientInfo?.name}</span></p>
                    </div>
                    <div className="flex gap-3 items-center">
                        {status === 'DRAFT' && risks.length === 0 && (
                            <button onClick={handleZendiAutoGen} disabled={isGeneratingAI} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-black px-4 py-2 rounded-xl shadow-sm text-sm flex items-center gap-2 transition-all">
                                {isGeneratingAI ? "Analizando Historial..." : <><SparklesIcon className="w-5 h-5 text-amber-500"/> Zendi AI: Auto-Completar PAI</>}
                            </button>
                        )}
                        {status === 'APPROVED' && <div className="hidden md:block bg-emerald-100 text-emerald-800 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-sm border border-emerald-200 shadow-sm">PAI ACTIVO </div>}
                    </div>
                </div>

                {/* Tipo de PAI + Versión Familiar */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-1/3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Tipo de PAI</label>
                        <select value={paiType} onChange={e => setPaiType(e.target.value)}
                            disabled={status === 'APPROVED'}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 px-4 font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60">
                            <option value="INITIAL">Inicial</option>
                            <option value="QUARTERLY">Trimestral</option>
                            <option value="REVISION">Revisión</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                ✉️ Versión Familiar (Zendi la genera al auto-completar)
                            </label>
                            <button onClick={() => setShowFamilyPreview(!showFamilyPreview)}
                                className="text-xs text-indigo-600 font-bold hover:underline">
                                {showFamilyPreview ? 'Ocultar' : 'Ver / Editar'}
                            </button>
                        </div>
                        {!familyVersion && !showFamilyPreview && (
                            <p className="text-sm text-slate-400 italic">Se generará automáticamente al usar Zendi AI.</p>
                        )}
                        {!familyVersion && showFamilyPreview && (
                            <textarea value={familyVersion} onChange={e => setFamilyVersion(e.target.value)} rows={4}
                                placeholder="Escribe aquí la versión familiar si prefieres no usar Zendi AI..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 resize-none focus:ring-2 focus:ring-indigo-400 outline-none" />
                        )}
                        {familyVersion && showFamilyPreview && (
                            <textarea value={familyVersion} onChange={e => setFamilyVersion(e.target.value)} rows={5}
                                className="w-full bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm font-medium text-slate-800 resize-none focus:ring-2 focus:ring-indigo-400 outline-none" />
                        )}
                        {familyVersion && !showFamilyPreview && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-sm text-emerald-700 font-medium">
                                ✅ Versión familiar lista — {familyVersion.slice(0, 60)}...
                            </div>
                        )}
                    </div>
                </div>

                {/* Categoria 1: Perfil y Categoria 2: Clinica */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-black text-slate-800 mb-4 border-b pb-2">1. Identificación y Perfil</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fuentes de Apoyo Principal (Familiares)</label>
                                <input type="text" value={supportSource} onChange={e => setSupportSource(e.target.value)} className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all" placeholder="Ej: Hija y sobrino" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fecha Inicio</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Revisión Smt.</label>
                                    <input type="date" value={nextReview} onChange={e => setNextReview(e.target.value)} className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all" />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-black text-slate-800 mb-4 border-b pb-2">2. Resumen Clínico Funcional</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nivel Cognitivo</label>
                                    <input type="text" value={cognitiveLevel} onChange={e => setCognitiveLevel(e.target.value)} className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all" placeholder="Ej: Desorientación parcial" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Movilidad</label>
                                    <input type="text" value={mobility} onChange={e => setMobility(e.target.value)} className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all" placeholder="Ej: Deambula con andador" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Continencia</label>
                                    <input type="text" value={continence} onChange={e => setContinence(e.target.value)} className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all" placeholder="Ej: Incontinencia ocasional" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dieta</label>
                                    <input type="text" value={dietDetails} onChange={e => setDietDetails(e.target.value)} className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Diagnósticos y Resumen</label>
                                <ZendiEnhanceTextarea
                                    value={clinicalSummary}
                                    onChange={setClinicalSummary}
                                    fieldLabel="Resumen Clínico"
                                    patientName={patientInfo?.name || ""}
                                    placeholder="Demencia vascular moderada, HTA..."
                                    className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 pb-10 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all h-24 resize-none focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Riesgos Matrix */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center border-b pb-2 mb-4">
                        <h2 className="text-lg font-black text-slate-800">3. Riesgos y Prioridades de Atención</h2>
                        <button onClick={() => setRisks([...risks, { area: '', finding: '', priority: 'Media' }])} className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold"><PlusIcon className="w-4 h-4"/> Añadir Fila</button>
                    </div>
                    {risks.length === 0 && <p className="text-center text-slate-500 py-4 font-bold border-2 border-dashed rounded-xl">No hay riesgos añadidos a la matriz.</p>}
                    <div className="space-y-3">
                        {risks.map((r, i) => (
                            <div key={i} className="flex flex-col md:flex-row gap-3 items-center bg-slate-50 p-2 border border-slate-200 rounded-xl relative">
                                <input className="w-full md:w-1/4 bg-white p-2 rounded-lg border font-bold text-sm text-slate-900 placeholder:text-slate-500" placeholder="Área (Ej. Seguridad)" value={r.area} onChange={e => { const copy = [...risks]; copy[i].area = e.target.value; setRisks(copy); }} />
                                <input className="w-full md:flex-1 bg-white p-2 rounded-lg border font-medium text-sm text-slate-900 placeholder:text-slate-500" placeholder="Hallazgo / Necesidad" value={r.finding} onChange={e => { const copy = [...risks]; copy[i].finding = e.target.value; setRisks(copy); }} />
                                <select className="w-full md:w-32 bg-white p-2 text-sm rounded-lg border font-bold" value={r.priority} onChange={e => { const copy = [...risks]; copy[i].priority = e.target.value; setRisks(copy); }}>
                                    <option>Alta</option><option>Media</option><option>Baja</option>
                                </select>
                                <button onClick={() => setRisks(risks.filter((_, index) => index !== i))} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Resumen Interdisciplinario Global</label>
                        <ZendiEnhanceTextarea
                            value={interdisciplinarySummary}
                            onChange={setInterdisciplinarySummary}
                            fieldLabel="Resumen Interdisciplinario Global"
                            patientName={patientInfo?.name || ""}
                            placeholder="El residente conserva capacidad parcial para..."
                            className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 pb-10 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all h-24 resize-none focus:outline-none"
                        />
                    </div>
                </div>

                {/* Goals Matrix */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center border-b pb-2 mb-4">
                        <h2 className="text-lg font-black text-slate-800">4. Objetivos del PAI e Intervención</h2>
                        <button onClick={() => setGoals([...goals, { objective: '', action: '', responsible: '', frequency: '', indicator: '' }])} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold"><PlusIcon className="w-4 h-4"/> Añadir Objetivo</button>
                    </div>
                    {goals.length === 0 && <p className="text-center text-slate-500 py-4 font-bold border-2 border-dashed rounded-xl">No hay metas registradas.</p>}
                    <div className="space-y-3">
                        {goals.map((g, i) => (
                            <div key={i} className="flex flex-col gap-2 bg-indigo-50/50 p-4 border border-indigo-100 rounded-xl relative">
                                <div className="absolute top-4 right-4 text-indigo-200 font-black text-2xl opacity-50">#{i + 1}</div>
                                <input className="w-full md:w-3/4 bg-white p-2.5 rounded-lg border font-black text-indigo-900 border-indigo-200" placeholder="Objetivo (Ej. Prevenir Caídas)" value={g.objective} onChange={e => { const copy = [...goals]; copy[i].objective = e.target.value; setGoals(copy); }} />
                                <ZendiEnhanceTextarea
                                    value={g.action}
                                    onChange={(newVal) => { const copy = [...goals]; copy[i].action = newVal; setGoals(copy); }}
                                    fieldLabel={`Intervención del objetivo: ${g.objective || 'PAI'}`}
                                    patientName={patientInfo?.name || ""}
                                    placeholder="Acción / Intervención Concreta"
                                    className="w-full bg-white p-2.5 pb-10 rounded-lg border font-medium text-sm text-slate-900 placeholder:text-slate-500 h-20 resize-none focus:border-indigo-400 focus:outline-none"
                                />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase">Responsable</label><input className="w-full bg-white p-2 rounded-lg border text-sm font-bold text-slate-900 placeholder:text-slate-500" value={g.responsible} onChange={e => { const copy = [...goals]; copy[i].responsible = e.target.value; setGoals(copy); }} /></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase">Frecuencia</label><input className="w-full bg-white p-2 rounded-lg border text-sm font-medium text-slate-900 placeholder:text-slate-500" value={g.frequency} onChange={e => { const copy = [...goals]; copy[i].frequency = e.target.value; setGoals(copy); }} /></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase">Indicador</label><input className="w-full bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200 text-sm font-bold" value={g.indicator} onChange={e => { const copy = [...goals]; copy[i].indicator = e.target.value; setGoals(copy); }} /></div>
                                </div>
                                <button onClick={() => setGoals(goals.filter((_, index) => index !== i))} className="absolute top-4 right-12 p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recomendaciones (Marketplace) */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-3xl shadow-sm border border-orange-200">
                    <div className="flex justify-between items-center border-b border-orange-200 pb-2 mb-4">
                        <h2 className="text-lg font-black text-orange-900 flex items-center gap-2"><SparklesIcon className="w-6 h-6 text-orange-500"/> Recomendaciones Adicionales (Marketplace)</h2>
                        <button onClick={() => setRecommendedServices([...recommendedServices, { serviceName: '', description: '', price: 'A Convenir', category: 'General' }])} className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold"><PlusIcon className="w-4 h-4"/> Ofertar Servicio</button>
                    </div>
                    {recommendedServices.length === 0 && <p className="text-center text-orange-600/50 py-4 font-bold border-2 border-dashed border-orange-200 rounded-xl">Registra servicios adicionales como Terapia, Spa, Acompañante Extra, etc.</p>}
                    <div className="space-y-3">
                        {recommendedServices.map((rs, i) => (
                            <div key={i} className="flex flex-col gap-2 bg-white p-4 border border-orange-200 rounded-xl relative shadow-sm">
                                <input className="w-full md:w-3/4 bg-orange-50 p-2.5 rounded-lg border-2 font-black text-orange-900 border-orange-200 outline-none focus:border-orange-400" placeholder="Nombre del Servicio (Ej. Terapia Física 3x/sem)" value={rs.serviceName} onChange={e => { const copy = [...recommendedServices]; copy[i].serviceName = e.target.value; setRecommendedServices(copy); }} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="md:col-span-2"><label className="text-[10px] font-bold text-orange-700 uppercase">Descripción de los Beneficios</label><input className="w-full bg-slate-50 p-2 rounded-lg border text-sm font-medium text-slate-900 placeholder:text-slate-500" value={rs.description} onChange={e => { const copy = [...recommendedServices]; copy[i].description = e.target.value; setRecommendedServices(copy); }} /></div>
                                    <div><label className="text-[10px] font-bold text-orange-700 uppercase">Cotización Aproximada</label><input className="w-full bg-white p-2 rounded-lg border text-sm font-black text-green-700" value={rs.price} onChange={e => { const copy = [...recommendedServices]; copy[i].price = e.target.value; setRecommendedServices(copy); }} /></div>
                                </div>
                                <button onClick={() => setRecommendedServices(recommendedServices.filter((_, index) => index !== i))} className="absolute top-4 right-4 p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Seguimiento final */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-black text-slate-800 mb-4 border-b pb-2">5. Seguimiento, Educación y Preferencias</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Educación al Cuidador / Familia</label>
                            <ZendiEnhanceTextarea
                                value={familyEducation}
                                onChange={setFamilyEducation}
                                fieldLabel="Educación Familiar"
                                patientName={patientInfo?.name || ""}
                                placeholder="Se orienta sobre prevención de caídas..."
                                className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 pb-10 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all h-28 resize-none focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Preferencias del Residente</label>
                            <ZendiEnhanceTextarea
                                value={preferences}
                                onChange={setPreferences}
                                fieldLabel="Preferencias del Residente"
                                patientName={patientInfo?.name || ""}
                                placeholder="Música suave, rutinas consistentes..."
                                className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 pb-10 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all h-28 resize-none focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Método de Monitoreo</label>
                            <ZendiEnhanceTextarea
                                value={monitoringMethod}
                                onChange={setMonitoringMethod}
                                fieldLabel="Método de Monitoreo"
                                patientName={patientInfo?.name || ""}
                                placeholder="Notas de enfermería, reportes zendity..."
                                className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 pb-10 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all h-24 resize-none focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Criterios de Revisión Temprana</label>
                            <ZendiEnhanceTextarea
                                value={revisionCriteria}
                                onChange={setRevisionCriteria}
                                fieldLabel="Criterios de Revisión"
                                patientName={patientInfo?.name || ""}
                                placeholder="Hospitalización, deterioro funcional..."
                                className="w-full mt-1 bg-slate-50 border border-slate-200 p-3 pb-10 rounded-xl font-medium text-slate-900 placeholder:text-slate-500 placeholder:font-normal focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all h-24 resize-none focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
