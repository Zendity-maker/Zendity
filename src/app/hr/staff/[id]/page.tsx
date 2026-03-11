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

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [employee, setEmployee] = useState<any>(null);
    const [performanceData, setPerformanceData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
                setPerformanceData(data.performanceHistory);
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
                    <div className="flex-1 text-center md:text-left z-10">
                        <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight leading-tight">{employee.name}</h1>
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
            </div>
        </div>
    );
}
