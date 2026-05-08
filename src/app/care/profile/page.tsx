"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface ScoreBreakdown {
    base: number;
    positives: number;
    negatives: number;
    observationPenalty: number;
    evaluationDelta: number;
    extraDelta: number;
    roundBonus: number;
    total: number;
    details: {
        rotationsOnTime: number;
        medsAdministered: number;
        preventiveAlerts: number;
        medsOmitted: number;
        rotationsLate: number;
        fastActionsFailed: number;
        unclosedSessions: number;
        incompleteHandovers: number;
        blankShifts: number;
        appliedObservationsCount: number;
        evaluationsCount: number;
        extraScoreEventsCount: number;
    };
}

export default function CaregiverProfilePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [certificates, setCertificates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [score, setScore] = useState<number | null>(null);
    const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);

    useEffect(() => {
        if (user && !["CAREGIVER", "NURSE"].includes(user.role || "")) {
            router.replace("/care");
            return;
        }
        if (user?.id) {
            fetchCertificates();
            fetchScore();
        }
    }, [user]);

    const fetchScore = async () => {
        try {
            const res = await fetch("/api/care/my-score");
            const data = await res.json();
            if (data.success) {
                setScore(data.score);
                setBreakdown(data.breakdown);
            }
        } catch {}
    };

    const fetchCertificates = async () => {
        try {
            const hqId = user?.hqId || user?.headquartersId || "";
            const res = await fetch(`/api/academy?hqId=${hqId}&employeeId=${user?.id}`);
            const data = await res.json();
            if (data.success) {
                setCertificates(data.enrollments.filter((e: any) => e.status === "COMPLETED"));
            }
        } catch (e) {
            console.error("Error fetching certificates:", e);
        } finally {
            setLoading(false);
        }
    };

    const initials = user?.name
        ?.split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?";

    return (
        <div className="min-h-screen bg-slate-900 text-white pb-20">
            {/* Header — BackToDashboard se renderiza en AppLayout (top-left) */}

            {/* Identidad */}
            <div className="flex flex-col items-center px-6 pt-16 pb-10">
                {user?.photoUrl ? (
                    <img
                        src={user.photoUrl}
                        alt={user.name}
                        className="w-24 h-24 rounded-full object-cover border-4 border-teal-500 shadow-lg mb-4"
                    />
                ) : (
                    <div className="w-24 h-24 rounded-full bg-teal-700 border-4 border-teal-500 flex items-center justify-center text-white font-black text-2xl shadow-lg mb-4">
                        {initials}
                    </div>
                )}
                <h1 className="text-xl font-semibold text-white mb-1">{user?.name || "Cuidadora"}</h1>
                <p className="text-teal-400 text-sm font-medium mb-1">{user?.role === "NURSE" ? "Enfermera" : "Cuidadora"}</p>
                <p className="text-slate-400 text-sm">{user?.email || ""}</p>
            </div>

            {/* Score Breakdown Card */}
            {score !== null && breakdown && (() => {
                const s = score;
                const b = breakdown;
                const d = b.details;
                const colorClass = s >= 80 ? 'text-emerald-400' : s >= 60 ? 'text-amber-400' : 'text-rose-400';
                const ringClass = s >= 80 ? 'ring-emerald-500/30' : s >= 60 ? 'ring-amber-500/30' : 'ring-rose-500/30';
                const label = s >= 80 ? 'Excelente' : s >= 60 ? 'Buen trabajo' : 'En progreso';

                const blankVal = -((d.blankShifts ?? 0) * 10);
                const rows = [
                    { label: 'Base', value: b.base, sign: '' },
                    { label: `Positivos (rondas, meds, alertas)`, value: b.positives > 0 ? `+${b.positives}` : b.positives, sign: b.positives > 0 ? 'pos' : 'neutral' },
                    { label: `Negativos (omisiones, tardanzas)`, value: -b.negatives, sign: b.negatives > 0 ? 'neg' : 'neutral' },
                    { label: `Turnos sin registro`, value: blankVal, sign: blankVal < 0 ? 'neg' : 'neutral' },
                    { label: `Sesiones sin cerrar`, value: -(d.unclosedSessions * 10), sign: d.unclosedSessions > 0 ? 'neg' : 'neutral' },
                    { label: `Hand-overs incompletos`, value: -(d.incompleteHandovers * 10), sign: d.incompleteHandovers > 0 ? 'neg' : 'neutral' },
                    { label: `Observaciones`, value: b.observationPenalty !== 0 ? -b.observationPenalty : 0, sign: b.observationPenalty > 0 ? 'neg' : 'neutral' },
                    { label: `Evaluación supervisora`, value: b.evaluationDelta !== 0 ? (b.evaluationDelta > 0 ? `+${b.evaluationDelta}` : b.evaluationDelta) : 0, sign: b.evaluationDelta > 0 ? 'pos' : b.evaluationDelta < 0 ? 'neg' : 'neutral' },
                    { label: `Bono de ronda`, value: b.roundBonus > 0 ? `+${b.roundBonus}` : b.roundBonus, sign: b.roundBonus > 0 ? 'pos' : b.roundBonus < 0 ? 'neg' : 'neutral' },
                ];

                const tips: string[] = [];
                if ((d.blankShifts ?? 0) > 0) tips.push(`${d.blankShifts} turno${(d.blankShifts ?? 0) > 1 ? 's' : ''} cerrado${(d.blankShifts ?? 0) > 1 ? 's' : ''} sin ningún registro clínico.`);
                if (d.medsOmitted > 0) tips.push(`${d.medsOmitted} medicamento${d.medsOmitted > 1 ? 's' : ''} omitido${d.medsOmitted > 1 ? 's' : ''} sin justificación.`);
                if (d.unclosedSessions > 0) tips.push(`Cierra tu sesión de turno correctamente al terminar.`);
                if (d.incompleteHandovers > 0) tips.push(`Completa el hand-over al cierre de turno.`);
                if (d.rotationsLate > 0) tips.push(`${d.rotationsLate} rotación${d.rotationsLate > 1 ? 'es' : ''} fuera del tiempo establecido.`);
                if (tips.length === 0 && d.medsAdministered > 0) tips.push('Excelente registro. Sigue así para mantener tu puntuación.');
                if (tips.length === 0) tips.push('Registra actividades durante el turno para comenzar a sumar puntos.');

                return (
                    <div className={`max-w-lg mx-auto px-6 mb-8`}>
                        <h2 className="text-white font-bold text-base mb-4">Mi Puntuación</h2>
                        <div className={`bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden ring-1 ${ringClass}`}>
                            {/* Top score strip */}
                            <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-700/60">
                                <div className="flex-1">
                                    <p className="text-slate-400 text-xs uppercase tracking-widest font-medium">Z-Score</p>
                                    <p className={`text-sm font-bold mt-0.5 ${colorClass}`}>{label}</p>
                                </div>
                                <p className={`text-5xl font-black tabular-nums ${colorClass}`}>{s}</p>
                            </div>

                            {/* Formula rows */}
                            <div className="px-5 py-3 space-y-2.5">
                                {rows.map((r, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3">
                                        <p className="text-slate-400 text-xs flex-1">{r.label}</p>
                                        <p className={`text-xs font-bold tabular-nums ${
                                            r.sign === 'pos' ? 'text-emerald-400' :
                                            r.sign === 'neg' ? 'text-rose-400' :
                                            'text-slate-400'
                                        }`}>{r.value}</p>
                                    </div>
                                ))}
                                <div className="border-t border-slate-700 pt-2.5 flex items-center justify-between">
                                    <p className="text-white text-xs font-bold">Total</p>
                                    <p className={`text-sm font-black tabular-nums ${colorClass}`}>{s}</p>
                                </div>
                            </div>

                            {/* Tips */}
                            {tips.length > 0 && (
                                <div className="bg-slate-900/50 border-t border-slate-700/60 px-5 py-3 space-y-1.5">
                                    {tips.map((t, i) => (
                                        <p key={i} className="text-slate-500 text-xs leading-relaxed">· {t}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Certificados */}
            <div className="max-w-lg mx-auto px-6">
                <h2 className="text-white font-bold text-base mb-4">Certificados obtenidos</h2>

                {loading ? (
                    <div className="text-slate-500 text-sm text-center py-8 animate-pulse">Cargando certificados...</div>
                ) : certificates.length === 0 ? (
                    <div className="bg-slate-800 rounded-2xl p-8 text-center border border-slate-700">
                        <p className="text-slate-400 text-sm mb-4">
                            Aun no tienes certificados. Completa un curso en Academy!
                        </p>
                        <Link
                            href="/academy"
                            className="inline-block bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
                        >
                            Ir a Academy
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {certificates.map((cert: any) => (
                            <div
                                key={cert.id}
                                className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4"
                            >
                                <div className="w-10 h-10 bg-teal-900 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-lg">🎓</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold text-sm truncate">
                                        {cert.course?.title || "Curso"}
                                    </p>
                                    <p className="text-slate-400 text-xs">
                                        {cert.completedAt
                                            ? new Date(cert.completedAt).toLocaleDateString("es-PR", {
                                                  year: "numeric",
                                                  month: "long",
                                                  day: "numeric",
                                              })
                                            : "Completado"}
                                    </p>
                                </div>
                                <span className="text-teal-400 text-xs font-bold uppercase tracking-widest flex-shrink-0">
                                    Aprobado
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
