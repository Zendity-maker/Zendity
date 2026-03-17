"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';

type StaffMember = {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    isShiftBlocked: boolean;
    photoUrl: string | null;
    facility: string;
    evaluationsCount: number;
    performanceScore: number;
    complianceScore: number;
    avgEvalScore: number | null;
};

export default function HRDirectoryPage() {
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [facilities, setFacilities] = useState<string[]>([]);
    const [selectedFacility, setSelectedFacility] = useState("TODAS");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHRData = async () => {
            try {
                const res = await fetch('/api/corporate/hr');
                const data = await res.json();
                if (data.success) {
                    setStaffList(data.staff);
                    setFacilities(data.facilities);
                }
            } catch (error) {
                console.error("Failed to fetch HR data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHRData();
    }, []);

    const filteredStaff = staffList.filter(staff => {
        const matchesFacility = selectedFacility === "TODAS" || staff.facility === selectedFacility;
        const matchesSearch = staff.name.toLowerCase().includes(searchQuery.toLowerCase()) || staff.email.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFacility && matchesSearch;
    });

    const getScoreColor = (score: number) => {
        if (score >= 90) return "bg-emerald-100 text-emerald-700 border-emerald-200";
        if (score >= 75) return "bg-amber-100 text-amber-700 border-amber-200";
        return "bg-rose-100 text-rose-700 border-rose-200";
    };

    const getRoleName = (role: string) => {
        const roles: Record<string, string> = {
            "NURSE": "Enfermera",
            "CAREGIVER": "Cuidadora",
            "DIRECTOR": "Directora",
            "SOCIAL_WORKER": "Trabajo Social",
            "KITCHEN": "Cocina"
        };
        return roles[role] || role;
    };

    if (loading) return (
        <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Directorio de Personal (RRHH)</h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Auditoría de cumplimiento y puntuación (*Scorecard*) de empleados de todas las sedes.
                    </p>
                </div>
                <div className="bg-teal-50 text-teal-700 px-4 py-2 rounded-xl border border-teal-100 font-bold shadow-sm">
                    {filteredStaff.length} Empleados Activos
                </div>
            </div>

            {/* Filters Area */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                        🔍
                    </span>
                    <input
                        type="text"
                        placeholder="Buscar empleado por nombre o email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all outline-none font-medium"
                    />
                </div>
                <div className="sm:w-64 relative">
                    <select
                        value={selectedFacility}
                        onChange={(e) => setSelectedFacility(e.target.value)}
                        className="w-full appearance-none bg-white border border-slate-200 text-slate-800 rounded-xl font-bold px-4 py-3 pr-10 hover:border-teal-400 focus:ring-2 focus:ring-teal-200 focus:border-teal-500 transition-all cursor-pointer"
                    >
                        <option value="TODAS">🌍 Todas las Sedes</option>
                        {facilities.map((fac, idx) => (
                            <option key={idx} value={fac}>🏥 {fac}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                        ▼
                    </div>
                </div>
            </div>

            {/* Staff Directory Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 bg-slate-50 uppercase font-bold tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Empleado</th>
                                <th className="px-6 py-4">Rol en Sistema</th>
                                <th className="px-6 py-4">Sede (Facility)</th>
                                <th className="px-6 py-4 text-center">Auditorías</th>
                                <th className="px-6 py-4 text-center">Compliance Score</th>
                                <th className="px-6 py-4 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredStaff.map((staff) => (
                                <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex-shrink-0 h-10 w-10 relative">
                                                {staff.photoUrl ? (
                                                    <img className="h-10 w-10 rounded-full border border-slate-200 object-cover" src={staff.photoUrl} alt="" />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center">
                                                        <span className="text-slate-500 font-bold uppercase">{staff.name.charAt(0)}{staff.name.split(' ').length > 1 ? staff.name.split(' ')[1].charAt(0) : ''}</span>
                                                    </div>
                                                )}
                                                {!staff.isActive && (
                                                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 rounded-full bg-red-500 border-2 border-white" title="Cuenta Desactivada"></span>
                                                )}
                                                {staff.isShiftBlocked && staff.isActive && (
                                                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 rounded-full bg-amber-500 border-2 border-white" title="Turnos Bloqueados"></span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{staff.name}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{staff.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                            {getRoleName(staff.role)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-600">
                                        {staff.facility}
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-500 font-medium">
                                        {staff.evaluationsCount} Registros
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center">
                                            <span className={`px-3 py-1.5 rounded-lg border font-black text-sm flex items-center gap-1.5 ${getScoreColor(staff.performanceScore)}`}>
                                                {staff.performanceScore >= 90 ? '🏆' : staff.performanceScore >= 75 ? '⚠️' : '🚨'}
                                                {staff.performanceScore} / 100
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Link
                                            href={`/corporate/hr/staff/${staff.id}`}
                                            className="inline-flex items-center px-4 py-2 bg-white hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-200 rounded-xl text-sm font-bold text-slate-600 shadow-sm transition-all"
                                        >
                                            Ver Perfil →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {filteredStaff.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <div className="text-4xl mb-3">🔍</div>
                                        <div className="font-bold text-lg">No se encontraron empleados.</div>
                                        <div className="text-sm">Intenta ajustar los filtros de búsqueda o de Sede.</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
