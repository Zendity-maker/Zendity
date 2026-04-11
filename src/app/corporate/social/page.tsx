"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
    Loader2, Users, CheckCircle2, AlertTriangle, Clock,
    Sparkles, Heart, Stethoscope, FileText, ArrowRight
} from "lucide-react";

const PRIORITY_STYLES: Record<string, string> = {
    LOW: "bg-slate-100 text-slate-600", NORMAL: "bg-blue-100 text-blue-700",
    HIGH: "bg-amber-100 text-amber-700", URGENT: "bg-rose-100 text-rose-700",
};
const PRIORITY_LABELS: Record<string, string> = { LOW: "Baja", NORMAL: "Normal", HIGH: "Alta", URGENT: "Urgente" };
const CATEGORY_LABELS: Record<string, string> = { FOLLOW_UP: "Seguimiento", DOCUMENT: "Documento", FAMILY: "Familia", APPOINTMENT: "Cita", BENEFIT: "Beneficio" };
const BENEFIT_ICONS: Record<string, string> = { MEDICARE: "💊", MEDICAID: "🏥", SNAP: "🍎", PENSION: "💰", OTHER: "📋" };
const SPECIALIST_ICONS: Record<string, string> = { DOCTOR: "👨‍⚕️", PODIATRIST: "🦶", PSYCHOLOGIST: "🧠", DENTIST: "🦷", PSYCHIATRIST: "💭", OTHER: "🩺" };
const NOTE_CAT_STYLES: Record<string, string> = { GENERAL: "bg-slate-100 text-slate-600", FAMILY: "bg-violet-100 text-violet-700", BENEFITS: "bg-emerald-100 text-emerald-700", LEGAL: "bg-amber-100 text-amber-700", INCIDENT: "bg-rose-100 text-rose-700" };

type TaskItem = { id: string; title: string; description: string | null; category: string; priority: string; status: string; dueDate: string | null; isZendiSuggested: boolean; patient: { id: string; name: string; roomNumber: string | null }; createdBy: { id: string; name: string }; assignedTo: { id: string; name: string } | null };
type BenefitItem = { id: string; type: string; status: string; expirationDate: string | null; details: string | null; patient: { id: string; name: string } };
type OverdueItem = { patient: { id: string; name: string }; specialistType: string; lastVisit: string | null; daysSince: number };
type NoteItem = { id: string; content: string; category: string; createdAt: string; patient: { id: string; name: string }; createdBy: { id: string; name: string } };

export default function CorporateSocialDashboard() {
    const { user } = useAuth();
    const hqId = user?.hqId || user?.headquartersId || "";
    const [loading, setLoading] = useState(true);

    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [benefits, setBenefits] = useState<BenefitItem[]>([]);
    const [overdue, setOverdue] = useState<OverdueItem[]>([]);
    const [notes, setNotes] = useState<NoteItem[]>([]);
    const [stats, setStats] = useState({ totalActiveResidents: 0, tasksCompletedThisWeek: 0, totalPendingTasks: 0, benefitsExpiringSoon: 0 });

    // Task completion
    const [completingId, setCompletingId] = useState<string | null>(null);

    useEffect(() => {
        if (hqId) fetchDashboard();
    }, [hqId]);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/social/dashboard?hqId=${hqId}`);
            const data = await res.json();
            if (data.success) {
                setTasks(data.pendingTasks);
                setBenefits(data.expiringBenefits);
                setOverdue(data.overdueSpecialists);
                setNotes(data.recentNotes);
                setStats(data.stats);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const completeTask = async (taskId: string) => {
        setCompletingId(taskId);
        try {
            const res = await fetch("/api/social/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, status: "COMPLETED" }) });
            if ((await res.json()).success) {
                setTasks(prev => prev.filter(t => t.id !== taskId));
                setStats(prev => ({ ...prev, totalPendingTasks: prev.totalPendingTasks - 1, tasksCompletedThisWeek: prev.tasksCompletedThisWeek + 1 }));
            }
        } catch (e) { console.error(e); }
        finally { setCompletingId(null); }
    };

    const isOverdue = (d: string | null) => d && new Date(d) < new Date();
    const daysUntil = (d: string | null) => { if (!d) return null; return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); };

    if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-10 h-10 animate-spin text-teal-500" /></div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <Heart className="w-8 h-8 text-violet-600" />
                        Trabajo Social
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Vista general de casos activos de la sede</p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-slate-500" /><p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Residentes Activos</p></div>
                    <p className="text-3xl font-black text-slate-800">{stats.totalActiveResidents}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-rose-500" /><p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tareas Pendientes</p></div>
                    <p className={`text-3xl font-black ${stats.totalPendingTasks > 0 ? "text-rose-600" : "text-slate-800"}`}>{stats.totalPendingTasks}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-amber-500" /><p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Beneficios por Vencer</p></div>
                    <p className={`text-3xl font-black ${stats.benefitsExpiringSoon > 0 ? "text-amber-600" : "text-slate-800"}`}>{stats.benefitsExpiringSoon}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">proximos 60 dias</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Completadas (7d)</p></div>
                    <p className="text-3xl font-black text-emerald-600">{stats.tasksCompletedThisWeek}</p>
                </div>
            </div>

            {/* Pending Tasks */}
            {tasks.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-black text-slate-800 text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-rose-500" /> Tareas Pendientes</h2>
                        <span className="text-xs font-bold text-slate-400">{tasks.length} activas</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 text-left">
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Residente</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tarea</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Prioridad</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoria</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha Limite</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Accion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tasks.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-3">
                                            <Link href={`/corporate/medical/patients/${t.patient.id}`} className="font-bold text-slate-800 text-sm hover:text-teal-700 transition-colors">
                                                {t.patient.name}
                                            </Link>
                                            {t.patient.roomNumber && <p className="text-[10px] text-slate-400">Hab. {t.patient.roomNumber}</p>}
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-slate-700 text-sm max-w-[200px] truncate">{t.title}</p>
                                                {t.isZendiSuggested && <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3"><span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${PRIORITY_STYLES[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</span></td>
                                        <td className="px-6 py-3 text-xs text-slate-500 font-medium">{CATEGORY_LABELS[t.category] || t.category}</td>
                                        <td className="px-6 py-3">
                                            {t.dueDate ? (
                                                <span className={`text-xs font-bold ${isOverdue(t.dueDate) ? "text-rose-600" : "text-slate-500"}`}>
                                                    {new Date(t.dueDate).toLocaleDateString("es-PR", { day: "numeric", month: "short" })}
                                                    {isOverdue(t.dueDate) && " (vencida)"}
                                                </span>
                                            ) : <span className="text-xs text-slate-400">—</span>}
                                        </td>
                                        <td className="px-6 py-3">
                                            <button onClick={() => completeTask(t.id)} disabled={completingId === t.id} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition-colors disabled:opacity-50">
                                                {completingId === t.id ? "..." : "Completar"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expiring Benefits */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="font-black text-slate-800 flex items-center gap-2"><Heart className="w-5 h-5 text-amber-500" /> Beneficios por Vencer</h2>
                    </div>
                    <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                        {benefits.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm py-8">Sin beneficios proximos a vencer</p>
                        ) : benefits.map(b => {
                            const days = daysUntil(b.expirationDate);
                            return (
                                <div key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border ${days !== null && days <= 15 ? "border-rose-200 bg-rose-50/50" : "border-amber-200 bg-amber-50/50"}`}>
                                    <span className="text-xl">{BENEFIT_ICONS[b.type] || "📋"}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 text-sm">{b.patient.name}</p>
                                        <p className="text-xs text-slate-500">{b.type}{b.details ? ` — ${b.details}` : ""}</p>
                                    </div>
                                    <span className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 ${days !== null && days <= 15 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                                        {days !== null ? `${days}d` : "—"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Overdue Specialists */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="font-black text-slate-800 flex items-center gap-2"><Stethoscope className="w-5 h-5 text-rose-500" /> Especialistas Vencidos (&gt;90d)</h2>
                    </div>
                    <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                        {overdue.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm py-8">Todas las visitas al dia</p>
                        ) : overdue.map((o, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                                <span className="text-xl">{SPECIALIST_ICONS[o.specialistType] || "🩺"}</span>
                                <div className="flex-1 min-w-0">
                                    <Link href={`/corporate/medical/patients/${o.patient.id}`} className="font-bold text-slate-800 text-sm hover:text-teal-700 transition-colors">{o.patient.name}</Link>
                                    <p className="text-xs text-slate-500">{o.specialistType}</p>
                                </div>
                                <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full shrink-0">{o.daysSince}d</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Notes */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="font-black text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5 text-violet-500" /> Notas Recientes</h2>
                </div>
                <div className="divide-y divide-slate-100">
                    {notes.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-8">Sin notas recientes</p>
                    ) : notes.map(n => (
                        <div key={n.id} className="px-6 py-3 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 shrink-0 ${NOTE_CAT_STYLES[n.category] || NOTE_CAT_STYLES.GENERAL}`}>{n.category}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700 line-clamp-2">{n.content}</p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    <Link href={`/corporate/medical/patients/${n.patient.id}`} className="font-bold hover:text-teal-600 transition-colors">{n.patient.name}</Link>
                                    {" — "}{n.createdBy.name} — {new Date(n.createdAt).toLocaleDateString("es-PR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </p>
                            </div>
                            <Link href={`/corporate/medical/patients/${n.patient.id}`} className="text-slate-400 hover:text-teal-600 transition-colors shrink-0 mt-1"><ArrowRight className="w-4 h-4" /></Link>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
