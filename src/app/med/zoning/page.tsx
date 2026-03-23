"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface Patient {
    id: string;
    name: string;
    colorGroup: string;
}

export default function NursingZoningPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [zoning, setZoning] = useState<Record<string, Patient[]>>({});
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        fetchZoning();
    }, []);

    const fetchZoning = async () => {
        try {
            const res = await fetch("/api/nursing/zoning");
            const data = await res.json();
            if (data.success) {
                setZoning(data.zoning);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleReassign = async (patientId: string, newColor: string) => {
        setUpdating(patientId);
        try {
            const res = await fetch("/api/nursing/zoning", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId, newColor }),
            });
            const data = await res.json();
            if (data.success) {
                fetchZoning();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setUpdating(null);
        }
    };

    const colors = [
        { key: "RED", name: " Grupo Rojo", bg: "bg-red-50", border: "border-red-200", title: "text-red-800" },
        { key: "YELLOW", name: " Grupo Amarillo", bg: "bg-yellow-50", border: "border-yellow-200", title: "text-yellow-800" },
        { key: "GREEN", name: " Grupo Verde", bg: "bg-emerald-50", border: "border-emerald-200", title: "text-emerald-800" },
        { key: "BLUE", name: " Grupo Azul", bg: "bg-blue-50", border: "border-blue-200", title: "text-blue-800" },
    ];

    if (loading) return <div className="p-10 font-bold text-center text-teal-600 animate-pulse">Cargando Panel de Zonificación...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <span className="text-4xl"></span> Panel de Control: Balance de Cargas
                    </h1>
                    <p className="text-slate-500 mt-1 max-w-xl">
                        Gestión Centralizada de Zonificación (Color Zoning). Asigne un máximo de 10 residentes por color para garantizar el cumplimiento y bienestar del personal de Piso (Zendity Care).
                    </p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => router.push('/med')} className="px-5 py-2.5 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">Volver al eMAR</button>
                    <button onClick={() => router.push('/care')} className="px-5 py-2.5 bg-teal-600 shadow-lg shadow-teal-500/30 rounded-xl text-sm font-bold text-white hover:bg-teal-700 transition-all">Vista Cuidador (Tablet)</button>
                </div>
            </div>

            {zoning["UNASSIGNED"] && zoning["UNASSIGNED"].length > 0 && (
                <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl mb-8 flex items-center justify-between animate-pulse">
                    <div>
                        <h3 className="font-bold text-lg text-amber-400"> {zoning["UNASSIGNED"].length} Residentes Recientes Sin Asignar</h3>
                        <p className="text-sm text-slate-400">Residentes ingeridos desde Intake requieren asignación inmediata de turno.</p>
                    </div>
                    <div>
                        <select
                            className="bg-slate-800 border-2 border-slate-700 rounded-xl py-2 px-4 focus:ring-amber-500 text-sm font-bold"
                            onChange={(e) => {
                                if (e.target.value) handleReassign(zoning["UNASSIGNED"][0].id, e.target.value);
                            }}
                            value=""
                        >
                            <option value="" disabled>Selecciona color para el 1ro ({zoning["UNASSIGNED"][0].name})</option>
                            <option value="RED"> Grupo Rojo</option>
                            <option value="YELLOW"> Grupo Amarillo</option>
                            <option value="GREEN"> Grupo Verde</option>
                            <option value="BLUE"> Grupo Azul</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {colors.map((c) => {
                    const group = zoning[c.key] || [];
                    const isOverloaded = group.length > 10;

                    return (
                        <div key={c.key} className={`rounded-xl border-2 shadow-lg overflow-hidden flex flex-col ${c.bg} ${c.border} ${isOverloaded ? 'border-red-500 ring-4 ring-red-500/20' : ''}`}>
                            {/* Resumen de Zona */}
                            <div className="p-5 border-b border-black/5 flex justify-between items-center bg-white/40 backdrop-blur-md">
                                <h2 className={`text-lg font-black ${c.title}`}>{c.name}</h2>
                                <div className="flex items-center gap-2">
                                    <span className={`text-2xl font-black ${isOverloaded ? 'text-red-600' : 'text-slate-800'}`}>{group.length}</span>
                                    <span className="text-xs font-bold text-slate-500 uppercase">/ 10 Máx</span>
                                </div>
                            </div>

                            {/* Residentes (Draggable en Futuro, Switch Rápido ahora) */}
                            <div className="p-4 flex-1 space-y-3">
                                {group.length === 0 ? (
                                    <div className="h-24 flex items-center justify-center text-xs font-bold text-black/20 opacity-50 uppercase tracking-widest text-center">
                                        Sin Asignación
                                    </div>
                                ) : (
                                    group.map((p) => (
                                        <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all">
                                            <p className="font-bold text-slate-800 text-sm truncate pr-2">{p.name}</p>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                {updating === p.id ? (
                                                    <span className="text-xs text-slate-400 font-bold uppercase">...</span>
                                                ) : (
                                                    <select
                                                        className="text-[10px] uppercase font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 cursor-pointer outline-none"
                                                        value={c.key}
                                                        onChange={(e) => handleReassign(p.id, e.target.value)}
                                                    >
                                                        <option value="RED"> ROJO</option>
                                                        <option value="YELLOW"> AMARILLO</option>
                                                        <option value="GREEN"> VERDE</option>
                                                        <option value="BLUE"> AZUL</option>
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}
