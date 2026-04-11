"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    Loader2, Plus, Trash2, CheckCircle2, Clock, AlertTriangle,
    Sparkles, FileText, Users, Heart, Stethoscope, X, ChevronDown
} from "lucide-react";

// ── Types ──────────────────────────────────────────────

type Note = { id: string; content: string; category: string; createdAt: string; createdBy: { id: string; name: string; role: string } };
type Task = { id: string; title: string; description: string | null; category: string; status: string; priority: string; dueDate: string | null; completedAt: string | null; isZendiSuggested: boolean; createdAt: string; createdBy: { id: string; name: string }; assignedTo: { id: string; name: string } | null };
type Benefit = { id: string; type: string; status: string; details: string | null; expirationDate: string | null; createdAt: string };
type Visit = { id: string; specialistType: string; specialistName: string | null; visitDate: string; nextVisitDate: string | null; notes: string | null; createdBy: { id: string; name: string } };
type ZendiSuggestion = { type: string; priority: string; title: string; description: string; category: string };

// ── Constants ──────────────────────────────────────────

const NOTE_CATEGORIES = [
    { id: "GENERAL", label: "General", color: "bg-slate-100 text-slate-700" },
    { id: "FAMILY", label: "Familiar", color: "bg-violet-100 text-violet-700" },
    { id: "BENEFITS", label: "Beneficios", color: "bg-emerald-100 text-emerald-700" },
    { id: "LEGAL", label: "Legal", color: "bg-amber-100 text-amber-700" },
    { id: "INCIDENT", label: "Incidente", color: "bg-rose-100 text-rose-700" },
];

const TASK_CATEGORIES = [
    { id: "FOLLOW_UP", label: "Seguimiento" }, { id: "DOCUMENT", label: "Documento" },
    { id: "FAMILY", label: "Familia" }, { id: "APPOINTMENT", label: "Cita" }, { id: "BENEFIT", label: "Beneficio" },
];

const PRIORITY_STYLES: Record<string, string> = {
    LOW: "bg-slate-100 text-slate-600", NORMAL: "bg-blue-100 text-blue-700",
    HIGH: "bg-amber-100 text-amber-700", URGENT: "bg-rose-100 text-rose-700",
};
const PRIORITY_LABELS: Record<string, string> = { LOW: "Baja", NORMAL: "Normal", HIGH: "Alta", URGENT: "Urgente" };

const BENEFIT_ICONS: Record<string, string> = { MEDICARE: "💊", MEDICAID: "🏥", SNAP: "🍎", PENSION: "💰", OTHER: "📋" };
const BENEFIT_STATUS_STYLES: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700", EXPIRED: "bg-rose-100 text-rose-700",
    PENDING: "bg-amber-100 text-amber-700", UNKNOWN: "bg-slate-100 text-slate-600",
};

const SPECIALIST_ICONS: Record<string, string> = {
    DOCTOR: "👨‍⚕️", PODIATRIST: "🦶", PSYCHOLOGIST: "🧠", DENTIST: "🦷", PSYCHIATRIST: "💭", OTHER: "🩺",
};

const SPECIALIST_TYPES = [
    { id: "DOCTOR", label: "Doctor" }, { id: "PODIATRIST", label: "Podologa" },
    { id: "PSYCHOLOGIST", label: "Psicologa" }, { id: "DENTIST", label: "Dentista" },
    { id: "PSYCHIATRIST", label: "Psiquiatra" }, { id: "OTHER", label: "Otro" },
];

// ── Component ──────────────────────────────────────────

export default function PatientSocialWorkTab({ patientId }: { patientId: string }) {
    const { user } = useAuth();

    // Data
    const [notes, setNotes] = useState<Note[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [benefits, setBenefits] = useState<Benefit[]>([]);
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);

    // Sub-tabs
    const [subTab, setSubTab] = useState<"notes" | "tasks" | "benefits" | "specialists">("notes");

    // Forms
    const [showNoteForm, setShowNoteForm] = useState(false);
    const [noteContent, setNoteContent] = useState("");
    const [noteCategory, setNoteCategory] = useState("GENERAL");
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDesc, setTaskDesc] = useState("");
    const [taskCat, setTaskCat] = useState("FOLLOW_UP");
    const [taskPriority, setTaskPriority] = useState("NORMAL");
    const [taskDue, setTaskDue] = useState("");
    const [showBenefitForm, setShowBenefitForm] = useState(false);
    const [benType, setBenType] = useState("MEDICARE");
    const [benStatus, setBenStatus] = useState("ACTIVE");
    const [benDetails, setBenDetails] = useState("");
    const [benExpiry, setBenExpiry] = useState("");
    const [showVisitForm, setShowVisitForm] = useState(false);
    const [visitType, setVisitType] = useState("DOCTOR");
    const [visitName, setVisitName] = useState("");
    const [visitDate, setVisitDate] = useState("");
    const [visitNext, setVisitNext] = useState("");
    const [visitNotes, setVisitNotes] = useState("");

    const [submitting, setSubmitting] = useState(false);

    // Zendi
    const [zendiLoading, setZendiLoading] = useState(false);
    const [zendiSummary, setZendiSummary] = useState<string | null>(null);
    const [zendiSuggestions, setZendiSuggestions] = useState<ZendiSuggestion[]>([]);
    const [creatingTaskIdx, setCreatingTaskIdx] = useState<number | null>(null);

    // ── Fetch ──────────────────────────────────────────

    useEffect(() => { fetchAll(); }, [patientId]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/social/${patientId}`);
            const data = await res.json();
            if (data.success) {
                setNotes(data.notes);
                setTasks(data.tasks);
                setBenefits(data.benefits);
                setVisits(data.specialistVisits);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    // ── Actions ────────────────────────────────────────

    const createNote = async () => {
        if (!noteContent.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/social/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, content: noteContent, category: noteCategory }) });
            const data = await res.json();
            if (data.success) { setNotes(prev => [data.note, ...prev]); setNoteContent(""); setShowNoteForm(false); }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const deleteNote = async (noteId: string) => {
        if (!confirm("Eliminar esta nota?")) return;
        try {
            const res = await fetch("/api/social/notes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId }) });
            if ((await res.json()).success) setNotes(prev => prev.filter(n => n.id !== noteId));
        } catch (e) { console.error(e); }
    };

    const createTask = async (title?: string, description?: string, category?: string, priority?: string, isZendi?: boolean) => {
        const t = title || taskTitle;
        if (!t.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/social/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, title: t, description: description || taskDesc || null, category: category || taskCat, priority: priority || taskPriority, dueDate: taskDue || null, isZendiSuggested: isZendi || false }) });
            const data = await res.json();
            if (data.success) { setTasks(prev => [data.task, ...prev]); setTaskTitle(""); setTaskDesc(""); setShowTaskForm(false); }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const completeTask = async (taskId: string) => {
        try {
            const res = await fetch("/api/social/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, status: "COMPLETED" }) });
            const data = await res.json();
            if (data.success) setTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
        } catch (e) { console.error(e); }
    };

    const createBenefit = async () => {
        if (!benType) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/social/benefits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, type: benType, status: benStatus, details: benDetails || null, expirationDate: benExpiry || null }) });
            const data = await res.json();
            if (data.success) { setBenefits(prev => [...prev, data.benefit]); setBenDetails(""); setBenExpiry(""); setShowBenefitForm(false); }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const createVisit = async () => {
        if (!visitDate) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/social/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, specialistType: visitType, specialistName: visitName || null, visitDate, nextVisitDate: visitNext || null, notes: visitNotes || null }) });
            const data = await res.json();
            if (data.success) { setVisits(prev => [data.visit, ...prev]); setVisitName(""); setVisitDate(""); setVisitNext(""); setVisitNotes(""); setShowVisitForm(false); }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const runZendi = async () => {
        setZendiLoading(true);
        setZendiSummary(null);
        setZendiSuggestions([]);
        try {
            const res = await fetch("/api/social/zendi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId }) });
            const data = await res.json();
            if (data.success) { setZendiSummary(data.summary); setZendiSuggestions(data.suggestions); }
        } catch (e) { console.error(e); } finally { setZendiLoading(false); }
    };

    const createTaskFromZendi = async (suggestion: ZendiSuggestion, idx: number) => {
        setCreatingTaskIdx(idx);
        await createTask(suggestion.title, suggestion.description, suggestion.category, suggestion.priority, true);
        setCreatingTaskIdx(null);
    };

    // ── Helpers ────────────────────────────────────────

    const getCatStyle = (cat: string) => NOTE_CATEGORIES.find(c => c.id === cat)?.color || "bg-slate-100 text-slate-600";
    const getCatLabel = (cat: string) => NOTE_CATEGORIES.find(c => c.id === cat)?.label || cat;
    const isOverdue = (d: string | null) => d && new Date(d) < new Date();
    const daysUntil = (d: string | null) => { if (!d) return null; return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); };

    const pendingTasks = tasks.filter(t => t.status === "PENDING" || t.status === "IN_PROGRESS");
    const completedTasks = tasks.filter(t => t.status === "COMPLETED");

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>;

    // ── Render ─────────────────────────────────────────

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            {/* ── LEFT COLUMN (60%) ── */}
            <div className="flex-1 lg:w-3/5 space-y-4">
                {/* Sub-tabs */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                    {([
                        { key: "notes", label: "Notas", icon: FileText },
                        { key: "tasks", label: "Tareas", icon: CheckCircle2, badge: pendingTasks.length },
                        { key: "benefits", label: "Beneficios", icon: Heart },
                        { key: "specialists", label: "Especialistas", icon: Stethoscope },
                    ] as const).map(t => (
                        <button key={t.key} onClick={() => setSubTab(t.key)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${subTab === t.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                            <t.icon className="w-3.5 h-3.5" /> {t.label}
                            {"badge" in t && t.badge > 0 && <span className="w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{t.badge}</span>}
                        </button>
                    ))}
                </div>

                {/* ── NOTES ── */}
                {subTab === "notes" && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-slate-700 text-sm">Notas de Trabajo Social</h3>
                            <button onClick={() => setShowNoteForm(!showNoteForm)} className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nueva Nota</button>
                        </div>
                        {showNoteForm && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex gap-2 flex-wrap">
                                    {NOTE_CATEGORIES.map(c => (
                                        <button key={c.id} onClick={() => setNoteCategory(c.id)} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${noteCategory === c.id ? c.color + " border-current shadow-sm" : "bg-white text-slate-400 border-slate-200"}`}>{c.label}</button>
                                    ))}
                                </div>
                                <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={4} placeholder="Escribe la nota aqui..." className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm font-medium text-slate-700 focus:outline-none focus:border-teal-400 resize-none" />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowNoteForm(false)} className="text-xs font-bold text-slate-500 px-3 py-1.5">Cancelar</button>
                                    <button onClick={createNote} disabled={submitting || !noteContent.trim()} className="text-xs font-bold bg-teal-600 text-white px-4 py-1.5 rounded-lg disabled:opacity-50">{submitting ? "Guardando..." : "Guardar"}</button>
                                </div>
                            </div>
                        )}
                        {notes.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm py-8">Sin notas registradas</p>
                        ) : notes.map(n => (
                            <div key={n.id} className="bg-white border border-slate-100 rounded-xl p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getCatStyle(n.category)}`}>{getCatLabel(n.category)}</span>
                                    {(n.createdBy.id === user?.id || user?.role === "DIRECTOR") && (
                                        <button onClick={() => deleteNote(n.id)} className="text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                    )}
                                </div>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.content}</p>
                                <p className="text-[10px] text-slate-400 font-medium">{n.createdBy.name} — {new Date(n.createdAt).toLocaleDateString("es-PR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── TASKS ── */}
                {subTab === "tasks" && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-slate-700 text-sm">Tareas y Seguimientos</h3>
                            <button onClick={() => setShowTaskForm(!showTaskForm)} className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nueva Tarea</button>
                        </div>
                        {showTaskForm && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Titulo de la tarea" className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:border-teal-400" />
                                <div className="grid grid-cols-3 gap-2">
                                    <select value={taskCat} onChange={e => setTaskCat(e.target.value)} className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-600">{TASK_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                                    <select value={taskPriority} onChange={e => setTaskPriority(e.target.value)} className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-600">{Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                                    <input type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-600" />
                                </div>
                                <textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} rows={2} placeholder="Descripcion (opcional)" className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-600 focus:outline-none focus:border-teal-400 resize-none" />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowTaskForm(false)} className="text-xs font-bold text-slate-500 px-3 py-1.5">Cancelar</button>
                                    <button onClick={() => createTask()} disabled={submitting || !taskTitle.trim()} className="text-xs font-bold bg-teal-600 text-white px-4 py-1.5 rounded-lg disabled:opacity-50">{submitting ? "Creando..." : "Crear Tarea"}</button>
                                </div>
                            </div>
                        )}

                        {pendingTasks.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pendientes ({pendingTasks.length})</p>
                                {pendingTasks.map(t => (
                                    <div key={t.id} className="bg-white border border-slate-100 rounded-xl p-4 flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${PRIORITY_STYLES[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</span>
                                                {t.isZendiSuggested && <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Sparkles className="w-3 h-3" /> Zendi</span>}
                                                {t.dueDate && isOverdue(t.dueDate) && <span className="text-[10px] font-bold text-rose-600">Vencida</span>}
                                            </div>
                                            <p className="font-bold text-slate-800 text-sm">{t.title}</p>
                                            {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                                            {t.dueDate && <p className={`text-[10px] mt-1 font-bold ${isOverdue(t.dueDate) ? "text-rose-500" : "text-slate-400"}`}>Vence: {new Date(t.dueDate).toLocaleDateString("es-PR", { day: "numeric", month: "short" })}</p>}
                                        </div>
                                        <button onClick={() => completeTask(t.id)} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition-colors shrink-0"><CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Completar</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {completedTasks.length > 0 && (
                            <div className="space-y-2 opacity-70">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completadas ({completedTasks.length})</p>
                                {completedTasks.slice(0, 5).map(t => (
                                    <div key={t.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <p className="text-sm text-slate-500 line-through truncate">{t.title}</p>
                                        </div>
                                        <span className="text-[10px] text-slate-400 shrink-0">{t.completedAt ? new Date(t.completedAt).toLocaleDateString("es-PR", { day: "numeric", month: "short" }) : ""}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {tasks.length === 0 && <p className="text-center text-slate-400 text-sm py-8">Sin tareas registradas</p>}
                    </div>
                )}

                {/* ── BENEFITS ── */}
                {subTab === "benefits" && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-slate-700 text-sm">Beneficios Gubernamentales</h3>
                            <button onClick={() => setShowBenefitForm(!showBenefitForm)} className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
                        </div>
                        {showBenefitForm && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <select value={benType} onChange={e => setBenType(e.target.value)} className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-600">
                                        <option value="MEDICARE">Medicare</option><option value="MEDICAID">Medicaid</option>
                                        <option value="SNAP">SNAP</option><option value="PENSION">Pension</option><option value="OTHER">Otro</option>
                                    </select>
                                    <select value={benStatus} onChange={e => setBenStatus(e.target.value)} className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-600">
                                        <option value="ACTIVE">Activo</option><option value="EXPIRED">Vencido</option>
                                        <option value="PENDING">Pendiente</option><option value="UNKNOWN">Desconocido</option>
                                    </select>
                                </div>
                                <input value={benDetails} onChange={e => setBenDetails(e.target.value)} placeholder="Detalles (opcional)" className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-600 focus:outline-none focus:border-teal-400" />
                                <input type="date" value={benExpiry} onChange={e => setBenExpiry(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-600" />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowBenefitForm(false)} className="text-xs font-bold text-slate-500 px-3 py-1.5">Cancelar</button>
                                    <button onClick={createBenefit} disabled={submitting} className="text-xs font-bold bg-teal-600 text-white px-4 py-1.5 rounded-lg disabled:opacity-50">{submitting ? "Guardando..." : "Agregar"}</button>
                                </div>
                            </div>
                        )}
                        {benefits.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm py-8">Sin beneficios registrados</p>
                        ) : benefits.map(b => {
                            const days = daysUntil(b.expirationDate);
                            const expiringSoon = days !== null && days > 0 && days <= 30;
                            const expired = days !== null && days <= 0;
                            return (
                                <div key={b.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${expired ? "border-rose-200" : expiringSoon ? "border-amber-200" : "border-slate-100"}`}>
                                    <span className="text-2xl">{BENEFIT_ICONS[b.type] || "📋"}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-800 text-sm">{b.type}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${BENEFIT_STATUS_STYLES[b.status]}`}>{b.status === "ACTIVE" ? "Activo" : b.status === "EXPIRED" ? "Vencido" : b.status === "PENDING" ? "Pendiente" : "Desconocido"}</span>
                                        </div>
                                        {b.details && <p className="text-xs text-slate-500">{b.details}</p>}
                                        {b.expirationDate && (
                                            <p className={`text-[10px] font-bold mt-1 ${expired ? "text-rose-600" : expiringSoon ? "text-amber-600" : "text-slate-400"}`}>
                                                {expired ? "Vencido" : expiringSoon ? `Vence en ${days} dias` : `Vence: ${new Date(b.expirationDate).toLocaleDateString("es-PR", { day: "numeric", month: "short", year: "numeric" })}`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── SPECIALISTS ── */}
                {subTab === "specialists" && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-slate-700 text-sm">Visitas de Especialistas</h3>
                            <button onClick={() => setShowVisitForm(!showVisitForm)} className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Registrar Visita</button>
                        </div>
                        {showVisitForm && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <select value={visitType} onChange={e => setVisitType(e.target.value)} className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-600">{SPECIALIST_TYPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                                    <input value={visitName} onChange={e => setVisitName(e.target.value)} placeholder="Nombre del especialista" className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-600 focus:outline-none focus:border-teal-400" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-[10px] font-bold text-slate-400 block mb-1">Fecha Visita</label><input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-600" /></div>
                                    <div><label className="text-[10px] font-bold text-slate-400 block mb-1">Proxima Cita</label><input type="date" value={visitNext} onChange={e => setVisitNext(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-600" /></div>
                                </div>
                                <textarea value={visitNotes} onChange={e => setVisitNotes(e.target.value)} rows={2} placeholder="Notas (opcional)" className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-600 focus:outline-none focus:border-teal-400 resize-none" />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowVisitForm(false)} className="text-xs font-bold text-slate-500 px-3 py-1.5">Cancelar</button>
                                    <button onClick={createVisit} disabled={submitting || !visitDate} className="text-xs font-bold bg-teal-600 text-white px-4 py-1.5 rounded-lg disabled:opacity-50">{submitting ? "Guardando..." : "Registrar"}</button>
                                </div>
                            </div>
                        )}
                        {visits.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm py-8">Sin visitas registradas</p>
                        ) : visits.map(v => {
                            const daysSince = Math.floor((Date.now() - new Date(v.visitDate).getTime()) / 86400000);
                            return (
                                <div key={v.id} className="bg-white border border-slate-100 rounded-xl p-4 flex items-start gap-3">
                                    <span className="text-2xl">{SPECIALIST_ICONS[v.specialistType] || "🩺"}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-800 text-sm">{SPECIALIST_TYPES.find(s => s.id === v.specialistType)?.label || v.specialistType}</span>
                                            {v.specialistName && <span className="text-xs text-slate-500">— {v.specialistName}</span>}
                                        </div>
                                        <p className="text-xs text-slate-500">{new Date(v.visitDate).toLocaleDateString("es-PR", { day: "numeric", month: "long", year: "numeric" })}</p>
                                        {v.nextVisitDate ? (
                                            <p className="text-[10px] font-bold text-emerald-600 mt-1">Proxima cita: {new Date(v.nextVisitDate).toLocaleDateString("es-PR", { day: "numeric", month: "short" })}</p>
                                        ) : daysSince > 90 && (
                                            <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {daysSince} dias sin visita</p>
                                        )}
                                        {v.notes && <p className="text-xs text-slate-400 mt-1">{v.notes}</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── RIGHT COLUMN: ZENDI PANEL (40%) ── */}
            <div className="lg:w-2/5">
                <div className="bg-slate-800 border border-teal-600/30 rounded-2xl p-5 sticky top-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-white font-black text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-teal-400" /> Zendi TS</h3>
                        <button onClick={runZendi} disabled={zendiLoading} className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
                            {zendiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {zendiLoading ? "Analizando..." : "Analizar"}
                        </button>
                    </div>

                    {!zendiSummary && !zendiLoading && (
                        <div className="text-center py-8">
                            <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 text-sm font-medium">Presiona Analizar para que Zendi revise el perfil completo de este residente</p>
                        </div>
                    )}

                    {zendiLoading && (
                        <div className="text-center py-8">
                            <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-3" />
                            <p className="text-teal-400 text-sm font-bold animate-pulse">Zendi analizando perfil social...</p>
                        </div>
                    )}

                    {zendiSummary && (
                        <div className="space-y-4">
                            <div className="bg-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-300 text-sm leading-relaxed">{zendiSummary}</p>
                            </div>

                            {zendiSuggestions.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sugerencias ({zendiSuggestions.length})</p>
                                    {zendiSuggestions.map((s, i) => (
                                        <div key={i} className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-3 space-y-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${s.type === "TASK" ? "bg-blue-900/50 text-blue-400" : s.type === "ALERT" ? "bg-rose-900/50 text-rose-400" : "bg-slate-600 text-slate-300"}`}>{s.type === "TASK" ? "Tarea" : s.type === "ALERT" ? "Alerta" : "Info"}</span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${s.priority === "URGENT" ? "text-rose-400" : s.priority === "HIGH" ? "text-amber-400" : "text-slate-400"}`}>{PRIORITY_LABELS[s.priority] || s.priority}</span>
                                            </div>
                                            <p className="text-white text-sm font-bold">{s.title}</p>
                                            <p className="text-slate-400 text-xs">{s.description}</p>
                                            {s.type === "TASK" && (
                                                <button
                                                    onClick={() => createTaskFromZendi(s, i)}
                                                    disabled={creatingTaskIdx === i}
                                                    className="w-full mt-1 py-1.5 bg-teal-600/30 hover:bg-teal-600/50 text-teal-400 text-xs font-bold rounded-lg border border-teal-600/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    {creatingTaskIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                                    {creatingTaskIdx === i ? "Creando..." : "Crear Tarea"}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
