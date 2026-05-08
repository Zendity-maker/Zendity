"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap, Tablet, FileWarning, LogOut, ChevronRight, TrendingUp } from "lucide-react";

interface ScoreData {
    score: number;
    breakdown: {
        base: number;
        positives: number;
        negatives: number;
        observationPenalty: number;
        evaluationDelta: number;
        extraDelta: number;
        roundBonus: number;
        total: number;
        details: {
            medsOmitted: number;
            rotationsLate: number;
            unclosedSessions: number;
            incompleteHandovers: number;
            blankShifts: number;
            medsAdministered: number;
            rotationsOnTime: number;
        };
    };
}

export default function CareHubPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [obsPending, setObsPending] = useState(0);
    const [loadingObs, setLoadingObs] = useState(true);
    const [scoreData, setScoreData] = useState<ScoreData | null>(null);

    useEffect(() => {
        const fetchObs = async () => {
            try {
                const res = await fetch("/api/my-observations/pending-count");
                const data = await res.json();
                if (data.success) setObsPending(data.count ?? 0);
            } catch {}
            finally { setLoadingObs(false); }
        };
        const fetchScore = async () => {
            try {
                const res = await fetch("/api/care/my-score");
                const data = await res.json();
                if (data.success) setScoreData({ score: data.score, breakdown: data.breakdown });
            } catch {}
        };
        fetchObs();
        fetchScore();
    }, []);

    // Hora de bienvenida
    const hour = new Date().getHours();
    const greeting =
        hour >= 5 && hour < 12 ? "Buenos días" :
        hour >= 12 && hour < 19 ? "Buenas tardes" :
        "Buenas noches";

    const firstName = user?.name?.split(" ")[0] ?? "Equipo";

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            {/* Header */}
            <div className="px-6 pt-12 pb-8 text-center">
                <img
                    src="/brand/zendity_logo_white.svg"
                    alt="Zéndity"
                    className="h-8 mx-auto mb-8 opacity-80"
                />
                <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-1">
                    {greeting}
                </p>
                <h1 className="text-white text-2xl font-bold">
                    {firstName} 👋
                </h1>
                <p className="text-slate-500 text-sm mt-2">
                    ¿Qué deseas hacer hoy?
                </p>
            </div>

            {/* Score Card */}
            {scoreData && (() => {
                const s = scoreData.score;
                const d = scoreData.breakdown?.details ?? {};
                const colorClass = s >= 80 ? 'text-emerald-400' : s >= 60 ? 'text-amber-400' : 'text-rose-400';
                const borderClass = s >= 80 ? 'border-emerald-500/20' : s >= 60 ? 'border-amber-500/20' : 'border-rose-500/20';
                const bgClass = s >= 80 ? 'bg-emerald-500/5' : s >= 60 ? 'bg-amber-500/5' : 'bg-rose-500/5';
                const label = s >= 80 ? 'Excelente' : s >= 60 ? 'Buen trabajo' : 'En progreso';
                const tip =
                    (d.blankShifts ?? 0) > 0 ? `${d.blankShifts} turno${(d.blankShifts ?? 0) > 1 ? 's' : ''} sin ningún registro` :
                    (d.medsOmitted ?? 0) > 0 ? `${d.medsOmitted} medicamento${d.medsOmitted > 1 ? 's' : ''} omitido${d.medsOmitted > 1 ? 's' : ''}` :
                    (d.unclosedSessions ?? 0) > 0 ? 'Cierra tu sesión correctamente' :
                    (d.incompleteHandovers ?? 0) > 0 ? 'Completa el hand-over' :
                    (d.rotationsLate ?? 0) > 0 ? `${d.rotationsLate} rotación${d.rotationsLate > 1 ? 'es' : ''} tarde` :
                    (d.medsAdministered ?? 0) > 0 ? 'Sigue así, vas bien' :
                    'Registra actividades para sumar puntos';
                return (
                    <div className={`mx-5 mb-4 max-w-md mx-auto rounded-2xl px-5 py-4 flex items-center gap-4 border ${borderClass} ${bgClass}`}>
                        <TrendingUp className={`w-5 h-5 shrink-0 ${colorClass} opacity-70`} />
                        <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold uppercase tracking-widest ${colorClass}`}>{label}</p>
                            <p className="text-slate-500 text-xs mt-0.5 truncate">{tip}</p>
                        </div>
                        <p className={`text-3xl font-black tabular-nums shrink-0 ${colorClass}`}>{s}</p>
                    </div>
                );
            })()}

            {/* Options */}
            <div className="flex-1 px-5 space-y-4 pb-8 max-w-md mx-auto w-full">

                {/* Iniciar Turno */}
                <button
                    onClick={() => router.push("/care")}
                    className="w-full flex items-center gap-4 bg-teal-600 hover:bg-teal-500 active:scale-[0.98] transition-all rounded-2xl p-5 text-left shadow-lg shadow-teal-900/40"
                >
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                        <Tablet className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-white font-bold text-base leading-tight">
                            Iniciar Turno
                        </p>
                        <p className="text-teal-200/70 text-xs mt-0.5">
                            eMAR, residentes y cierre de turno
                        </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/50 shrink-0" />
                </button>

                {/* Academy */}
                <button
                    onClick={() => router.push("/academy")}
                    className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all rounded-2xl p-5 text-left border border-slate-700 shadow-sm"
                >
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-white font-bold text-base leading-tight">
                            Academy
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                            Cursos, certificaciones y protocolo
                        </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />
                </button>

                {/* Mis Observaciones */}
                <button
                    onClick={() => router.push("/my-observations")}
                    className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all rounded-2xl p-5 text-left border border-slate-700 shadow-sm"
                >
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <FileWarning className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-white font-bold text-base leading-tight">
                            Mis Observaciones
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                            {loadingObs
                                ? "Cargando..."
                                : obsPending > 0
                                    ? `${obsPending} pendiente${obsPending > 1 ? "s" : ""} de respuesta`
                                    : "Sin observaciones pendientes"}
                        </p>
                    </div>
                    {!loadingObs && obsPending > 0 && (
                        <span className="min-w-[24px] h-6 flex items-center justify-center bg-amber-500 rounded-full text-[11px] font-black text-white px-1.5 shrink-0">
                            {obsPending > 9 ? "9+" : obsPending}
                        </span>
                    )}
                    {(!obsPending || loadingObs) && (
                        <ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />
                    )}
                </button>

                {/* Divisor */}
                <div className="pt-2" />

                {/* Cerrar Sesión */}
                <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-700 text-slate-500 hover:text-rose-400 hover:border-rose-900 hover:bg-rose-900/10 transition-all text-sm font-medium"
                >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                </button>
            </div>

            {/* Footer */}
            <div className="text-center pb-6 text-slate-700 text-xs">
                Zéndity OS — {user?.hqName ?? "Sede"}
            </div>
        </div>
    );
}
