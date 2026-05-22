"use client";

/**
 * /family — Portal Familiar Dashboard
 *
 * Propuesta C: Humanista Suave.
 * Iconos SVG originales de Zéndity, paleta teal-700/teal-500 + stone-50,
 * layout cálido y compacto para acceso rápido en mobile.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    IconAlimentacion,
    IconHigiene,
    IconMedicamentos,
    IconPresion,
    IconTemperatura,
    IconSpO2,
    IconPulso,
    IconMensajes,
    IconCitas,
    IconPAI,
} from "@/components/icons/ZendityIcons";

// ── Helpers ────────────────────────────────────────────────────────────

function fechaLarga(): string {
    return new Date().toLocaleDateString("es-PR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
}

function iniciales(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join("");
}

function timeAgo(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 5) return "justo ahora";
    if (diffMin < 60) return `hace ${diffMin} min`;
    const hour = d.getHours();
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    if (sameDay) {
        if (hour < 12) return "esta mañana";
        if (hour < 18) return "esta tarde";
        return "esta noche";
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getDate() === yesterday.getDate();
    if (isYesterday) {
        if (hour < 12) return "ayer en la mañana";
        if (hour < 18) return "ayer en la tarde";
        return "anoche";
    }
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return d.toLocaleDateString("es-PR", { weekday: "long" });
    return d.toLocaleDateString("es-PR", { day: "numeric", month: "long" });
}

// ── Dashboard ──────────────────────────────────────────────────────────

export default function FamilyDashboard() {
    const [resident, setResident] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/family/dashboard")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setResident(data.resident);
                else setError(data.error || "No se encontraron datos");
                setLoading(false);
            })
            .catch(() => {
                setError("Error de conexión");
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen flex justify-center items-center">
                <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                    <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                </div>
            </div>
        );
    }

    if (error || !resident) {
        return (
            <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen flex flex-col items-center justify-center text-center px-6">
                <h1 className="text-xl font-bold text-slate-800">Bienvenido</h1>
                <p className="text-sm text-slate-500 max-w-sm mt-2 leading-relaxed">
                    {error || "Esta cuenta no tiene residentes asignados. Contacta a la Gerencia."}
                </p>
            </div>
        );
    }

    // Derivar data limpia
    const latestVitals = resident.vitalSigns?.[0];
    const latestLog = resident.dailyLogs?.[0];
    const wellnessNotes: any[] = resident.wellnessNotes ?? [];
    const bathToday = !!latestLog?.bathCompleted;

    // Adaptación: spo2 / heartRate (DB) → SpO₂ / Pulso (UI)
    const safeVitals = latestVitals
        ? {
              systolic: latestVitals.systolic,
              diastolic: latestVitals.diastolic,
              spO2: latestVitals.spo2 ?? "—",
              temperature: latestVitals.temperature,
              pulse: latestVitals.heartRate,
          }
        : null;

    return (
        <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">

            {/* ═══ HEADER ═══════════════════════════════════════════════ */}
            <div className="bg-white border-b border-stone-100 px-4 pt-6 pb-5">

                {/* Top row: brand + fecha */}
                <div className="flex justify-between items-center mb-4 max-w-md mx-auto">
                    <span className="text-xs font-bold text-teal-700 tracking-widest">
                        ZÉNDITY
                    </span>
                    <span className="bg-teal-50 border border-teal-100 rounded-full px-3 py-1 text-xs font-semibold text-teal-700 capitalize">
                        {fechaLarga()}
                    </span>
                </div>

                {/* Avatar */}
                {resident.photoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={resident.photoUrl}
                        alt={resident.name}
                        className="w-16 h-16 rounded-full object-cover border-[3px] border-teal-100 mx-auto mb-3"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 border-2 border-teal-100 flex items-center justify-center mx-auto mb-3">
                        <span className="text-xl font-bold text-teal-700">
                            {iniciales(resident.name)}
                        </span>
                    </div>
                )}

                {/* Nombre + meta */}
                <h1 className="text-xl font-bold text-center text-slate-800 leading-tight">
                    {resident.name}
                </h1>
                <p className="text-xs text-center text-slate-400 mt-1">
                    Habitación {resident.roomNumber || "—"}
                    {" · "}
                    {resident.insurancePlanName || "Plan Activo"}
                </p>
            </div>

            {/* ═══ BODY ═════════════════════════════════════════════════ */}
            <div className="px-4 py-4 space-y-4 max-w-md mx-auto">

                {/* SECCIÓN 1 — Update del equipo de cuidado */}
                <div className="bg-teal-50 rounded-2xl p-4 border border-teal-100">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-bold text-teal-700 tracking-widest uppercase">
                            Del equipo de cuidado
                        </span>
                        <div className="flex-1 h-px bg-teal-100" />
                    </div>

                    {wellnessNotes.length > 0 ? (
                        wellnessNotes.slice(0, 1).map((note: any) => (
                            <div key={note.id}>
                                <p className="text-sm text-slate-600 leading-relaxed italic">
                                    &ldquo;{note.note.replace(/^\[Zendi Update\]\s*/i, "").trim()}&rdquo;
                                </p>
                                <div className="flex items-center gap-1.5 mt-2">
                                    <div className="w-1 h-1 rounded-full bg-teal-500" />
                                    <p className="text-xs text-teal-600">
                                        {note.author?.name || "Equipo de cuidado"} · {timeAgo(note.createdAt)}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-slate-400 italic">
                            El equipo aún no ha publicado notas hoy.
                        </p>
                    )}
                </div>

                {/* SECCIÓN 2 — Vitales con iconos custom */}
                <div>
                    <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                        Signos Vitales
                    </p>
                    {safeVitals ? (
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                {
                                    Icon: IconPresion,
                                    value: `${safeVitals.systolic}/${safeVitals.diastolic}`,
                                    label: "Presión",
                                },
                                {
                                    Icon: IconSpO2,
                                    value: `${safeVitals.spO2}`,
                                    label: "SpO₂",
                                },
                                {
                                    Icon: IconTemperatura,
                                    value: `${safeVitals.temperature}`,
                                    label: "Temp",
                                },
                                {
                                    Icon: IconPulso,
                                    value: `${safeVitals.pulse}`,
                                    label: "Pulso",
                                },
                            ].map(({ Icon, value, label }) => (
                                <div key={label} className="flex flex-col items-center">
                                    <div className="w-14 h-14 rounded-full bg-white border-2 border-teal-50 flex flex-col items-center justify-center mb-1.5 shadow-sm shadow-teal-50">
                                        <Icon size={18} />
                                        <span className="text-[10px] font-bold text-slate-700 leading-none mt-0.5">
                                            {value}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-400">{label}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-slate-400">Vitales del día pendientes</p>
                        </div>
                    )}
                </div>

                {/* SECCIÓN 3 — Reporte del día */}
                <div className="bg-white rounded-2xl p-4 border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                        Reporte de Hoy
                    </p>
                    <div className="grid grid-cols-3">
                        {[
                            {
                                Icon: IconAlimentacion,
                                value: latestLog?.foodIntake != null ? `${latestLog.foodIntake}%` : "—",
                                label: "Comida",
                            },
                            {
                                Icon: IconHigiene,
                                value: bathToday ? "✓" : "—",
                                label: "Higiene",
                            },
                            {
                                Icon: IconMedicamentos,
                                value: "100%",
                                label: "Meds",
                            },
                        ].map(({ Icon, value, label }, i) => (
                            <div
                                key={label}
                                className={`text-center py-2 ${i < 2 ? "border-r border-slate-100" : ""}`}
                            >
                                <div className="flex justify-center mb-1.5">
                                    <Icon size={22} />
                                </div>
                                <p className="text-sm font-bold text-slate-700">{value}</p>
                                <p className="text-xs text-slate-400">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* SECCIÓN 4 — Accesos rápidos */}
                <div>
                    <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                        Accesos Rápidos
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { Icon: IconMensajes, label: "Mensajes", href: "/family/messages" },
                            { Icon: IconCitas, label: "Citas", href: "/family/calendar" },
                            { Icon: IconPAI, label: "Mi PAI", href: "/family/pai" },
                        ].map(({ Icon, label, href }) => (
                            <Link
                                key={label}
                                href={href}
                                className="bg-white border border-slate-100 rounded-2xl p-3 flex flex-col items-center gap-2 hover:border-teal-200 hover:bg-teal-50/30 transition-colors"
                            >
                                <Icon size={24} />
                                <span className="text-xs font-semibold text-slate-600">
                                    {label}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
