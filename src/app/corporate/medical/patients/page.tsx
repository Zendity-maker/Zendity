"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    UserIcon,
    ArrowRightIcon,
    ExclamationTriangleIcon,
    BuildingOffice2Icon
} from "@heroicons/react/24/outline";

export default function MasterPatientDirectory() {
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE, TEMPORARY_LEAVE, DISCHARGED

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const res = await fetch("/api/corporate/patients");
                const data = await res.json();
                if (data.success) {
                    setPatients(data.patients);
                }
            } catch (error) {
                console.error("Error fetching master directory:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPatients();
    }, []);

    const filteredPatients = useMemo(() => {
        return patients.filter((p) => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [patients, searchTerm, statusFilter]);

    const getStatusBadge = (status: string, leaveType?: string) => {
        switch (status) {
            case "ACTIVE":
                return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">Activo</span>;
            case "TEMPORARY_LEAVE":
                return <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1"><ExclamationTriangleIcon className="w-3 h-3" /> Ausente ({leaveType === 'HOSPITAL' ? 'Hospital' : 'Familia'})</span>;
            case "DISCHARGED":
            case "DECEASED":
                return <span className="bg-slate-100 text-slate-500 border border-slate-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">Histórico (Baja)</span>;
            default:
                return <span className="bg-slate-100 text-slate-500 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">{status}</span>;
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center p-20 font-bold text-slate-400 animate-pulse text-xl">Sincronizando Directorio de Residentes...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                            <BuildingOffice2Icon className="w-10 h-10 text-indigo-600" />
                            Directorio Global
                        </h1>
                        <p className="text-slate-500 font-medium mt-2 text-lg max-w-2xl">
                            Censo Maestro de Residentes. Búsqueda centralizada de expedientes activos, ausencias temporales y archivos históricos (bajas definitivas).
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                        <div className="px-4 py-2 text-center border-r border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Activos</p>
                            <p className="text-2xl font-black text-emerald-600">{patients.filter(p => p.status === 'ACTIVE').length}</p>
                        </div>
                        <div className="px-4 py-2 text-center border-r border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hospital</p>
                            <p className="text-2xl font-black text-amber-500">{patients.filter(p => p.status === 'TEMPORARY_LEAVE').length}</p>
                        </div>
                        <div className="px-4 py-2 text-center">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bajas</p>
                            <p className="text-2xl font-black text-slate-400">{patients.filter(p => p.status === 'DISCHARGED' || p.status === 'DECEASED').length}</p>
                        </div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar residente por nombre o habitación..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex bg-slate-100 p-1.5 rounded-xl w-full md:w-auto overflow-x-auto">
                        <button onClick={() => setStatusFilter('ALL')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${statusFilter === 'ALL' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Todos</button>
                        <button onClick={() => setStatusFilter('ACTIVE')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${statusFilter === 'ACTIVE' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>Activos</button>
                        <button onClick={() => setStatusFilter('TEMPORARY_LEAVE')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${statusFilter === 'TEMPORARY_LEAVE' ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500 hover:text-slate-700'}`}>Ausentes / Hospital</button>
                        <button onClick={() => setStatusFilter('DISCHARGED')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${statusFilter === 'DISCHARGED' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}>Históricos</button>
                    </div>
                </div>

                {/* Patient Table Directory */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-200">
                                    <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Residente</th>
                                    <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Habitación</th>
                                    <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Estatus</th>
                                    <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPatients.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                                            No se encontraron residentes con esos criterios.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPatients.map((patient) => (
                                        <tr key={patient.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-full flex flex-shrink-0 items-center justify-center font-black ${patient.status === 'ACTIVE' ? 'bg-indigo-50 text-indigo-600' : patient.status === 'TEMPORARY_LEAVE' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <UserIcon className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-800 text-base">{patient.name}</p>
                                                        <p className="text-sm font-medium text-slate-500 hidden md:block group-hover:text-indigo-600 transition-colors">ID: {patient.id.split('-')[0].toUpperCase()}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 hidden md:table-cell">
                                                <span className="font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                                                    {patient.roomNumber}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(patient.status, patient.leaveType)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={`/corporate/medical/patients/${patient.id}`}
                                                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 hover:bg-indigo-600 hover:text-white transition-all shadow-sm group-hover:scale-110"
                                                >
                                                    <ArrowRightIcon className="w-5 h-5" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
