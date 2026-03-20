"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Activity, ShieldAlert, Pill, Users,
    Clock, Calendar as CalendarIcon, Loader2,
    UtensilsCrossed, AlertTriangle, CheckCircle2, Trophy
} from "lucide-react";


type WallData = {
    hqInfo: {
        name: string;
        logoUrl: string | null;
    };
    patients: any[];
    stats: {
        totalActivePatients: number;
        medsAdministeredToday: number;
        activeAlerts: number;
    };
    menu: {
        breakfast: string;
        lunch: string;
        dinner: string;
        snacks: string;
    };
    leaderboard?: any[];
};

export default function WallOfCarePage() {
    const { user } = useAuth();
    const [data, setData] = useState<WallData | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Reloj en tiempo real
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Polling de datos cada 60 segundos
    useEffect(() => {
        if (!user?.hqId) return;

        const fetchData = async () => {
            try {
                const res = await fetch(`/api/wall/dashboard?hqId=${user.hqId}`);
                if (!res.ok) throw new Error("Fallo al obtener datos");
                const json = await res.json();
                if (json.success) {
                    setData(json.data);
                    setError(false);
                }
            } catch (err) {
                console.error("Wall Polling Error:", err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const poller = setInterval(fetchData, 60000);
        return () => clearInterval(poller);
    }, [user?.hqId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1F2D3A] flex flex-col items-center justify-center text-white">
                <Loader2 className="w-16 h-16 animate-spin text-[#0F6B78] mb-4" />
                <h1 className="text-2xl font-display font-bold">Iniciando Zendity Wall of Care...</h1>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-[#1F2D3A] flex flex-col items-center justify-center text-rose-400">
                <AlertTriangle className="w-16 h-16 mb-4" />
                <h1 className="text-2xl font-display font-bold">Error de Conexión. Reintentando...</h1>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#1F2D3A] text-[#EAF4F5] overflow-hidden flex flex-col p-6 font-sans antialiased selection:bg-[#0F6B78] selection:text-white relative">

            {/* Ambient Background Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#0F6B78]/20 blur-[150px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#3CC6C4]/10 blur-[150px] rounded-full pointer-events-none"></div>

            {/* 1. Header Premium TV */}
            <header className="flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-8 shadow-2xl relative z-10">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#0F6B78] to-[#3CC6C4] rounded-2xl flex items-center justify-center text-4xl font-display font-black text-white shadow-[0_0_30px_rgba(15,107,120,0.6)] border border-[#3CC6C4]/30 overflow-hidden">
                        {data.hqInfo.logoUrl ? (
                            <img src={data.hqInfo.logoUrl} alt="HQ Logo" className="w-full h-full object-cover bg-white" />
                        ) : (
                            <img src="/brand/zendity_icon_white.svg" className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" alt="Zendity OS" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-4xl font-display font-black text-white tracking-tight drop-shadow-md">Wall of Care <span className="text-[#3CC6C4]">Dashboard</span></h1>
                        <p className="text-lg font-bold text-[#EAF4F5]/70 flex items-center gap-2 mt-1 uppercase tracking-widest">
                            Control Operativo en Vivo • Sede: {data.hqInfo.name}
                        </p>
                    </div>
                </div>

                <div className="text-right flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-black/40 px-6 py-4 rounded-2xl border border-white/10 backdrop-blur-md">
                        <CalendarIcon className="w-7 h-7 text-[#3CC6C4]" />
                        <span className="text-xl font-bold tracking-wide capitalize">{format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-4 bg-gradient-to-r from-[#0F6B78]/40 to-[#0F6B78]/20 px-8 py-4 rounded-2xl border border-[#3CC6C4]/40 backdrop-blur-md shadow-inner">
                        <Clock className="w-8 h-8 text-white animate-pulse" />
                        <span className="text-4xl font-display font-black tracking-widest text-[#EAF4F5] drop-shadow-lg">{format(currentTime, "hh:mm:ss a")}</span>
                    </div>
                </div>
            </header>

            {/* Main Content Grid */}
            <div className="grid grid-cols-12 gap-8 flex-1 h-full min-h-0 relative z-10">

                {/* Izquierda: Métricas + Cocina (3 Columnas) */}
                <div className="col-span-3 flex flex-col gap-8">

                    {/* Vital Heartbeat Cards */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-8 border border-white/10 flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-md hover:bg-white/15 transition-all">
                            <div className="flex items-center gap-4 mb-6">
                                <span className="p-4 bg-blue-500/20 text-blue-300 rounded-2xl border border-blue-500/30 shadow-inner"><Users className="w-8 h-8" /></span>
                                <span className="font-bold text-xl text-white/90 uppercase tracking-widest">Censo Activo</span>
                            </div>
                            <span className="text-7xl font-display font-black text-white drop-shadow-md">{data.stats.totalActivePatients}</span>
                        </div>

                        <div className="bg-gradient-to-br from-[#0F6B78]/30 to-white/5 rounded-3xl p-8 border border-[#3CC6C4]/30 flex flex-col justify-between shadow-[0_8px_30px_rgba(15,107,120,0.3)] backdrop-blur-md hover:from-[#0F6B78]/40 transition-all">
                            <div className="flex items-center gap-4 mb-6">
                                <span className="p-4 bg-[#3CC6C4]/20 text-[#3CC6C4] rounded-2xl border border-[#3CC6C4]/40 shadow-inner"><Pill className="w-8 h-8" /></span>
                                <span className="font-bold text-xl text-white/90 uppercase tracking-widest">Meds Hoy</span>
                            </div>
                            <span className="text-7xl font-display font-black text-white drop-shadow-md">{data.stats.medsAdministeredToday}</span>
                        </div>
                    </div>

                    {/* Alertas Críticas */}
                    <div className={`rounded-3xl p-8 border flex flex-col shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-md transition-all ${data.stats.activeAlerts > 0 ? 'bg-gradient-to-br from-rose-500/20 to-rose-900/30 border-rose-500/50' : 'bg-gradient-to-br from-emerald-500/20 to-emerald-900/30 border-emerald-500/30 hover:from-emerald-500/30'}`}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <span className={`p-4 rounded-2xl border shadow-inner ${data.stats.activeAlerts > 0 ? 'bg-rose-500/30 text-rose-300 border-rose-500/50' : 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50'}`}>
                                    {data.stats.activeAlerts > 0 ? <ShieldAlert className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                                </span>
                                <span className="font-bold text-xl text-white/90 uppercase tracking-widest">Alertas Clínicas</span>
                            </div>
                            {data.stats.activeAlerts === 0 && <span className="text-emerald-100 font-bold text-sm bg-emerald-500/40 px-4 py-2 rounded-full border border-emerald-400 tracking-widest shadow-lg">TODO ESTABLE</span>}
                        </div>
                        <span className={`text-[120px] leading-none font-display font-black drop-shadow-lg ${data.stats.activeAlerts > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {data.stats.activeAlerts}
                        </span>
                        {data.stats.activeAlerts > 0 && <p className="text-rose-200 text-base mt-2 font-bold uppercase tracking-widest animate-pulse">Revisar panel de enfermería de inmediato.</p>}
                    </div>

                    {/* Menú de Cocina */}
                    <div className="bg-gradient-to-br from-white/10 to-black/20 rounded-3xl p-8 border border-white/10 flex-1 shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-md flex flex-col">
                        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
                            <span className="p-4 bg-orange-500/20 text-orange-300 rounded-2xl border border-orange-500/30 shadow-inner"><UtensilsCrossed className="w-8 h-8" /></span>
                            <span className="font-bold text-2xl text-white uppercase tracking-widest">Menú del Día</span>
                        </div>

                        <div className="flex flex-col gap-8 flex-1 justify-center">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                <p className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Desayuno</p>
                                <p className="text-2xl font-bold text-white tracking-wide">{data.menu.breakfast}</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                <p className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Almuerzo</p>
                                <p className="text-2xl font-bold text-white tracking-wide">{data.menu.lunch}</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                <p className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Cena</p>
                                <p className="text-2xl font-bold text-white tracking-wide">{data.menu.dinner}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Centro: Mapa de Habitaciones (6 Columnas) */}
                <div className="col-span-6 bg-black/20 rounded-3xl p-8 border border-white/10 shadow-[inner_0_0_50px_rgba(0,0,0,0.5)] overflow-y-auto custom-scrollbar flex flex-col backdrop-blur-xl relative">
                    <div className="flex items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10 sticky top-0 bg-[#1F2D3A]/95 backdrop-blur-2xl z-20 pt-2 -mt-4 -mx-4 px-4 shadow-sm">
                        <div className="flex items-center gap-4">
                            <span className="p-4 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/30 shadow-inner"><Activity className="w-8 h-8" /></span>
                            <h2 className="font-display font-black text-3xl text-white tracking-tight">Mapa de Residentes <span className="text-indigo-300 font-medium">(Live Status)</span></h2>
                        </div>
                        <div className="flex items-center gap-4 text-sm font-bold tracking-widest uppercase">
                            <div className="flex items-center gap-2 text-emerald-400"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div> Estable</div>
                            <div className="flex items-center gap-2 text-rose-400"><div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"></div> Alerta</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 auto-rows-max pb-8">
                        {data.patients.map((patient) => (
                            <div key={patient.id} className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-5 flex items-center gap-5 transition-all hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] group">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex-shrink-0 flex items-center justify-center font-display font-black text-2xl text-slate-300 border border-slate-600 shadow-inner group-hover:border-slate-500 transition-colors">
                                    {patient.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-xl truncate tracking-wide" title={patient.name}>{patient.name}</p>
                                    <p className="text-sm text-[#3CC6C4] font-bold uppercase tracking-widest mt-1">Cuarto {patient.roomNumber || 'N/A'}</p>
                                </div>
                                <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.9)] border-2 border-[#1F2D3A]"></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Derecha: Leaderboard Gamificado (3 Columnas) */}
                <div className="col-span-3 flex flex-col gap-8">
                    <div className="bg-gradient-to-br from-[#0F6B78]/30 to-black/20 rounded-3xl p-8 border border-[#3CC6C4]/30 flex-1 shadow-[0_8px_30px_rgba(15,107,120,0.3)] backdrop-blur-md flex flex-col relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#3CC6C4]/20 rounded-bl-full -z-10 blur-xl"></div>
                        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
                            <span className="p-4 bg-yellow-500/20 text-yellow-300 rounded-2xl border border-yellow-500/30 shadow-inner group-hover:scale-110 transition-transform"><Trophy className="w-8 h-8" /></span>
                            <span className="font-bold text-xl text-white uppercase tracking-widest drop-shadow-md">Top Excellence</span>
                        </div>
                        <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                            {data.leaderboard?.map((staff: any, idx: number) => (
                                <div key={staff.id} className="flex items-center gap-4 bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 hover:border-[#3CC6C4]/30 transition-all">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl bg-gradient-to-br from-[#0F6B78] to-[#3CC6C4] text-white border border-[#3CC6C4]/40 shadow-md">
                                        #{idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold tracking-wide truncate">{staff.name}</p>
                                        <p className="text-[#3CC6C4] text-[10px] font-bold uppercase tracking-widest truncate">{staff.role}</p>
                                    </div>
                                    <div className="text-2xl font-black text-emerald-400 drop-shadow-sm">{staff.complianceScore} <span className="text-xs text-emerald-600">pts</span></div>
                                </div>
                            ))}
                            {(!data.leaderboard || data.leaderboard.length === 0) && (
                                <p className="text-slate-500 text-sm font-bold text-center mt-8 uppercase tracking-widest">Sin Data Operacional</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
}
