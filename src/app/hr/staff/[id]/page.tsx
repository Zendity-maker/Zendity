"use client";

import { useState, useEffect, use, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    UserIcon, ArrowLeftIcon, IdentificationIcon,
    AtSymbolIcon, CalendarDaysIcon, ChartBarIcon, StarIcon, MapPinIcon
} from "@heroicons/react/24/outline";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import EditStaffRolesModal from "./EditStaffRolesModal";
import WriteIncidentModal from "@/components/hr/WriteIncidentModal";

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [employee, setEmployee] = useState<any>(null);
    const [performanceData, setPerformanceData] = useState<any[]>([]);
    const [scoreHistory, setScoreHistory] = useState<{
        currentScore: number;
        weeklyAverage: { week: string; avgScore: number }[];
        events: { id: string; date: string; delta: number; reason: string; category: string; scoreBefore: number; scoreAfter: number }[];
        summary: { totalPositive: number; totalNegative: number; topCategory: string | null };
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [incidents, setIncidents] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<any>(null);
    // Consolidación (19-ago-2026): estas métricas vivían en un SEGUNDO perfil
    // duplicado bajo /corporate/hr/staff/[id]. Dos perfiles del mismo empleado
    // divergiendo es deuda que se paga en cada cambio — se unifican aquí.
    const [hrMetrics, setHrMetrics] = useState<any>(null);
    const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", email: "", newPin: "" });
    const [isSaving, setIsSaving] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingPhoto(true);
        try {
            if (file.size > 5 * 1024 * 1024) {
                alert("La imagen es muy grande. El tamaño máximo es 5MB.");
                return;
            }

            const resizedPhotoUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const MAX_WIDTH = 400; 
                        if (width > MAX_WIDTH) { height = height * (MAX_WIDTH / width); width = MAX_WIDTH; }
                        canvas.width = width; canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', 0.85));
                    };
                    img.src = event.target?.result as string;
                };
                reader.readAsDataURL(file);
            });

            const res = await fetch(`/api/hr/staff/${employee.id}/photo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photoUrl: resizedPhotoUrl })
            });
            const data = await res.json();
            
            if (data.success) {
                setEmployee((prev: any) => ({ ...prev, photoUrl: data.photoUrl }));
            } else {
                alert(data.error || "No se pudo actualizar la foto");
            }
        } catch (error) {
            console.error(error);
            alert("Ocurrió un error al subir la foto");
        } finally {
            setIsUploadingPhoto(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    useEffect(() => {
        if (!authLoading) {
            // RBAC Check: Un cuidador solo puede ver SU PROPIO PERFIL
            if ((user?.role === "NURSE" || user?.role === "CAREGIVER") && user.id !== id) {
                alert("Restringido: No tienes permisos para ver el perfil de otro empleado.");
                router.push("/");
                return;
            }
            fetchProfile();
        }
    }, [id, authLoading, user]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const [profileRes, historyRes, attendanceRes, hrRes] = await Promise.all([
                fetch(`/api/hr/staff/${id}`),
                fetch(`/api/hr/staff/${id}/score-history`),
                fetch(`/api/hr/staff/${id}/attendance?days=90`),
                fetch(`/api/corporate/hr/staff/${id}`),
            ]);
            const att = await attendanceRes.json().catch(() => null);
            if (att?.success) setAttendance(att);
            const hrm = await hrRes.json().catch(() => null);
            if (hrm?.success) setHrMetrics(hrm.staff);
            const data = await profileRes.json();
            if (data.success) {
                setEmployee(data.employee);
                setEditForm({ name: data.employee.name, email: data.employee.email, newPin: "" });
                setPerformanceData(data.performanceHistory);
                fetchIncidents(data.employee.headquartersId);
            } else {
                alert("Error cargando perfil: " + data.error);
                router.push("/hr/staff");
            }
            if (historyRes.ok) {
                const histData = await historyRes.json();
                if (histData.success) setScoreHistory(histData);
            }
        } catch (error) {
            console.error("Error al obtener perfil", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/hr/staff", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: employee.id, name: editForm.name, email: editForm.email, ...(editForm.newPin ? { pinCode: editForm.newPin } : {}) })
            });
            const data = await res.json();
            if (data.success) {
                setEmployee({ ...employee, name: editForm.name, email: editForm.email });
                setIsEditing(false);
            } else {
                alert(data.error || "No se pudo actualizar el perfil.");
            }
        } catch (e) {
            alert("Error de conexión intentando guardar el perfil.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleResendWelcome = async () => {
        if (!confirm(`¿Estás seguro de que deseas reenviar el correo de credenciales a ${employee.email}?`)) return;
        setIsResending(true);
        try {
            const res = await fetch(`/api/hr/staff/${employee.id}/welcome`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                alert(" Correo de credenciales reenviado exitosamente.");
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            alert("Error de conexión intentando reenviar.");
        } finally {
            setIsResending(false);
        }
    };

    const fetchIncidents = async (hqId: string) => {
        try {
            const res = await fetch(`/api/hr/incidents?employeeId=${id}&hqId=${hqId}`);
            const data = await res.json();
            if (data.success) {
                setIncidents(data.incidents);
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (loading || authLoading) {
        return (
            <div className="flex bg-slate-50 h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-4 animate-pulse">
                    <UserIcon className="w-12 h-12 text-slate-500" />
                    <p className="font-bold text-slate-500 tracking-wider text-sm uppercase">Cargando Perfil Dinámico...</p>
                </div>
            </div>
        );
    }

    if (!employee) return null;

    // Colorear el score badge basado en la calificacion
    // Etiqueta de la banda: el número solo no dice si va bien o mal.
    const scoreBand = (score: number) => {
        if (score >= 90) return 'Excelente';
        if (score >= 70) return 'Cumplimiento sólido';
        if (score >= 50) return 'Requiere seguimiento';
        return 'Crítico';
    };

    // Tendencia real contra el promedio de hace 4 semanas — un número sin
    // dirección no dice si el empleado está mejorando o cayendo.
    const semanas = scoreHistory?.weeklyAverage ?? [];
    const scoreDelta = semanas.length >= 5
        ? Math.round(semanas[semanas.length - 1].avgScore - semanas[semanas.length - 5].avgScore)
        : null;
    const scoreRange = semanas.length > 0
        ? {
            min: Math.round(Math.min(...semanas.map((w) => w.avgScore))),
            max: Math.round(Math.max(...semanas.map((w) => w.avgScore))),
        }
        : null;

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (score >= 70) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        if (score >= 50) return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-rose-50 text-rose-700 border-rose-200';
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Back Navigation */}
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200"
                    >
                        <ArrowLeftIcon className="w-4 h-4" /> Volver
                    </button>
                    {user?.id === employee.id && (
                        <span className="px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 text-xs font-black uppercase tracking-widest rounded-full">Mi Perfil</span>
                    )}
                </div>

                {/* Profile Header Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-center md:items-start relative overflow-hidden">
                    {/* Decorative Background Blur */}
                    

                    {/* Avatar / Photo */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-3 relative">
                        <input type="file" accept="image/jpeg, image/png, image/webp" className="hidden" ref={fileInputRef} onChange={handlePhotoUpload} />
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="relative group cursor-pointer"
                        >
                            {employee.photoUrl || employee.image ? (
                                <img src={employee.photoUrl || employee.image} alt={employee.name} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md bg-slate-100" />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100 border-4 border-white shadow-md flex items-center justify-center text-indigo-400 text-2xl font-black">
                                    {employee.name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-bold uppercase tracking-widest text-center px-2">Subir Foto</span>
                            </div>
                            {/* Status Dot */}
                            <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-[3px] border-white rounded-full shadow-sm" title="Activo"></div>
                        </div>
                        <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-200 text-indigo-700 hover:text-white hover:bg-indigo-600 px-4 py-1.5 rounded-full shadow-sm transition-colors w-full text-center">
                            {isUploadingPhoto ? " Subiendo..." : " Cambiar Foto"}
                        </button>
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1 text-center md:text-left z-10 w-full">
                        {isEditing ? (
                            <div className="space-y-4 max-w-lg bg-slate-50/80 p-5 rounded-2xl border border-indigo-100 shadow-sm mx-auto md:mx-0">
                                <div>
                                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 block">Modificar Nombre</label>
                                    <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 block">Modificar Correo (Login ID)</label>
                                        <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 block">Nuevo PIN (vacío = sin cambiar)</label>
                                        <input type="password" value={editForm.newPin} onChange={e => setEditForm({...editForm, newPin: e.target.value})} placeholder="••••" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-mono tracking-widest font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" maxLength={6} />
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-3 border-t border-slate-200/60 mt-2">
                                    <button onClick={() => { setIsEditing(false); setEditForm({ name: employee.name, email: employee.email, newPin: "" }); }} className="px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-xl transition-all shadow-sm">Cancelar</button>
                                    <button onClick={handleSaveProfile} disabled={isSaving} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-500/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all disabled:opacity-50">
                                        {isSaving ? "Guardando..." : "Guardar Cambios"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-center md:justify-start gap-4">
                                    <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight leading-tight">{employee.name}</h1>
                                    {(user?.role === "ADMIN" || user?.role === "DIRECTOR") && (
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setIsEditing(true)} className="text-xs px-3 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-500 hover:text-indigo-600 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1.5">
                                                 Editar
                                            </button>
                                            <button onClick={handleResendWelcome} disabled={isResending} className="text-xs px-3 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-slate-500 hover:text-emerald-600 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50">
                                                {isResending ? " Enviando..." : " Reenviar Credenciales"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                        <div className="flex items-center justify-center md:justify-start gap-4 mt-2">
                            <p className="text-xl text-indigo-600 font-bold tracking-wide flex items-center gap-2">
                                {employee.role}
                                {employee.secondaryRoles?.length > 0 && (
                                    <span className="text-sm bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 mt-0.5">
                                        +{employee.secondaryRoles.join(", ")}
                                    </span>
                                )}
                            </p>
                            {(user?.role === "ADMIN" || user?.role === "DIRECTOR") && (
                                <EditStaffRolesModal
                                    employee={employee}
                                    onUpdate={(data) => setEmployee({ ...employee, ...data })}
                                />
                            )}
                            {(user?.role === "ADMIN" || user?.role === "DIRECTOR" || user?.role === "SUPERVISOR") && (
                                <button
                                    onClick={() => setIsIncidentModalOpen(true)}
                                    className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-xl hover:bg-red-100 transition shadow-sm"
                                >
                                    Emitir Falta/Reporte
                                </button>
                            )}
                        </div>

                        <div className="mt-6 flex flex-wrap gap-4 justify-center md:justify-start">
                            <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 font-medium text-sm">
                                <IdentificationIcon className="w-4 h-4" /> PIN: <span className="font-bold text-slate-700">{employee.hasPinCode ? 'PIN configurado ✓' : 'No Asignado'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 font-medium text-sm">
                                <AtSymbolIcon className="w-4 h-4" /> {employee.email}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 font-medium text-sm">
                                <MapPinIcon className="w-4 h-4" /> {employee.headquarters?.name || 'Sede Principal'}
                            </div>
                        </div>
                        </>
                        )}
                    </div>

                    {/* El Z-Score salió de aquí: estaba partido entre este
                        círculo y el gráfico de más abajo, y ninguno de los dos
                        mandaba. Ahora vive completo en su propia banda. */}
                </div>

                {/* Body Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column: Stats & Meta */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
                                <ChartBarIcon className="w-5 h-5 text-indigo-500" /> Resumen Operativo
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <span className="text-slate-500 font-medium text-sm">Asistencias Confirmadas</span>
                                    <span className="text-slate-800 font-black text-xl">{employee._count?.shiftSessions || 0}</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <span className="text-slate-500 font-medium text-sm">Medicamentos (eMAR)</span>
                                    <span className="text-slate-800 font-black text-xl">{employee._count?.administeredMeds || 0}</span>
                                </div>
                                {/* "Ingreso a Cursos 100%" eliminado (17-ago-2026):
                                    era un literal escrito a mano, no un dato — mostraba
                                    100% para todos, siempre. Vuelve cuando exista una
                                    métrica real de Academia. */}
                            </div>
                        </div>

                        <div className="bg-indigo-600 rounded-3xl p-6 shadow-md text-white border border-indigo-500 relative overflow-hidden">
                            <StarIcon className="w-24 h-24 absolute -right-4 -bottom-4 text-indigo-500 opacity-50" />
                            <h3 className="text-lg font-black tracking-tight mb-2 relative z-10">Reconocimientos</h3>
                            <p className="text-indigo-100 font-medium text-sm leading-relaxed relative z-10">
                                El sistema Zendity premia a los empleados por cumplimiento perfecto de las rondas de UPPs. Acumula semanas invictas para ganar medallas en tu expediente corporativo.
                            </p>
                        </div>
                    </div>


                    {/* Z-SCORE — la pieza protagonista.
                        Número, tendencia y las 13 semanas juntos en una banda a
                        todo el ancho: antes el dato vivía partido entre un
                        círculo en el header y este gráfico, separados por otras
                        secciones, y ninguno de los dos mandaba. */}
                    <div className="lg:col-span-3 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-8">

                        {/* Izquierda: el número y qué significa */}
                        <div className="lg:w-56 shrink-0 flex flex-col justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.14em]">Z-Score</p>
                                <div className="flex items-baseline gap-3 mt-1">
                                    <span className="text-6xl md:text-7xl font-black text-slate-800 leading-none tracking-tight">
                                        {employee.complianceScore}
                                    </span>
                                    {scoreDelta !== null && scoreDelta !== 0 && (
                                        <span className={`inline-flex items-center gap-1 text-sm font-black ${scoreDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {scoreDelta > 0 ? '▲' : '▼'} {Math.abs(scoreDelta)}
                                        </span>
                                    )}
                                </div>
                                <span className={`inline-block mt-3 px-3 py-1 rounded-full border text-[11px] font-black ${getScoreColor(employee.complianceScore)}`}>
                                    {scoreBand(employee.complianceScore)}
                                </span>
                            </div>
                            {scoreHistory && (
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                        +{scoreHistory.summary.totalPositive} ganados
                                    </span>
                                    <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                                        {scoreHistory.summary.totalNegative} perdidos
                                    </span>
                                    {scoreHistory.summary.topCategory && (
                                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold">
                                            {scoreHistory.summary.topCategory}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Derecha: la historia del número */}
                        <div className="flex-1 min-w-0 lg:border-l lg:border-slate-100 lg:pl-8 flex flex-col gap-4">
                            <div className="flex items-baseline justify-between gap-3">
                                <h3 className="text-sm font-black text-slate-700">Últimas 13 semanas</h3>
                                {scoreRange && (
                                    <span className="text-[11px] text-slate-400 font-bold">rango {scoreRange.min}–{scoreRange.max}</span>
                                )}
                            </div>

                        {/* Weekly line chart */}
                        <div className="min-h-[220px] w-full">
                            {scoreHistory && scoreHistory.weeklyAverage.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart data={scoreHistory.weeklyAverage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="week"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: "#64748b", fontWeight: 600, fontSize: 10 }}
                                            dy={8}
                                            tickFormatter={(v: string) => {
                                                const d = new Date(v + 'T00:00:00');
                                                return `${d.getDate()}/${d.getMonth() + 1}`;
                                            }}
                                        />
                                        <YAxis
                                            domain={[0, 100]}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: "#64748b", fontWeight: 600, fontSize: 11 }}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 600, fontSize: 12 }}
                                            cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                            formatter={(v: any) => [`${v} pts`, 'Z-Score promedio']}
                                            labelFormatter={(label: any) => {
                                                const d = new Date(String(label) + 'T00:00:00');
                                                return `Semana del ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
                                            }}
                                        />
                                        <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '80', fill: '#22c55e', fontSize: 10, fontWeight: 700 }} />
                                        <Line
                                            type="monotone"
                                            dataKey="avgScore"
                                            name="Z-Score"
                                            stroke="#6366f1"
                                            strokeWidth={3}
                                            activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2 }}
                                            dot={(props: any) => {
                                                const { cx, cy, value } = props;
                                                const color = value >= 80 ? '#22c55e' : '#f43f5e';
                                                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={2} />;
                                            }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[220px] text-center bg-slate-50/60 border border-dashed border-slate-200 rounded-2xl">
                                    <ChartBarIcon className="w-10 h-10 text-slate-300 mb-3" />
                                    <p className="text-sm font-bold text-slate-600">Sin historial de score aún</p>
                                    <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs">Los eventos de Z-Score aparecerán aquí a medida que el empleado registre actividad clínica.</p>
                                </div>
                            )}
                        </div>

                        {/* Events feed */}
                        {scoreHistory && scoreHistory.events.length > 0 && (
                            <div>
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Últimos movimientos</h4>
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {scoreHistory.events.slice(0, 20).map(ev => {
                                        const isPos = ev.delta > 0;
                                        const catIcon: Record<string, string> = {
                                            VITALS: '🩺', MEDS: '💊', ROTATION: '🔄', MISSION: '⭐',
                                            ACADEMY: '🎓', INCIDENT: '⚠️', SHIFT: '🕐', PREVENTIVE: '🛡️',
                                            PHOTO: '📷', EVALUATION: '📋',
                                        };
                                        const ago = (() => {
                                            const diff = Date.now() - new Date(ev.date).getTime();
                                            const h = Math.floor(diff / 3600000);
                                            if (h < 1) return 'Hace menos de 1 h';
                                            if (h < 24) return `Hace ${h} h`;
                                            const d = Math.floor(h / 24);
                                            return `Hace ${d} día${d > 1 ? 's' : ''}`;
                                        })();
                                        return (
                                            <div key={ev.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                                                <span className="text-base shrink-0">{catIcon[ev.category] ?? '📌'}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-slate-700 truncate">{ev.reason}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{ago} · {ev.scoreBefore} → {ev.scoreAfter} pts</p>
                                                </div>
                                                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-black ${isPos ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                    {isPos ? `+${ev.delta}` : ev.delta}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        </div>
                    </div>

                    {/* MÉTRICAS DE RRHH — venían del perfil duplicado de corporate.
                        Evaluaciones, Academia y eMAR son tres lecturas distintas del
                        mismo empleado y ahora conviven con el Z-Score en una sola
                        pantalla, en vez de obligar a saber cuál de dos rutas abrir. */}
                    {hrMetrics && (
                        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Evaluaciones RRHH</p>
                                <div className="flex items-baseline gap-2 mt-2">
                                    <span className="text-3xl font-black text-slate-800">
                                        {hrMetrics.avgEvalScore ?? '—'}
                                    </span>
                                    {hrMetrics.avgEvalScore != null && <span className="text-slate-400 font-bold">/100</span>}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    {hrMetrics.evaluationsCount === 0
                                        ? 'Sin evaluaciones registradas'
                                        : `Promedio de ${hrMetrics.evaluationsCount} evaluación${hrMetrics.evaluationsCount !== 1 ? 'es' : ''}`}
                                </p>
                            </div>

                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Academia</p>
                                <div className="flex items-baseline gap-2 mt-2">
                                    <span className="text-3xl font-black text-slate-800">
                                        {(hrMetrics.courseEnrolls ?? []).filter((c: any) => c.status === 'COMPLETED').length}
                                    </span>
                                    <span className="text-slate-400 font-bold">
                                        /{(hrMetrics.courseEnrolls ?? []).length || '—'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Cursos aprobados</p>
                            </div>

                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Cumplimiento eMAR</p>
                                <div className="flex items-baseline gap-2 mt-2">
                                    <span className={`text-3xl font-black ${
                                        hrMetrics.emarCompliance == null ? 'text-slate-800'
                                        : hrMetrics.emarCompliance >= 95 ? 'text-emerald-600'
                                        : hrMetrics.emarCompliance >= 85 ? 'text-amber-600' : 'text-rose-600'
                                    }`}>
                                        {hrMetrics.emarCompliance != null ? `${hrMetrics.emarCompliance}%` : '—'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    {hrMetrics.emarCompliance == null
                                        ? 'Sin administraciones registradas'
                                        : `${hrMetrics.medsGivenRecord} administrados · ${hrMetrics.medsMissedRecord} omitidos`}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Historial de evaluaciones — también venía de corporate */}
                    {hrMetrics?.evalsReceived?.length > 0 && (
                        <div className="lg:col-span-3 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
                            <h3 className="text-xl font-black text-slate-800 mb-6">Historial de Evaluaciones</h3>
                            <div className="space-y-3">
                                {hrMetrics.evalsReceived.map((ev: any) => (
                                    <div key={ev.id} className="flex items-center gap-4 flex-wrap px-5 py-4 rounded-xl border border-slate-200">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-800 text-sm">
                                                {ev.evaluator?.name ?? 'Evaluador'}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {new Date(ev.createdAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1.5 rounded-lg border font-black text-sm ${getScoreColor(ev.score)}`}>
                                            {ev.score}/100
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Asistencia — los datos existían pero solo se veían
                        consultando la base. Sin esta vista, un supervisor no
                        tenía cómo entrar a la conversación con hechos. */}
                    {attendance?.success && (
                        <div className="lg:col-span-3 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
                            <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Asistencia
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">Últimos {attendance.ventanaDias} días</p>
                                </div>
                                {attendance.patron.yaSupera ? (
                                    <span className="px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black">
                                        Supera el umbral disciplinario
                                    </span>
                                ) : attendance.patron.sinAvisoEnVentana > 0 && (
                                    <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-black">
                                        A {attendance.patron.faltanParaObservacion} de la observación automática
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                {[
                                    { l: 'Turnos programados', v: attendance.resumen.turnosProgramados, tone: 'text-slate-800' },
                                    { l: 'Ausencias', v: attendance.resumen.ausencias, tone: 'text-slate-800' },
                                    { l: 'Sin aviso', v: attendance.resumen.sinAviso, tone: attendance.resumen.sinAviso > 0 ? 'text-rose-600' : 'text-emerald-600' },
                                    { l: 'Tasa de ausencia', v: `${attendance.resumen.tasaAusenciaPct}%`, tone: attendance.resumen.tasaAusenciaPct > 5 ? 'text-amber-600' : 'text-slate-800' },
                                ].map(k => (
                                    <div key={k.l} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{k.l}</p>
                                        <p className={`text-2xl font-black mt-1 ${k.tone}`}>{k.v}</p>
                                    </div>
                                ))}
                            </div>

                            {attendance.diasConsecutivos?.length > 0 && (
                                <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4">
                                    <p className="text-sm font-black text-rose-800">
                                        Ausencias en días consecutivos
                                    </p>
                                    <p className="text-xs text-rose-700 mt-1">
                                        {attendance.diasConsecutivos.map((r: string[]) => r.join(' y ')).join(' · ')}
                                        {' — '}dos turnos seguidos es una señal distinta a faltas sueltas en el mes.
                                    </p>
                                </div>
                            )}

                            {attendance.detalle.length === 0 ? (
                                <p className="text-sm text-slate-500 py-8 text-center bg-slate-50 rounded-2xl">
                                    Sin ausencias registradas en el período. 
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {attendance.detalle.map((a: any) => (
                                        <div key={a.id} className="flex items-center gap-3 flex-wrap px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                                            <span className="font-bold text-slate-800 text-sm w-24">
                                                {new Date(a.fecha).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', timeZone: 'UTC' })}
                                            </span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-16">{a.turno}</span>
                                            <span className="text-sm text-slate-600">
                                                {a.motivoLabel ?? <span className="italic text-slate-400">Sin motivo registrado</span>}
                                            </span>
                                            <span className={`ml-auto text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                                                a.avisoPrevio
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}>
                                                {a.avisoPrevio ? 'Avisó' : 'Sin aviso'}
                                            </span>
                                            {a.nota && (
                                                <p className="w-full text-xs text-slate-500 pl-24 -mt-1">{a.nota}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <p className="text-[11px] text-slate-400 mt-4 leading-snug">
                                Solo las ausencias sin aviso cuentan para la detección de patrón
                                ({attendance.patron.umbral} en {attendance.patron.ventanaDias} días genera una observación con
                                72 horas para explicar). Las anteriores a agosto 2026 no tienen motivo porque el campo no existía.
                            </p>
                        </div>
                    )}

                </div>

                {/* Incidents Section */}
                <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 mt-6">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-6">
                        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Historial de Faltas y Reportes Disciplinarios
                    </h3>

                    {incidents.length === 0 ? (
                        <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                            <p className="text-slate-500 font-medium">Este empleado tiene un expediente disciplinario limpio. </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {incidents.map((incident: any) => (
                                <div key={incident.id} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row gap-6">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 text-xs font-bold rounded-md uppercase tracking-wider ${incident.type === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                                                incident.type === 'SUSPENSION' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {incident.type}
                                            </span>
                                            <span className="text-sm font-bold text-slate-500">
                                                {new Date(incident.createdAt).toLocaleDateString('es-ES')}
                                            </span>
                                        </div>
                                        <p className="text-slate-700 text-sm whitespace-pre-wrap pt-2">
                                            {incident.description}
                                        </p>
                                        <p className="text-xs text-slate-500 font-medium mt-2">
                                            Emitido por: <span className="text-slate-700">{incident.supervisor?.name || 'Supervisor'}</span>
                                        </p>
                                    </div>
                                    <div className="shrink-0 md:w-48 bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center">Firma de Enterado</p>
                                        {incident.signatureBase64 ? (
                                            <img src={incident.signatureBase64} alt="Firma del empleado" className="w-full object-contain h-20 opacity-80" />
                                        ) : (
                                            <span className="text-xs text-rose-500 font-bold">Sin firmar</span>
                                        )}
                                        {incident.signedAt && (
                                            <p className="text-[10px] text-slate-500 mt-2">{new Date(incident.signedAt).toLocaleString('es-ES')}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <WriteIncidentModal
                    isOpen={isIncidentModalOpen}
                    onClose={() => setIsIncidentModalOpen(false)}
                    hqId={user?.headquartersId || user?.hqId || ""}
                    supervisorId={user?.id || ""}
                    employees={[employee]}
                    onSuccess={() => fetchIncidents(employee.headquartersId)}
                />

            </div>
        </div>
    );
}
