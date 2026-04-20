"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
    ArrowLeft, Sparkles, Loader2, Pill, Clock, Activity, ShieldAlert,
    GraduationCap, CalendarX, Trophy, ClipboardCheck, TrendingUp, History,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type Period = 30 | 60 | 90;

interface Findings {
    meds: { total: number; administered: number; missed: number; refused: number; held: number; omitted: number; pending: number; compliancePct: number; avgDelayMinutes: number | null };
    shifts: { total: number; handoverCompleted: number; handoverPct: number };
    vitals: { total: number; critical: number };
    incidents: { total: number; bySeverity: Record<string, number>; pointsDeducted: number; recent: Array<{ description: string; severity: string; createdAt: string }> };
    academy: { assigned: number; completed: number; completionPct: number };
    absences: number;
    ranking: { position: number; totalStaff: number };
}

interface PreviousAudit {
    id: string;
    createdAt: string;
    periodStart: string;
    periodEnd: string;
    systemScore: number;
    humanScore: number | null;
    finalScore: number | null;
    feedback: string | null;
}

interface AuditResponse {
    success: boolean;
    performanceScoreId: string;
    employee: {
        id: string; name: string; role: string; email: string;
        photoUrl: string | null; complianceScore: number; hiredAt: string;
    };
    period: { days: number; start: string; end: string };
    findings: Findings;
    aiReport: string;
    previousAudits: PreviousAudit[];
}

const ROLE_LABEL: Record<string, string> = {
    NURSE: "Enfermera/o", CAREGIVER: "Cuidador/a", SUPERVISOR: "Supervisor/a",
    DIRECTOR: "Director/a", ADMIN: "Admin", MAINTENANCE: "Mantenimiento",
    KITCHEN: "Cocina", CLEANING: "Limpieza", SOCIAL_WORKER: "Trabajador/a Social",
};

function extractRecommendation(report: string): { label: string; tone: "destacado" | "satisfactorio" | "desarrollo" | "accion" | null } {
    const m = report.match(/\[(DESTACADO|SATISFACTORIO|EN DESARROLLO|ACCIÓN REQUERIDA)\]/i);
    if (!m) return { label: "", tone: null };
    const val = m[1].toUpperCase();
    if (val === "DESTACADO") return { label: "DESTACADO", tone: "destacado" };
    if (val === "SATISFACTORIO") return { label: "SATISFACTORIO", tone: "satisfactorio" };
    if (val === "EN DESARROLLO") return { label: "EN DESARROLLO", tone: "desarrollo" };
    return { label: "ACCIÓN REQUERIDA", tone: "accion" };
}

const RECO_STYLES: Record<string, string> = {
    destacado: "bg-emerald-50 border-emerald-300 text-emerald-800",
    satisfactorio: "bg-teal-50 border-teal-300 text-teal-800",
    desarrollo: "bg-amber-50 border-amber-300 text-amber-800",
    accion: "bg-rose-50 border-rose-300 text-rose-800",
};

const SEVERITY_LABEL: Record<string, string> = {
    OBSERVATION: "Observación", WARNING: "Amonestación", SUSPENSION: "Suspensión", TERMINATION: "Despido",
};

export default function HRAuditPage() {
    const params = useParams<{ employeeId: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const employeeId = params?.employeeId as string;

    const [period, setPeriod] = useState<Period>(30);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<AuditResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Panel cierre formal
    const [humanScore, setHumanScore] = useState<number>(0);
    const [useHumanScore, setUseHumanScore] = useState<boolean>(false);
    const [feedback, setFeedback] = useState<string>("");
    const [saving, setSaving] = useState<boolean>(false);
    const [savedMsg, setSavedMsg] = useState<string | null>(null);

    async function generate(days: Period) {
        setLoading(true);
        setError(null);
        setSavedMsg(null);
        try {
            const res = await fetch(`/api/hr/audit-report?employeeId=${employeeId}&days=${days}`);
            const json = await res.json();
            if (!json.success) {
                setError(json.error || "Error generando informe");
                setData(null);
            } else {
                setData(json);
                setHumanScore(json.employee.complianceScore);
                setUseHumanScore(false);
                setFeedback("");
            }
        } catch (e: any) {
            setError(e.message || "Error de conexión");
        } finally {
            setLoading(false);
        }
    }

    async function saveFormalAudit() {
        if (!data) return;
        setSaving(true);
        setSavedMsg(null);
        try {
            const res = await fetch(`/api/hr/audit-report`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    performanceScoreId: data.performanceScoreId,
                    humanScore: useHumanScore ? humanScore : null,
                    feedback: feedback || null,
                }),
            });
            const json = await res.json();
            if (json.success) {
                setSavedMsg("Auditoría formal guardada. Score final registrado en el historial.");
            } else {
                setSavedMsg("Error: " + (json.error || "no se pudo guardar"));
            }
        } catch (e: any) {
            setSavedMsg("Error: " + (e.message || "conexión"));
        } finally {
            setSaving(false);
        }
    }

    // Auto-generar al cargar
    useEffect(() => {
        if (employeeId && !data && !loading) {
            generate(30);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employeeId]);

    const reco = data ? extractRecommendation(data.aiReport) : { label: "", tone: null as any };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">

            {/* Header */}
            <div className="flex items-center justify-between">
                <Link href="/hr" className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-teal-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Volver a Recursos Humanos
                </Link>
                {data && (
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <Sparkles className="w-3.5 h-3.5 text-teal-500" /> Informe Pre-Auditoría Zendi
                    </div>
                )}
            </div>

            {/* Empleado */}
            {data && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
                    {data.employee.photoUrl ? (
                        <img src={data.employee.photoUrl} alt={data.employee.name} className="w-20 h-20 rounded-2xl object-cover ring-4 ring-slate-100" />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-2xl font-black shadow-md">
                            {data.employee.name.substring(0, 2).toUpperCase()}
                        </div>
                    )}
                    <div className="flex-1">
                        <h1 className="text-2xl font-black text-slate-900">{data.employee.name}</h1>
                        <p className="text-slate-500 font-semibold text-sm mt-0.5">{ROLE_LABEL[data.employee.role] || data.employee.role} · {data.employee.email}</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="text-center px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Score</div>
                            <div className={`text-2xl font-black ${data.employee.complianceScore >= 90 ? 'text-emerald-600' : data.employee.complianceScore >= 75 ? 'text-amber-600' : 'text-rose-600'}`}>{data.employee.complianceScore}</div>
                        </div>
                        <div className="text-center px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ranking</div>
                            <div className="text-2xl font-black text-slate-800 flex items-center gap-1"><Trophy className="w-4 h-4 text-amber-500" />#{data.findings.ranking.position}</div>
                            <div className="text-[10px] text-slate-500 font-bold">de {data.findings.ranking.totalStaff}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Selector período + generar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">Período de análisis</h2>
                        <p className="text-xs text-slate-400 font-semibold mt-1">Zendi analizará todos los datos reales del período seleccionado.</p>
                    </div>
                    <div className="flex gap-2">
                        {([30, 60, 90] as Period[]).map(d => (
                            <button
                                key={d}
                                onClick={() => { setPeriod(d); generate(d); }}
                                disabled={loading}
                                className={`px-5 py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${period === d ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-slate-50'}`}
                            >
                                {d} días
                            </button>
                        ))}
                        <button
                            onClick={() => generate(period)}
                            disabled={loading}
                            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-500/20 disabled:opacity-50 flex items-center gap-2 transition-all"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {loading ? 'Generando...' : 'Generar con Zendi'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && !data && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                    <Loader2 className="w-10 h-10 text-teal-500 animate-spin mx-auto mb-4" />
                    <h3 className="font-black text-slate-800 text-lg">Zendi está analizando los datos del turno...</h3>
                    <p className="text-slate-500 font-semibold text-sm mt-2">Agregando medicamentos, turnos, vitales, observaciones HR y Academy.</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6 text-rose-800">
                    <p className="font-bold">Error: {error}</p>
                </div>
            )}

            {/* KPI Cards */}
            {data && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <KpiCard icon={<Pill className="w-4 h-4" />} label="Cumpl. meds" value={`${data.findings.meds.compliancePct}%`} sub={`${data.findings.meds.administered}/${data.findings.meds.total}`} tone={data.findings.meds.compliancePct >= 90 ? 'good' : data.findings.meds.compliancePct >= 75 ? 'warn' : 'bad'} />
                    <KpiCard icon={<ClipboardCheck className="w-4 h-4" />} label="Cierres turno" value={`${data.findings.shifts.handoverPct}%`} sub={`${data.findings.shifts.handoverCompleted}/${data.findings.shifts.total}`} tone={data.findings.shifts.handoverPct >= 90 ? 'good' : data.findings.shifts.handoverPct >= 75 ? 'warn' : 'bad'} />
                    <KpiCard icon={<Activity className="w-4 h-4" />} label="Vitales" value={`${data.findings.vitals.total}`} sub={data.findings.vitals.critical > 0 ? `${data.findings.vitals.critical} críticos` : 'sin críticos'} tone={data.findings.vitals.critical > 0 ? 'warn' : 'good'} />
                    <KpiCard icon={<ShieldAlert className="w-4 h-4" />} label="Obs. HR" value={`${data.findings.incidents.total}`} sub={`-${data.findings.incidents.pointsDeducted} pts`} tone={data.findings.incidents.total === 0 ? 'good' : data.findings.incidents.pointsDeducted > 10 ? 'bad' : 'warn'} />
                    <KpiCard icon={<GraduationCap className="w-4 h-4" />} label="Academy" value={`${data.findings.academy.completionPct}%`} sub={`${data.findings.academy.completed}/${data.findings.academy.assigned}`} tone={data.findings.academy.completionPct >= 90 ? 'good' : data.findings.academy.completionPct >= 50 ? 'warn' : 'bad'} />
                    <KpiCard icon={<CalendarX className="w-4 h-4" />} label="Ausencias" value={`${data.findings.absences}`} sub={`${data.period.days}d`} tone={data.findings.absences === 0 ? 'good' : data.findings.absences <= 2 ? 'warn' : 'bad'} />
                </div>
            )}

            {/* Detalle meds/puntualidad */}
            {data && (data.findings.meds.total > 0 || data.findings.meds.avgDelayMinutes !== null) && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-600">Puntualidad meds:</span>
                        <span className={`font-black ${data.findings.meds.avgDelayMinutes === null ? 'text-slate-400' : Math.abs(data.findings.meds.avgDelayMinutes) <= 15 ? 'text-emerald-600' : Math.abs(data.findings.meds.avgDelayMinutes) <= 30 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {data.findings.meds.avgDelayMinutes === null ? 'sin datos' : `${data.findings.meds.avgDelayMinutes > 0 ? '+' : ''}${data.findings.meds.avgDelayMinutes} min`}
                        </span>
                    </div>
                    <div className="flex gap-4 text-xs font-bold text-slate-500">
                        {data.findings.meds.missed > 0 && <span className="text-rose-600">{data.findings.meds.missed} perdidos</span>}
                        {data.findings.meds.refused > 0 && <span className="text-amber-600">{data.findings.meds.refused} rehusados</span>}
                        {data.findings.meds.held > 0 && <span>{data.findings.meds.held} en hold</span>}
                        {data.findings.meds.omitted > 0 && <span>{data.findings.meds.omitted} omitidos</span>}
                    </div>
                </div>
            )}

            {/* Informe Zendi */}
            {data && data.aiReport && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-teal-300" />
                            </div>
                            <div>
                                <h3 className="font-black text-sm">Informe Pre-Auditoría</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generado por Zendi · GPT-4o-mini</p>
                            </div>
                        </div>
                        {reco.tone && (
                            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${RECO_STYLES[reco.tone]}`}>
                                {reco.label}
                            </span>
                        )}
                    </div>
                    <div className="p-6 md:p-8 prose prose-slate max-w-none prose-headings:font-black prose-headings:text-slate-900 prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:uppercase prose-h2:tracking-wider prose-h2:text-teal-700 prose-li:marker:text-teal-500 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900">
                        <ReactMarkdown>{data.aiReport}</ReactMarkdown>
                    </div>
                </div>
            )}

            {/* Observaciones recientes */}
            {data && data.findings.incidents.recent.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-500" /> Observaciones HR recientes
                    </h3>
                    <div className="space-y-3">
                        {data.findings.incidents.recent.map((i, idx) => (
                            <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">{SEVERITY_LABEL[i.severity] || i.severity}</span>
                                    <span className="text-[10px] font-bold text-slate-500">{new Date(i.createdAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">{i.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Panel cierre formal */}
            {data && (
                <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-md p-6">
                    <h3 className="font-black text-slate-800 text-base mb-1 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-600" /> Cerrar Auditoría Formal
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mb-5">Opcional: el director puede ajustar el score final con su evaluación humana y dejar feedback en el expediente.</p>

                    <label className="flex items-center gap-3 cursor-pointer mb-4">
                        <input
                            type="checkbox"
                            checked={useHumanScore}
                            onChange={e => setUseHumanScore(e.target.checked)}
                            className="w-5 h-5 accent-teal-600"
                        />
                        <span className="text-sm font-bold text-slate-700">Ajustar score manualmente</span>
                    </label>

                    {useHumanScore && (
                        <div className="flex items-center gap-4 mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <input
                                type="range"
                                min={0} max={100}
                                value={humanScore}
                                onChange={e => setHumanScore(parseInt(e.target.value))}
                                className="flex-1 accent-teal-600"
                            />
                            <div className={`w-20 h-16 rounded-xl flex flex-col items-center justify-center border-2 font-black shadow-sm ${humanScore >= 90 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : humanScore >= 75 ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                                <span className="text-xl">{humanScore}</span>
                                <span className="text-[9px] font-bold opacity-60 uppercase tracking-widest leading-none">Pts</span>
                            </div>
                        </div>
                    )}

                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Feedback del evaluador</label>
                    <textarea
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        rows={4}
                        placeholder="Comentarios de la auditoría formal (quedarán en el expediente del empleado)..."
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm font-medium text-slate-700"
                    />

                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                        <p className="text-[11px] text-slate-500 font-semibold">
                            {useHumanScore
                                ? <>Score final = <span className="font-black text-teal-700">{humanScore}</span> (ajuste manual)</>
                                : <>Score final = <span className="font-black text-slate-700">{data.employee.complianceScore}</span> (sistema)</>}
                        </p>
                        <button
                            onClick={saveFormalAudit}
                            disabled={saving}
                            className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-sm shadow-lg disabled:opacity-50 transition-all"
                        >
                            {saving ? 'Guardando...' : 'Guardar Auditoría Formal'}
                        </button>
                    </div>

                    {savedMsg && (
                        <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-bold ${savedMsg.startsWith('Error') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                            {savedMsg}
                        </div>
                    )}
                </div>
            )}

            {/* Historial */}
            {data && data.previousAudits.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-500" /> Auditorías previas
                    </h3>
                    <div className="divide-y divide-slate-100">
                        {data.previousAudits.map(p => (
                            <div key={p.id} className="flex items-center justify-between py-3 text-sm">
                                <div>
                                    <p className="font-bold text-slate-800">{new Date(p.createdAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                    <p className="text-[11px] text-slate-500 font-semibold">
                                        {new Date(p.periodStart).toLocaleDateString('es-PR', { day: '2-digit', month: 'short' })} → {new Date(p.periodEnd).toLocaleDateString('es-PR', { day: '2-digit', month: 'short' })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">sistema</span>
                                    <span className="font-black text-slate-700">{Math.round(p.systemScore)}</span>
                                    {p.finalScore !== null && (
                                        <>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">final</span>
                                            <span className={`font-black ${p.finalScore >= 90 ? 'text-emerald-600' : p.finalScore >= 75 ? 'text-amber-600' : 'text-rose-600'}`}>{Math.round(p.finalScore)}</span>
                                        </>
                                    )}
                                    {p.finalScore === null && (
                                        <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-2 py-1 rounded">borrador</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function KpiCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone: 'good' | 'warn' | 'bad' }) {
    const tones: Record<string, string> = {
        good: 'from-emerald-50 to-white border-emerald-200 text-emerald-700',
        warn: 'from-amber-50 to-white border-amber-200 text-amber-700',
        bad: 'from-rose-50 to-white border-rose-200 text-rose-700',
    };
    return (
        <div className={`rounded-xl border-2 bg-gradient-to-br p-3 shadow-sm ${tones[tone]}`}>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest opacity-80">
                {icon}
                {label}
            </div>
            <div className="mt-1.5 text-2xl font-black">{value}</div>
            <div className="text-[10px] font-bold opacity-70 mt-0.5">{sub}</div>
        </div>
    );
}
