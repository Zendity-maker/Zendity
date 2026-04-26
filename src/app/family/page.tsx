"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ── Helper: tiempo relativo ────────────────────────────────────────────────
function timeAgo(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 60) return `hace ${diff} min`;
    if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
    return `hace ${Math.floor(diff / 1440)} días`;
}

// ── Helper: fecha larga en español ────────────────────────────────────────
function fechaLarga(): string {
    return new Date().toLocaleDateString("es-PR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
}

export default function FamilyDashboard() {
    const [resident, setResident] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/family/dashboard")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setResident(data.resident);
                } else {
                    setError(data.error || "No se encontraron datos");
                }
                setLoading(false);
            })
            .catch(() => {
                setError("Error de conexión");
                setLoading(false);
            });
    }, []);

    if (loading)
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500" />
            </div>
        );

    if (error || !resident)
        return (
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-100 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-3xl mb-4">👤</div>
                <h3 className="text-xl font-bold text-slate-800">Bienvenido al Portal Familiar</h3>
                <p className="text-slate-500 mt-2">
                    {error || "Esta cuenta no tiene residentes asignados. Contacta a Gerencia."}
                </p>
            </div>
        );

    const latestVitals = resident.vitalSigns?.[0];
    const latestLog = resident.dailyLogs?.[0];
    const wellnessNotes: any[] = resident.wellnessNotes ?? [];

    const vitals = latestVitals
        ? [
              { icon: "❤️", label: "Presión",     value: `${latestVitals.systolic}/${latestVitals.diastolic}` },
              { icon: "💨", label: "SpO₂",         value: latestVitals.spo2 != null ? `${latestVitals.spo2}%` : "—" },
              { icon: "🌡️", label: "Temperatura",  value: `${latestVitals.temperature}°` },
              { icon: "💓", label: "Pulso",        value: `${latestVitals.heartRate} bpm` },
          ]
        : [];

    const quickLinks = [
        { icon: "💬", label: "Mensajes", href: "/family/messages", color: "bg-blue-50 border-blue-100" },
        { icon: "📅", label: "Citas",    href: "/family/calendar", color: "bg-amber-50 border-amber-100" },
        { icon: "📋", label: "Mi PAI",   href: "/family/pai",      color: "bg-teal-50 border-teal-100"  },
    ];

    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500 pb-4">

            {/* ── SECCIÓN 1 — Header compacto ──────────────────────────────── */}
            <div className="bg-white border-b border-slate-100 px-4 py-4 -mx-4 -mt-8 sm:-mx-6 sm:-mt-12 mb-4">
                <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto">
                    <div className="min-w-0">
                        <p className="text-xs text-gray-400 capitalize">{fechaLarga()}</p>
                        <h1 className="text-lg font-semibold text-slate-800 leading-snug truncate">{resident.name}</h1>
                        <p className="text-sm text-gray-500">
                            Habitación {resident.roomNumber || "No asignada"} ·{" "}
                            {resident.insurancePlanName || (resident.lifePlan ? "Plan Activo" : "Plan Pendiente")}
                        </p>
                    </div>
                    {resident.photoUrl ? (
                        <img
                            src={resident.photoUrl}
                            alt={resident.name}
                            className="w-14 h-14 rounded-full object-cover border-2 border-teal-200 flex-shrink-0"
                        />
                    ) : (
                        <div className="w-14 h-14 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl">👤</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── SECCIÓN 2 — Zendi Updates (primero) ──────────────────────── */}
            {wellnessNotes.length > 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">💚</span>
                        <h2 className="font-semibold text-emerald-800 text-sm">Últimas noticias del equipo</h2>
                    </div>
                    {wellnessNotes.slice(0, 2).map((note: any, idx: number) => (
                        <div key={idx} className="mb-3 last:mb-0">
                            <p className="text-sm text-emerald-700 leading-relaxed">
                                {note.note.replace(/^\[Zendi Update\]\s*/i, "")}
                            </p>
                            <p className="text-xs text-emerald-500 mt-1">
                                — {note.author?.name || "Equipo de cuidado"} · {timeAgo(note.createdAt)}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center mb-4">
                    <p className="text-sm text-gray-400">El equipo aún no ha enviado actualizaciones hoy</p>
                </div>
            )}

            {/* ── SECCIÓN 3 — Signos vitales compactos ─────────────────────── */}
            <div className="mb-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Signos Vitales Recientes
                </h2>
                {latestVitals ? (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            {vitals.map((v) => (
                                <div
                                    key={v.label}
                                    className="bg-white border border-gray-100 rounded-lg p-3 flex items-center gap-2"
                                >
                                    <span className="text-lg">{v.icon}</span>
                                    <div>
                                        <p className="text-xs text-gray-400">{v.label}</p>
                                        <p className="text-sm font-semibold text-slate-700">{v.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-300 text-right mt-1">
                            {timeAgo(latestVitals.createdAt)}
                        </p>
                    </>
                ) : (
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400">Vitales del día pendientes de registro</p>
                    </div>
                )}
            </div>

            {/* ── SECCIÓN 4 — Reporte del día compacto ─────────────────────── */}
            <div className="mb-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Reporte de Hoy
                </h2>
                <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <span className="text-2xl">🍽️</span>
                            <p className="text-xs text-gray-400 mt-1">Alimentación</p>
                            <p className="text-sm font-semibold text-slate-700">
                                {latestLog?.foodIntake != null ? `${latestLog.foodIntake}%` : "—"}
                            </p>
                        </div>
                        <div className="text-center">
                            <span className="text-2xl">🛁</span>
                            <p className="text-xs text-gray-400 mt-1">Higiene</p>
                            <p className="text-sm font-semibold text-slate-700">
                                {latestLog?.bathCompleted ? "✓ Completo" : "Pendiente"}
                            </p>
                        </div>
                        <div className="text-center">
                            <span className="text-2xl">📝</span>
                            <p className="text-xs text-gray-400 mt-1">Observaciones</p>
                            <p className="text-xs text-slate-600 leading-tight">
                                {latestLog?.notes?.trim()
                                    ? latestLog.notes.trim().slice(0, 30) + (latestLog.notes.trim().length > 30 ? "..." : "")
                                    : "Sin notas"}
                            </p>
                        </div>
                    </div>
                    {latestLog && (
                        <p className="text-xs text-gray-300 text-center mt-3">
                            Último registro: {timeAgo(latestLog.createdAt)}
                        </p>
                    )}
                </div>
            </div>

            {/* ── SECCIÓN 5 — Accesos rápidos ──────────────────────────────── */}
            <div className="mb-8">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Accesos Rápidos
                </h2>
                <div className="grid grid-cols-3 gap-3">
                    {quickLinks.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${item.color} border rounded-xl p-3 text-center flex flex-col items-center gap-1 hover:opacity-80 transition-opacity`}
                        >
                            <span className="text-2xl">{item.icon}</span>
                            <span className="text-xs font-medium text-slate-600">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
