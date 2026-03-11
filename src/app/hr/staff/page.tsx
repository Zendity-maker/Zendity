"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import AddStaffModal from "./AddStaffModal";
import SendEmailModal from "./SendEmailModal";

export default function ZendityStaffDirectoryPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [staff, setStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchStaff = async () => {
            try {
                const hqId = user.hqId || user.headquartersId;
                const res = await fetch(`/api/hr/staff?hqId=${hqId}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setStaff(data);
                } else if (data.success && Array.isArray(data.staff)) {
                    setStaff(data.staff);
                }
            } catch (err) {
                console.error("Error cargando staff", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStaff();
    }, [user]);

    const handleBlockToggle = async (empId: string, currentState: boolean) => {
        const action = currentState ? "Desbloquear" : "Bloquear";
        if (!confirm(`¿${action} el acceso de este empleado al sistema y reloj ponchador?`)) return;

        try {
            const res = await fetch("/api/hr/staff", {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: empId, isBlocked: !currentState, blockReason: !currentState ? "Suspensión Adtva." : null })
            });
            const data = await res.json();
            if (data.success) {
                setStaff(prev => prev.map(emp => emp.id === empId ? { ...emp, isShiftBlocked: !currentState } : emp));
            }
        } catch (e) {
            console.error(e);
            alert("Fallo procesando acción administrativa.");
        }
    };

    const handleDelete = async (empId: string, empName: string) => {
        if (!confirm(`¿Está seguro que desea eliminar a ${empName} PERMANENTEMENTE?\nEsta acción es irreversible y eliminará su acceso al sistema Zendity.`)) return;

        try {
            const res = await fetch(`/api/hr/staff?id=${empId}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setStaff(prev => prev.filter(emp => emp.id !== empId));
            } else {
                alert(data.error || "Fallo al intentar eliminar al empleado.");
            }
        } catch (e) {
            console.error(e);
            alert("Error de red al intentar eliminar.");
        }
    };

    if (loading) return <div className="p-20 text-center font-bold text-slate-400 animate-pulse text-xl">Cargando Staff HR...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Directorio Corporativo de Empleados</h1>
            <p className="text-slate-500 mt-1">Gestión Centralizada de Permisos, Evaluaciones y Compliance de Zendity Academy.</p>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-6 animate-in slide-in-from-bottom-4">
                <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
                    <h3 className="font-bold text-slate-800 text-lg">Staff Clínico Autorizado</h3>
                    <div className="flex items-center gap-3">
                        <SendEmailModal employees={staff} />
                        <AddStaffModal />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 bg-white uppercase font-black tracking-widest border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-5">Empleado</th>
                                <th className="px-6 py-5">Rol / Titulación</th>
                                <th className="px-6 py-5 text-center">Metric Score</th>
                                <th className="px-6 py-5 text-center">Estado (Turnos)</th>
                                <th className="px-6 py-5 text-right flex justify-end">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {staff.map((emp) => (
                                <tr
                                    key={emp.id}
                                    onClick={() => router.push(`/hr/staff/${emp.id}`)}
                                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${emp.isShiftBlocked ? 'bg-rose-50/50' : ''}`}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black shadow-sm ${emp.isShiftBlocked ? 'bg-rose-100 text-rose-700' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                                                {emp.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{emp.name}</p>
                                                <p className="text-xs text-slate-500 font-medium">{emp.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200">
                                            {emp.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`text-lg font-black ${emp.complianceScore < 80 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {emp.complianceScore}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                / 100 PTA.
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {emp.isShiftBlocked ? (
                                            <span className="bg-rose-100 text-rose-700 px-3 py-1.5 rounded-full text-xs font-black flex items-center justify-center gap-1 w-fit mx-auto border border-rose-200 shadow-sm">
                                                <span>🔒</span> Turno Suspendido
                                            </span>
                                        ) : (
                                            <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-black flex items-center justify-center gap-1 w-fit mx-auto border border-emerald-200 shadow-sm">
                                                <span>✅</span> Activo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); router.push(`/hr/staff/${emp.id}`); }}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Ver Perfil"
                                            >
                                                👁️
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleBlockToggle(emp.id, emp.isShiftBlocked); }}
                                                className={`p-2 rounded-lg transition-colors shadow-sm border ${emp.isShiftBlocked ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}
                                                title={emp.isShiftBlocked ? "Restaurar Privilegios" : "Suspender de Turno"}
                                            >
                                                {emp.isShiftBlocked ? "🔓" : "🛑"}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.name); }}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                                title="Eliminar Empleado Permanentemente"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {staff.length === 0 && (
                        <div className="p-10 text-center text-slate-500 font-medium">
                            No se encontraron empleados registrados en la Sede.
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
