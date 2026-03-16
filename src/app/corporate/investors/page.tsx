"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Activity, Users, DollarSign, CheckCircle, Clock } from "lucide-react";

interface VividKPI {
    hqId: string;
    name: string;
    capacity: number;
    isOpen: boolean;
    occupancyRate: number;
    monthlyRevenue: number;
    clinicalComplianceRate: number;
    activePatients: number;
    staffCount: number;
    logoUrl?: string | null;
}

export default function VividInvestorsDashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [kpis, setKpis] = useState<VividKPI[]>([]);
    const [fetchLoading, setFetchLoading] = useState(true);

    const fetchKpis = async (userId: string) => {
        setFetchLoading(true);
        try {
            const res = await fetch(`/api/corporate/investors/kpis?userId=${userId}`);
            const data = await res.json();
            if (data.success) {
                setKpis(data.targets);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setFetchLoading(false);
        }
    };

    useEffect(() => {
        if (!loading) {
            // @ts-ignore: Next.js cached Prisma Client hasn't loaded 'INVESTOR' role yet
            if (!user || (user.role !== 'INVESTOR' && user.role !== 'ADMIN')) {
                router.push('/unauthorized');
            } else {
                fetchKpis(user.id);
            }
        }
    }, [user, loading, router]);

    if (loading || fetchLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-slate-200 border-t-amber-600 rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-500 font-bold tracking-widest uppercase text-sm">Validando Credenciales Bursátiles...</p>
            </div>
        );
    }

    // Format utility for USD
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="min-h-screen bg-slate-900 font-sans selection:bg-amber-600 selection:text-white">
            {/* Ultra-Premium Vivid Header */}
            <div className="bg-black/40 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-6 flex flex-col md:flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-white font-serif text-3xl italic shadow-lg shadow-amber-500/20">
                            V
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-serif text-white tracking-tight uppercase pb-1">Vivid <span className="text-amber-500 font-light">Senior Living</span></h1>
                            <p className="text-slate-400 font-medium text-xs tracking-[0.2em] uppercase leading-relaxed">Partners & Investor Dashboard</p>
                        </div>
                    </div>

                    <div className="mt-4 md:mt-0 flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-2 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Conexión Segura (En Vivo)</span>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-6 lg:px-12 py-12">

                <div className="mb-12">
                    <h2 className="text-4xl font-light text-white tracking-tight mb-2">Visión General Operativa</h2>
                    <p className="text-slate-400 text-lg">Métricas agregadas en tiempo real de las facilidades Vivid Senior Living.</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {kpis.map((hq) => (
                        <div key={hq.hqId} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-3xl overflow-hidden hover:border-amber-500/30 transition-all duration-500 group">

                            {/* Card Header */}
                            <div className="p-8 border-b border-slate-700/50 bg-gradient-to-b from-slate-800 to-transparent flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-2xl font-bold text-white tracking-tight">{hq.name}</h3>
                                        {hq.isOpen ? (
                                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" /> Operativo
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> Pre-Apertura
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium">Capacidad Total Restringida: {hq.capacity} Camas Autorizadas</p>
                                </div>
                                {hq.logoUrl ? (
                                    <div className="hidden sm:flex h-12 w-32 items-center justify-end">
                                        <img src={hq.logoUrl} alt="Logo" className="max-h-12 object-contain filter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] grayscale hover:grayscale-0 transition-all duration-500" />
                                    </div>
                                ) : (
                                    <div className="hidden sm:flex h-12 w-12 rounded-full bg-slate-700 items-center justify-center text-slate-400 group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors">
                                        <Activity className="w-6 h-6" />
                                    </div>
                                )}
                            </div>

                            {/* Card Body - Telemetry Grid */}
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">

                                {/* Occupancy */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <Users className="w-4 h-4 text-emerald-400" />
                                            <span className="text-sm font-bold uppercase tracking-wider">Ocupación</span>
                                        </div>
                                        <span className="text-2xl font-black text-white">{hq.occupancyRate}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.min(hq.occupancyRate, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium text-right">{hq.activePatients} Pacientes Activos / {hq.capacity} Camas</p>
                                </div>

                                {/* Revenue */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <DollarSign className="w-4 h-4 text-amber-400" />
                                            <span className="text-sm font-bold uppercase tracking-wider">Ingresos MTD</span>
                                        </div>
                                        <span className="text-2xl font-black text-white">{formatCurrency(hq.monthlyRevenue)}</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.min((hq.monthlyRevenue / 150000) * 100, 100)}%` }} // Arbitrary 150k target scale for visuals
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium text-right">Facturación liquidada (Mes a la fecha)</p>
                                </div>

                                {/* Clinical Compliance */}
                                <div className="md:col-span-2 bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-blue-400" /> Índice Clínico Laboral
                                        </h4>
                                        <p className="text-slate-500 text-xs mt-1">Garantía de calidad de {hq.staffCount} enfermeros/cuidadores</p>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-white">{hq.clinicalComplianceRate}</span>
                                        <span className="text-slate-400 font-bold">/ 100</span>
                                    </div>
                                </div>

                            </div>
                        </div>
                    ))}

                    {kpis.length === 0 && (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-700 rounded-3xl">
                            <p className="text-slate-500 font-bold text-lg">No se detectaron sedes bajo la rúbrica corporativa actual.</p>
                            <p className="text-slate-600 mt-2">Inyecte los registros iniciales mediante el comando de soporte técnico.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
