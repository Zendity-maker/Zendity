"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
    ArrowLeft, CheckCircle2, Loader2, ShieldAlert, PenSquare, Clock,
    AlertTriangle, FileText, Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ─────────────────────────────────────────────────────────────────────────
// Tipos del payload de /api/care/reports/[id]
// ─────────────────────────────────────────────────────────────────────────
interface ReportNote {
    id: string;
    patientId: string;
    clinicalNotes: string;
    isCritical: boolean;
    patient?: { id: string; name: string; roomNumber: string | null } | null;
}

interface ReportDetail {
    id: string;
    shiftType: string;
    status: string;
    createdAt: string;
    signedOutAt: string | null;
    seniorConfirmedAt: string | null;
    supervisorSignedAt: string | null;
    handoverCompleted: boolean;
    aiSummaryReport: string | null;
    colorGroups: string[];
    isDailyPrologue: boolean;
    supervisorNote: string | null;
    supervisorSignature: string | null;
    seniorNote: string | null;
    outgoingNurse?: { id: string; name: string; role: string } | null;
    incomingNurse?: { id: string; name: string; role: string } | null;
    seniorCaregiver?: { id: string; name: string; role: string } | null;
    supervisorSigned?: { id: string; name: string; role: string } | null;
    notes: ReportNote[];
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────
const SHIFT_LABEL: Record<string, string> = {
    MORNING: "Turno Diurno (6:00 AM – 2:00 PM)",
    EVENING: "Turno Vespertino (2:00 PM – 10:00 PM)",
    NIGHT: "Turno Nocturno (10:00 PM – 6:00 AM)",
};

const COLOR_CHIP: Record<string, string> = {
    RED: "bg-rose-100 text-rose-700 border-rose-200",
    YELLOW: "bg-amber-100 text-amber-700 border-amber-200",
    GREEN: "bg-emerald-100 text-emerald-700 border-emerald-200",
    BLUE: "bg-sky-100 text-sky-700 border-sky-200",
    UNASSIGNED: "bg-slate-100 text-slate-600 border-slate-200",
};

const ALLOWED_ROLES = ["SUPERVISOR", "DIRECTOR", "ADMIN", "SUPER_ADMIN"];

const formatDateTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-PR", {
        dateStyle: "medium",
        timeStyle: "short",
    });
};

const deriveStatus = (r: ReportDetail): "PENDING_CONFIRMATION" | "CONFIRMED" | "SUPERVISOR_SIGNED" => {
    if (r.supervisorSignedAt) return "SUPERVISOR_SIGNED";
    if (r.seniorConfirmedAt) return "CONFIRMED";
    return "PENDING_CONFIRMATION";
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    PENDING_CONFIRMATION: {
        label: "Pendiente confirmación",
        className: "bg-slate-200 text-slate-700 border-slate-300",
    },
    CONFIRMED: {
        label: "Pendiente firma supervisor",
        className: "bg-amber-100 text-amber-800 border-amber-200",
    },
    SUPERVISOR_SIGNED: {
        label: "Firmado por supervisor",
        className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
};

// ─────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────
export default function ReportDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const reportId = params?.id;
    const { user, loading: authLoading } = useAuth();

    const [report, setReport] = useState<ReportDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // ── Auth gate ──
    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace("/login");
            return;
        }
        if (!ALLOWED_ROLES.includes(user.role ?? "")) {
            router.replace("/care/supervisor");
        }
    }, [user, authLoading, router]);

    // ── Fetch ──
    useEffect(() => {
        if (!reportId) return;
        if (!user || !ALLOWED_ROLES.includes(user.role ?? "")) return;

        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/care/reports/${reportId}`, { cache: "no-store" });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || "No se pudo cargar el reporte");
                }
                if (!cancelled) setReport(data.report as ReportDetail);
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Error cargando reporte");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [reportId, user]);

    const handleSign = async () => {
        if (!report || !user) return;
        if (!report.seniorConfirmedAt) {
            setError("El cuidador(a) aún no ha confirmado su reporte.");
            return;
        }

        // Firma auto-generada — nombre + id + timestamp ISO (>=10 chars garantizado)
        const signature = `${user.name}·${report.id}·${new Date().toISOString()}`;

        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/care/reports/${report.id}/sign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signature, note: note.trim() || undefined }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "No se pudo firmar el reporte");
            }
            setSuccessMsg("Reporte firmado. Redirigiendo…");
            setTimeout(() => router.push("/care/supervisor"), 900);
        } catch (e: any) {
            setError(e.message || "Error firmando el reporte");
        } finally {
            setSubmitting(false);
        }
    };

    // ── Estados de carga / error ──
    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fafaf9" }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#0F6B78" }} />
            </div>
        );
    }

    if (error && !report) {
        return (
            <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#fafaf9" }}>
                <div className="max-w-md bg-white rounded-2xl p-8 shadow-sm border border-rose-200">
                    <div className="flex items-center gap-3 mb-3">
                        <ShieldAlert className="w-6 h-6 text-rose-500" />
                        <h2 className="text-lg font-bold" style={{ color: "#1F2D3A" }}>No se pudo cargar</h2>
                    </div>
                    <p className="text-sm text-slate-600 mb-5">{error}</p>
                    <Link
                        href="/care/supervisor"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition"
                        style={{ backgroundColor: "#0F6B78" }}
                    >
                        <ArrowLeft className="w-4 h-4" /> Volver al panel
                    </Link>
                </div>
            </div>
        );
    }

    if (!report) return null;

    const status = deriveStatus(report);
    const badge = STATUS_BADGE[status];
    const signedOutLabel = report.signedOutAt || report.createdAt;
    const outgoingName = report.outgoingNurse?.name || "Cuidador(a)";

    return (
        <div className="min-h-screen py-10 px-4 md:px-8" style={{ backgroundColor: "#fafaf9" }}>
            <div className="max-w-4xl mx-auto">

                {/* ── Header ── */}
                <div className="mb-8">
                    <Link
                        href="/care/supervisor"
                        className="inline-flex items-center gap-2 text-sm font-medium mb-6 hover:underline"
                        style={{ color: "#0F6B78" }}
                    >
                        <ArrowLeft className="w-4 h-4" /> Volver al panel del supervisor
                    </Link>

                    <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#0F6B78" }}>
                                    <FileText className="w-3.5 h-3.5" /> Reporte de cierre de turno
                                </div>
                                <h1 className="text-2xl md:text-3xl font-black mb-1" style={{ color: "#1F2D3A" }}>
                                    {outgoingName}
                                </h1>
                                <p className="text-sm text-slate-600">
                                    {SHIFT_LABEL[report.shiftType] || report.shiftType} · {formatDateTime(signedOutLabel)}
                                </p>
                            </div>

                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${badge.className}`}>
                                {status === "SUPERVISOR_SIGNED" && <CheckCircle2 className="w-3.5 h-3.5" />}
                                {status === "CONFIRMED" && <Clock className="w-3.5 h-3.5" />}
                                {status === "PENDING_CONFIRMATION" && <AlertTriangle className="w-3.5 h-3.5" />}
                                {badge.label}
                            </span>
                        </div>

                        {report.colorGroups.length > 0 && (
                            <div className="mt-5 flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Colores cubiertos:</span>
                                {report.colorGroups.map(c => (
                                    <span
                                        key={c}
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${COLOR_CHIP[c] || COLOR_CHIP.UNASSIGNED}`}
                                    >
                                        {c}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── 1. Resumen Zendi ── */}
                <section className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200 mb-6">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#0F6B78" }}>
                        <FileText className="w-3.5 h-3.5" /> Resumen Zendi
                    </div>
                    {report.aiSummaryReport ? (
                        <div
                            className="prose prose-sm max-w-none prose-p:leading-relaxed prose-strong:font-bold"
                            style={{ color: "#1F2D3A" }}
                        >
                            <ReactMarkdown>{report.aiSummaryReport}</ReactMarkdown>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 italic">Sin resumen generado para este reporte.</p>
                    )}
                </section>

                {/* ── 2. Notas por residente ── */}
                {report.notes.length > 0 && (
                    <section className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200 mb-6">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#0F6B78" }}>
                            <Users className="w-3.5 h-3.5" /> Notas por residente ({report.notes.length})
                        </div>
                        <ul className="space-y-3">
                            {report.notes.map(n => (
                                <li
                                    key={n.id}
                                    className={`p-4 rounded-2xl border ${n.isCritical ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200"}`}
                                >
                                    <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
                                        <div className="font-bold text-sm" style={{ color: "#1F2D3A" }}>
                                            {n.patient?.name || "Residente"}
                                            {n.patient?.roomNumber && (
                                                <span className="ml-2 text-slate-500 font-medium text-xs">Hab. {n.patient.roomNumber}</span>
                                            )}
                                        </div>
                                        {n.isCritical && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 text-[10px] font-bold uppercase tracking-wider">
                                                <AlertTriangle className="w-3 h-3" /> Crítico
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.clinicalNotes}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* ── 3. Panel de firma o sello ── */}
                {status === "SUPERVISOR_SIGNED" ? (
                    <section className="bg-emerald-50 rounded-3xl p-7 shadow-sm border border-emerald-200">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-bold text-emerald-900">
                                    Firmado por {report.supervisorSigned?.name || "Supervisor"}
                                </h3>
                                <p className="text-sm text-emerald-800 mt-1">
                                    {formatDateTime(report.supervisorSignedAt)}
                                </p>
                                {report.supervisorNote && (
                                    <div className="mt-4 p-4 bg-white rounded-xl border border-emerald-200">
                                        <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">Nota del supervisor</p>
                                        <p className="text-sm whitespace-pre-wrap" style={{ color: "#1F2D3A" }}>{report.supervisorNote}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                ) : (
                    <section className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#0F6B78" }}>
                            <PenSquare className="w-3.5 h-3.5" /> Firma del supervisor
                        </div>

                        {status === "PENDING_CONFIRMATION" && (
                            <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-900">
                                    El cuidador(a) aún no ha confirmado su reporte. Al firmar el cierre de turno, la firma se habilitará automáticamente.
                                </p>
                            </div>
                        )}

                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#1F2D3A" }}>
                            Nota del supervisor (opcional)
                        </label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={4}
                            placeholder="Observaciones, seguimientos, recordatorios para el próximo turno…"
                            className="w-full text-sm rounded-2xl border border-slate-300 px-4 py-3 focus:outline-none focus:border-[#0F6B78] focus:ring-2 focus:ring-[#0F6B78]/20 resize-none"
                            style={{ color: "#1F2D3A", backgroundColor: "#fafaf9" }}
                            disabled={submitting || !!successMsg}
                        />

                        {error && (
                            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> {successMsg}
                            </div>
                        )}

                        <button
                            onClick={handleSign}
                            disabled={submitting || !!successMsg || status === "PENDING_CONFIRMATION"}
                            className="mt-5 w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                            style={{ backgroundColor: "#0F6B78" }}
                        >
                            {submitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Firmando…</>
                            ) : (
                                <><PenSquare className="w-4 h-4" /> Firmar Reporte</>
                            )}
                        </button>
                    </section>
                )}
            </div>
        </div>
    );
}
