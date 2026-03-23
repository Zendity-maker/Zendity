"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Users, Plus, Shield, Mail, Key, ShieldAlert,
    MoreVertical, Ban, CheckCircle2, UserCog, Building2, Trash2
} from "lucide-react";

type StaffMember = {
    id: string;
    name: string;
    email: string;
    role: string;
    pinCode: string | null;
    complianceScore: number;
    isShiftBlocked: boolean;
    createdAt: string;
};

import Link from 'next/link';

export default function StaffManagementPage() {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Modal Form State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        role: "CAREGIVER",
        pinCode: "1234"
    });
    const [formSaving, setFormSaving] = useState(false);

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        try {
            const res = await fetch("/api/hr/staff");
            if (res.ok) {
                const data = await res.json();
                setStaff(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormSaving(true);
        try {
            const res = await fetch("/api/hr/staff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                await fetchStaff();
                setIsCreateModalOpen(false);
                setFormData({ name: "", email: "", role: "CAREGIVER", pinCode: "1234" });
            } else {
                const err = await res.json();
                alert(err.error || "Error al crear empleado");
            }
        } catch (error) {
            alert("Error de conexión al guardar.");
        } finally {
            setFormSaving(false);
        }
    };

    const toggleStaffStatus = async (id: string, currentlyBlocked: boolean) => {
        if (!confirm(`¿Estás seguro de que deseas ${currentlyBlocked ? 'RE-ACTIVAR' : 'SUSPENDER'} el acceso de este empleado?`)) return;

        try {
            const res = await fetch("/api/hr/staff", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, isShiftBlocked: !currentlyBlocked })
            });

            if (res.ok) {
                fetchStaff();
            } else {
                const err = await res.json();
                alert(err.error || "No se pudo actualizar el estado.");
            }
        } catch (error) {
            alert("Error de red.");
        }
    };

    const handleDeleteEmployee = async (id: string, name: string) => {
        if (!confirm(`¿Estás absolutamente seguro de que deseas ELIMINAR PERMANENTEMENTE a ${name}?`)) return;
        if (!confirm(`ADVERTENCIA FINAL: Esto removerá su acceso y desaparecerá de todas las listas. ¿Proceder?`)) return;

        try {
            const res = await fetch(`/api/hr/staff?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchStaff();
            } else {
                const err = await res.json();
                alert(err.error || "No se pudo eliminar el empleado.");
            }
        } catch (error) {
            alert("Error de red.");
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'DIRECTOR': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium border border-purple-200">Director</span>;
            case 'ADMIN': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200">Admin</span>;
            case 'NURSE': return <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium border border-teal-200">Enfermera</span>;
            case 'CAREGIVER': return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-200">Cuidador(a)</span>;
            default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{role}</span>;
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Users className="w-8 h-8 text-blue-600" />
                        Directorio de Personal
                    </h1>
                    <p className="text-gray-500 mt-2 flex items-center gap-2">
                        <Building2 className="w-4 h-4" /> Gestione los accesos y credenciales de su sede.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Contratar Empleado
                </button>
            </div>

            {/* Staff Table Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-4 text-sm font-semibold text-gray-600">Empleado</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Rol Clínico</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Credenciales (Login)</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Score RRHH</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Estado de Acceso</th>
                                <th className="p-4 text-sm font-semibold text-gray-600 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                                        Cargando nómina...
                                    </td>
                                </tr>
                            ) : staff.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        Vaya, no hay personal registrado en esta sede.
                                    </td>
                                </tr>
                            ) : (
                                staff.map((s) => (
                                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center font-bold text-blue-700 border border-blue-200">
                                                    {s.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{s.name}</p>
                                                    <p className="text-xs text-gray-500">Alta: {format(new Date(s.createdAt), 'MMM yyyy', { locale: es })}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {getRoleBadge(s.role)}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                    <Mail className="w-3.5 h-3.5" />
                                                    {s.email}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                                                    <Key className="w-3 h-3" />
                                                    PIN: {s.pinCode || 'No asignado'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${s.complianceScore >= 80 ? 'bg-green-500' : 'bg-red-500'}`}
                                                        style={{ width: `${Math.max(0, Math.min(100, s.complianceScore))}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-bold ${s.complianceScore >= 80 ? 'text-green-700' : 'text-red-600'}`}>
                                                    {s.complianceScore}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {s.isShiftBlocked ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-medium border border-red-100">
                                                    <Ban className="w-3.5 h-3.5" />
                                                    Suspendido
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium border border-green-100">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Activo
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Link
                                                    href={`/corporate/hr/staff/${s.id}`}
                                                    className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                                    title="Ver Perfil & Rendimiento"
                                                >
                                                    <UserCog className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => toggleStaffStatus(s.id, s.isShiftBlocked)}
                                                    className={`p-2 rounded-xl border transition-colors ${s.isShiftBlocked
                                                        ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100'
                                                        : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                                                        }`}
                                                    title={s.isShiftBlocked ? 'Reactivar Empleado' : 'Suspender Acceso'}
                                                >
                                                    {s.isShiftBlocked ? <Shield className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteEmployee(s.id, s.name)}
                                                    className={`p-2 rounded-xl border transition-colors bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100`}
                                                    title="Eliminar Empleado Permanentemente"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Staff Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 transform transition-all">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                <UserCog className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Nuevo Empleado</h3>
                                <p className="text-sm text-gray-500">Crear Credenciales de Acceso</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateStaff} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Ej. Dra. Ana Gómez"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico (Usuario ID)</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    placeholder="ana@clinica.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Rol Clínico</label>
                                    <select
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="CAREGIVER">Cuidador/a</option>
                                        <option value="NURSE">Enfermera(o)</option>
                                        <option value="ADMIN">Administración</option>
                                        <option value="DIRECTOR">Director</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">PIN de Acceso</label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 font-mono tracking-widest bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="1234"
                                        value={formData.pinCode}
                                        onChange={e => setFormData({ ...formData, pinCode: e.target.value })}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Sugerido: 4 dígitos</p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 px-4 py-3 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={formSaving}
                                    className={`flex-1 px-4 py-3 text-white font-medium rounded-xl transition-all shadow-sm ${formSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                >
                                    {formSaving ? 'Generando...' : 'Crear Acceso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
