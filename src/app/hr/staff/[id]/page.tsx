"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    UserIcon, ArrowLeftIcon, IdentificationIcon,
    AtSymbolIcon, CalendarDaysIcon, ChartBarIcon, StarIcon, MapPinIcon
} from "@heroicons/react/24/outline";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import EditStaffRolesModal from "./EditStaffRolesModal";
import WriteIncidentModal from "@/components/hr/WriteIncidentModal";

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [employee, setEmployee] = useState<any>(null);
    const [performanceData, setPerformanceData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [incidents, setIncidents] = useState<any[]>([]);
    const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", email: "" });
    const [isSaving, setIsSaving] = useState(false);
    const [isResending, setIsResending] = useState(false);

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
            const res = await fetch(`/api/hr/staff/${id}`);
            const data = await res.json();
            if (data.success) {
                setEmployee(data.employee);
                setEditForm({ name: data.employee.name, email: data.employee.email });
                setPerformanceData(data.performanceHistory);
                fetchIncidents(data.employee.headquartersId);
            } else {
                alert("Error cargando perfil: " + data.error);
                router.push("/hr/staff");
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
                body: JSON.stringify({ id: employee.id, name: editForm.name, email: editForm.email })
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
                alert("✅ Correo de credenciales reenviado exitosamente.");
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
                    <UserIcon className="w-12 h-12 text-slate-300" />
                    <p className="font-bold text-slate-400 tracking-wider text-sm uppercase">Cargando Perfil Dinámico...</p>
                </div>
            </div>
        );
    }

    if (!employee) return null;

    // Colorear el score badge basado en la calificacion
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
                        className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-800 transition bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200"
                    >
                        <ArrowLeftIcon className="w-4 h-4" /> Volver
                    </button>
                    {user?.id === employee.id && (
                        <span className="px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 text-xs font-black uppercase tracking-widest rounded-full">Mi Perfil</span>
                    )}
                </div>

                {/* Profile Header Card */}
                <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-8 items-center md:items-start relative overflow-hidden">
                    {/* Decorative Background Blur */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>

                    {/* Avatar / Photo */}
                    <div className="relative group shrink-0">
                        {employee.image ? (
                            <img src={employee.image} alt={employee.name} className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-white shadow-xl bg-slate-100" />
                        ) : (
                            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100 border-4 border-white shadow-xl flex items-center justify-center text-indigo-400 text-5xl font-black">
                                {employee.name.charAt(0)}
                            </div>
                        )}
                        {/* Status Dot */}
                        <div className="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full shadow-sm" title="Activo"></div>
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1 text-center md:text-left z-10 w-full">
                        {isEditing ? (
                            <div className="space-y-4 max-w-lg bg-slate-50/80 p-5 rounded-2xl border border-indigo-100 shadow-sm mx-auto md:mx-0">
                                <div>
                                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 block">Modificar Nombre</label>
                                    <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 block">Modificar Correo (Login ID)</label>
                                    <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                                </div>
                                <div className="flex gap-2 justify-end pt-3 border-t border-slate-200/60 mt-2">
                                    <button onClick={() => { setIsEditing(false); setEditForm({ name: employee.name, email: employee.email }); }} className="px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-xl transition-all shadow-sm">Cancelar</button>
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
                                                ✏️ Editar
                                            </button>
                                            <button onClick={handleResendWelcome} disabled={isResending} className="text-xs px-3 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-slate-500 hover:text-emerald-600 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50">
                                                {isResending ? "⏳ Enviando..." : "✉️ Reenviar Credenciales"}
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
                                <IdentificationIcon className="w-4 h-4" /> PIN: <span className="font-bold text-slate-700">{employee.pinCode || 'No Asignado'}</span>
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

                    {/* Score Highlight */}
                    <div className="shrink-0 flex flex-col justify-center items-center md:items-end">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Desempeño Z-Score</p>
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 shadow-inner ${getScoreColor(employee.complianceScore)}`}>
                            <span className="text-3xl font-black">{employee.complianceScore}</span>
                        </div>
                    </div>
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
                                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <span className="text-slate-500 font-medium text-sm">Ingreso a Cursos</span>
                                    <span className="text-indigo-600 font-black text-xl">100%</span>
                                </div>
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

                    {/* Right Column: Performance Trend Chart */}
                    <div className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 flex flex-col">
                        <div className="mb-8">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <ChartBarIcon className="w-6 h-6 text-emerald-500" />
                                Z-Score Tendencia Histórica
                            </h3>
                            <p className="text-slate-500 font-medium mt-1 text-sm">
                                Evaluación multidimensional basada en asistencia, protocolos clínicos y valoraciones directivas.
                            </p>
                        </div>

                        <div className="flex-1 min-h-[300px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="month"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: "#64748b", fontWeight: 600, fontSize: 12 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: "#64748b", fontWeight: 600, fontSize: 12 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 600 }}
                                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="score"
                                        name="Desempeño Z-Score"
                                        stroke="#6366f1"
                                        strokeWidth={4}
                                        activeDot={{ r: 8, stroke: "#fff", strokeWidth: 2 }}
                                        dot={{ r: 5, fill: "#fff", strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

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
                            <p className="text-slate-500 font-medium">Este empleado tiene un expediente disciplinario limpio. 🎉</p>
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
                                            <span className="text-sm font-bold text-slate-400">
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
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Firma de Enterado</p>
                                        {incident.signatureBase64 ? (
                                            <img src={incident.signatureBase64} alt="Firma del empleado" className="w-full object-contain h-20 opacity-80" />
                                        ) : (
                                            <span className="text-xs text-rose-500 font-bold">Sin firmar</span>
                                        )}
                                        {incident.signedAt && (
                                            <p className="text-[10px] text-slate-400 mt-2">{new Date(incident.signedAt).toLocaleString('es-ES')}</p>
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
