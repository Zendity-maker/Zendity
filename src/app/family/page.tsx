"use client";

/**
 * /family — Portal Familiar Dashboard
 *
 * Estilo: "retiro de lujo" (Vivid theme) — jerarquía emocional.
 * Foto del residente como HERO. Card "El día de…" prominente arriba.
 * Banda de signos como estado ambiental sutil. "Reporte" → "Su día"
 * (renombrado, ahora secundario, más abajo).
 *
 * Tema POR TENANT vía CSS vars del layout (lib/family/theme.ts).
 * Vivid: navy + lima + crema. Default: teal Zéndity.
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
    const [digest, setDigest] = useState<any>(null);
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

        // Canal ambiental: resumen narrativo del día (no bloquea el render)
        fetch("/api/family/digest")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setDigest(data.digest);
            })
            .catch(() => {});
    }, []);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex justify-center items-center">
                <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--brand-primary)' }} />
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--brand-primary)', animationDelay: "0.15s" }} />
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--brand-primary)', animationDelay: "0.3s" }} />
                </div>
            </div>
        );
    }

    if (error || !resident) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
                <h1 className="text-xl font-serif font-semibold text-slate-800">Bienvenido</h1>
                <p className="text-sm text-slate-500 max-w-sm mt-2 leading-relaxed">
                    {error || "Esta cuenta no tiene residentes asignados. Contacta a la Gerencia."}
                </p>
            </div>
        );
    }

    const latestLog = resident.dailyLogs?.[0];
    const wellnessNotes: any[] = resident.wellnessNotes ?? [];
    const bathToday = !!latestLog?.bathCompleted;

    // shareLevel + wellness los define el servidor (lib/family/disclosure)
    const shareLevel: string = resident.shareLevel ?? "LIFESTYLE";
    const wellness = resident.wellness ?? {};

    // Adaptación: spo2 / heartRate (DB) → SpO₂ / Pulso (UI) — solo en FULL
    const latestVitals = shareLevel === "FULL" ? resident.vitalSigns?.[0] : null;
    const safeVitals = latestVitals
        ? {
              systolic: latestVitals.systolic,
              diastolic: latestVitals.diastolic,
              spO2: latestVitals.spo2 ?? "—",
              temperature: latestVitals.temperature,
              pulse: latestVitals.heartRate,
          }
        : null;

    // Última nota del equipo (después del filtro de disclosure en el server)
    const ultimaNota = wellnessNotes[0] ?? null;

    const firstName = resident.name?.split(/\s+/)[0] || "tu familiar";
    const tieneFoto = !!resident.photoUrl;

    return (
        <div className="max-w-2xl mx-auto px-4 -my-4 sm:-my-8 md:-my-12 -mx-4 sm:-mx-6 lg:-mx-8">

            {/* ═══ HEADER MINIMAL — fecha sutil arriba ═══════════════════════ */}
            <div className="text-center pt-8 pb-4 px-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-medium capitalize">
                    {fechaLarga()}
                </p>
            </div>

            {/* ═══ HÉROE — foto grande del residente ═══════════════════════ */}
            <section className="flex flex-col items-center text-center px-4 pb-8">
                {tieneFoto ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={resident.photoUrl}
                        alt={resident.name}
                        className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover mb-4 ring-4 ring-white"
                        style={{ boxShadow: '0 12px 32px -8px rgba(28, 49, 112, 0.18)' }}
                    />
                ) : (
                    <div
                        className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center mb-4 ring-4 ring-white"
                        style={{
                            background: 'linear-gradient(135deg, var(--brand-secondary) 0%, var(--brand-primary) 100%)',
                            boxShadow: '0 12px 32px -8px rgba(28, 49, 112, 0.25)',
                        }}
                    >
                        <span className="font-serif text-4xl sm:text-5xl text-white tracking-tight">
                            {iniciales(resident.name)}
                        </span>
                    </div>
                )}

                <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-slate-800 leading-tight">
                    {resident.name?.trim()}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Habitación {resident.roomNumber || "—"}
                </p>
            </section>

            {/* ═══ BODY ═════════════════════════════════════════════════════ */}
            <div className="px-4 pb-12 space-y-5">

                {/* ── 1. EL DÍA DE… (digest narrativo) — tratamiento más cálido ── */}
                {digest?.narrative && (
                    <article
                        className="rounded-3xl px-6 py-7 sm:px-8 sm:py-8"
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.7)',
                            border: '1px solid rgba(140, 187, 232, 0.25)',
                            boxShadow: '0 4px 24px -8px rgba(28, 49, 112, 0.08)',
                        }}
                    >
                        <p
                            className="text-[11px] uppercase tracking-[0.25em] font-semibold mb-3"
                            style={{ color: 'var(--brand-primary)' }}
                        >
                            El día de {firstName}
                        </p>
                        <p className="font-serif text-[17px] sm:text-lg text-slate-700 leading-relaxed">
                            {digest.narrative}
                        </p>
                    </article>
                )}

                {/* ── 2. ÚLTIMA NOTA DEL EQUIPO — mensaje personal, prominente ── */}
                {ultimaNota && (
                    <article className="bg-white rounded-2xl px-5 py-5 sm:px-6 sm:py-6 border border-stone-100">
                        <div className="flex items-center gap-2 mb-3">
                            <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: 'var(--brand-accent)' }}
                            />
                            <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-500">
                                Mensaje del equipo
                            </p>
                        </div>
                        <p className="text-[15px] text-slate-700 leading-relaxed">
                            {ultimaNota.note.replace(/^\[Zendi Update\]\s*/i, "").trim()}
                        </p>
                        <p className="mt-3 text-xs text-slate-400">
                            {ultimaNota.author?.name || "Equipo de cuidado"} · {timeAgo(ultimaNota.createdAt)}
                        </p>
                    </article>
                )}

                {/* ── 3. ESTADO AMBIENTAL — banda sutil de signos (LIFESTYLE) ── */}
                {/*    En FULL muestra grilla. En LIFESTYLE muestra una línea-status. */}
                {shareLevel === "FULL" && safeVitals ? (
                    <section className="bg-white rounded-2xl p-5 border border-stone-100">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-medium mb-4">
                            Signos vitales
                        </p>
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { Icon: IconPresion,      value: `${safeVitals.systolic}/${safeVitals.diastolic}`, label: "Presión" },
                                { Icon: IconSpO2,         value: `${safeVitals.spO2}`,                              label: "SpO₂" },
                                { Icon: IconTemperatura,  value: `${safeVitals.temperature}`,                       label: "Temp" },
                                { Icon: IconPulso,        value: `${safeVitals.pulse}`,                             label: "Pulso" },
                            ].map(({ Icon, value, label }) => (
                                <div key={label} className="flex flex-col items-center text-center">
                                    <div style={{ color: 'var(--brand-primary)' }}>
                                        <Icon size={28} />
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-700 leading-none mt-1.5">
                                        {value}
                                    </span>
                                    <span className="text-[10px] text-slate-400 mt-0.5">{label}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : (
                    /* LIFESTYLE — solo una línea de status ambiental, no card prominente */
                    <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-slate-500">
                        <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: 'var(--brand-accent)' }}
                        />
                        <span>
                            {wellness.vitalsBand || "Sus signos están estables, monitoreados por su equipo."}
                        </span>
                    </div>
                )}

                {/* ── 4. SU DÍA — grid secundario, suave ── */}
                <section className="bg-white rounded-2xl px-5 py-5 border border-stone-100">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-medium mb-4">
                        Su día
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            {
                                Icon: IconAlimentacion,
                                value:
                                    shareLevel === "FULL"
                                        ? latestLog?.foodIntake != null
                                            ? `${latestLog.foodIntake}%`
                                            : "—"
                                        : wellness.foodBand
                                          ? ({ bien: "Bien", parcial: "Parcial", poco: "Poco" } as Record<string, string>)[wellness.foodBand]
                                          : "—",
                                label: "Comida",
                                highlight: wellness.foodBand === "bien",
                            },
                            {
                                Icon: IconHigiene,
                                value: bathToday ? "✓" : "—",
                                label: "Higiene",
                                highlight: bathToday,
                            },
                            {
                                Icon: IconMedicamentos,
                                value:
                                    shareLevel === "FULL"
                                        ? wellness.medsOnTrack === true
                                            ? "Al día"
                                            : wellness.medsOnTrack === false
                                              ? "Revisar"
                                              : "—"
                                        : wellness.medsOnTrack === true
                                          ? "Al día"
                                          : "—",
                                label: "Meds",
                                highlight: wellness.medsOnTrack === true,
                            },
                        ].map(({ Icon, value, label, highlight }, i) => (
                            <div
                                key={label}
                                className={`text-center py-2 ${i < 2 ? "border-r border-stone-100" : ""}`}
                            >
                                <div
                                    className="flex justify-center mb-2"
                                    style={{ color: 'var(--brand-primary)' }}
                                >
                                    <Icon size={34} />
                                </div>
                                <p
                                    className="text-sm font-semibold"
                                    style={{
                                        color: highlight ? 'var(--brand-primary)' : '#475569',
                                    }}
                                >
                                    {value}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── 5. ACCESOS — chips horizontales en lugar de tres cuadrados ── */}
                <nav className="grid grid-cols-3 gap-3 pt-2">
                    {[
                        { Icon: IconMensajes, label: "Mensajes", href: "/family/messages" },
                        { Icon: IconCitas, label: "Citas", href: "/family/calendar" },
                        { Icon: IconPAI, label: "Mi PAI", href: "/family/pai" },
                    ].map(({ Icon, label, href }) => (
                        <Link
                            key={label}
                            href={href}
                            className="bg-white border border-stone-100 rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-[color:var(--brand-secondary)] transition-colors"
                        >
                            {/* Contenedor circular con tinte suave de marca — ancla el icono en la card */}
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center mb-1"
                                style={{
                                    backgroundColor: 'color-mix(in srgb, var(--brand-secondary) 16%, transparent)',
                                    color: 'var(--brand-primary)',
                                }}
                            >
                                <Icon size={32} />
                            </div>
                            <span className="text-xs font-medium text-slate-600">
                                {label}
                            </span>
                        </Link>
                    ))}
                </nav>
            </div>
        </div>
    );
}
