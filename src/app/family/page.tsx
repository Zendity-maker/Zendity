"use client";

/**
 * /family/preview — Editorial Calm
 *
 * Magazine-style. Serif display protagonista. Narrativa en lugar de data.
 * Hairline dividers en lugar de cards. Mucho whitespace.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

// ── Tiempo humano ──
function humanTime(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    const hour = d.getHours();

    if (diffMin < 5) return "justo ahora";
    if (diffMin < 60) return `hace ${diffMin} minutos`;

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

function fechaHoyLarga(): string {
    return new Date().toLocaleDateString("es-PR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
}

function getMonogram(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}

// ── Hairline section divider ──
function Diamond() {
    return (
        <div className="flex justify-center py-12">
            <span className="text-stone-300 text-base tracking-[1em]">◆ ◆ ◆</span>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-6 text-center">
            {children}
        </p>
    );
}

export default function FamilyDashboardEditorial() {
    const [resident, setResident] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        fetch("/api/family/dashboard")
            .then((r) => r.json())
            .then((data) => {
                if (data.success) setResident(data.resident);
                else setError(data.error || "No se encontraron datos");
                setLoading(false);
            })
            .catch(() => {
                setError("Error de conexión");
                setLoading(false);
            });

        fetch("/api/family/unread")
            .then((r) => r.json())
            .then((d) => setUnreadCount(d.count || 0))
            .catch(() => {});
    }, []);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <span className="font-serif italic text-stone-300 text-lg">cargando…</span>
            </div>
        );
    }

    if (error || !resident) {
        return (
            <div className="text-center py-32">
                <p className="font-serif text-3xl text-stone-700 italic mb-3">Bienvenido</p>
                <p className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">
                    {error || "Esta cuenta no tiene residentes asignados. Contacta a la Gerencia."}
                </p>
            </div>
        );
    }

    const latestVitals = resident.vitalSigns?.[0];
    const latestLog = resident.dailyLogs?.[0];
    const wellnessNotes: any[] = resident.wellnessNotes ?? [];
    const firstName = resident.name?.split(" ")[0] || "tu familiar";

    const quickLinks = [
        { label: "Diario", href: "/family/feed", note: "Notas y fotos del equipo" },
        { label: "Mensajes", href: "/family/messages", note: unreadCount > 0 ? `${unreadCount} sin leer` : "Conversación con cuidadores" },
        { label: "Citas", href: "/family/calendar", note: "Visitas y servicios" },
        { label: "Mi PAI", href: "/family/pai", note: "Plan de cuidado integral" },
    ];

    return (
        <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">
            <div className="max-w-2xl mx-auto px-6 sm:px-10 py-16 sm:py-24">

                {/* ═══ MASTHEAD — dateline editorial ═══════════════════════ */}
                <header className="text-center mb-16 sm:mb-20">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-medium mb-2 capitalize">
                        {fechaHoyLarga()}
                    </p>
                    <p className="font-serif italic text-stone-400 text-sm mb-12">
                        Diario de cuidado · {resident.headquarters?.name || "Zéndity"}
                    </p>

                    {/* Foto o monograma */}
                    <div className="flex justify-center mb-10">
                        {resident.photoUrl ? (
                            <img
                                src={resident.photoUrl}
                                alt={resident.name}
                                className="w-36 h-36 rounded-full object-cover grayscale-[0.15]"
                                style={{
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 24px 48px -16px rgba(15,110,120,0.18)",
                                }}
                            />
                        ) : (
                            <div className="w-36 h-36 rounded-full flex items-center justify-center bg-stone-100 ring-1 ring-stone-200">
                                <span
                                    className="font-serif text-5xl tracking-tight"
                                    style={{ color: "#0F6E56", fontStyle: "italic" }}
                                >
                                    {getMonogram(resident.name)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Headline tipo magazine */}
                    <h1
                        className="font-serif text-stone-900 leading-[1.05] tracking-tight mb-4"
                        style={{
                            fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
                            fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                        }}
                    >
                        {resident.name}
                    </h1>

                    {/* Hairline divider con ornamento */}
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <span className="block w-12 h-px bg-stone-300" />
                        <span className="text-stone-300 text-xs">◆</span>
                        <span className="block w-12 h-px bg-stone-300" />
                    </div>

                    <p className="font-serif italic text-stone-500 text-base">
                        Habitación {resident.roomNumber || "—"}
                        {resident.insurancePlanName && (
                            <>
                                <span className="mx-2 text-stone-300">·</span>
                                <span>{resident.insurancePlanName}</span>
                            </>
                        )}
                    </p>
                </header>

                <Diamond />

                {/* ═══ DEL EQUIPO — narrativa estilo columna ═════════════ */}
                <section>
                    <SectionLabel>Del equipo de cuidado</SectionLabel>

                    {wellnessNotes.length > 0 ? (
                        <div className="space-y-12 max-w-xl mx-auto">
                            {wellnessNotes.slice(0, 2).map((note: any, idx: number) => (
                                <article key={idx} className="text-center">
                                    <p
                                        className="font-serif text-stone-800 leading-[1.6] tracking-tight"
                                        style={{
                                            fontSize: "1.375rem",
                                            fontVariationSettings: "'opsz' 24, 'SOFT' 50",
                                        }}
                                    >
                                        &ldquo;{note.note.replace(/^\[Zendi Update\]\s*/i, "")}&rdquo;
                                    </p>
                                    <p className="mt-5 text-xs text-stone-400 tracking-wide italic font-serif">
                                        — {note.author?.name || "Equipo de cuidado"}, {humanTime(note.createdAt)}
                                    </p>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center max-w-md mx-auto">
                            <p
                                className="font-serif text-stone-500 leading-relaxed italic"
                                style={{ fontSize: "1.25rem" }}
                            >
                                El equipo todavía no ha publicado<br />
                                notas de {firstName} hoy.
                            </p>
                            <p className="text-xs text-stone-400 mt-4 font-serif italic">
                                Las verás aquí en cuanto las compartan.
                            </p>
                        </div>
                    )}
                </section>

                <Diamond />

                {/* ═══ VITALES — typeset table editorial ═══════════════════ */}
                {latestVitals && (
                    <>
                        <section>
                            <SectionLabel>Signos vitales</SectionLabel>

                            <div className="max-w-sm mx-auto">
                                <dl className="font-serif">
                                    {[
                                        { label: "Presión arterial", value: `${latestVitals.systolic} / ${latestVitals.diastolic}`, unit: "mmHg" },
                                        { label: "Pulso", value: latestVitals.heartRate, unit: "bpm" },
                                        { label: "Temperatura", value: latestVitals.temperature, unit: "°F" },
                                        { label: "Oxigenación", value: latestVitals.spo2 ?? "—", unit: latestVitals.spo2 ? "%" : "" },
                                    ].map((v) => (
                                        <div
                                            key={v.label}
                                            className="flex items-baseline justify-between py-4 border-b border-stone-200 last:border-b-0"
                                        >
                                            <dt className="text-sm text-stone-500 italic">{v.label}</dt>
                                            <dd className="text-stone-900 tracking-tight">
                                                <span className="text-xl">{v.value}</span>
                                                {v.unit && <span className="text-xs text-stone-400 ml-1.5 italic">{v.unit}</span>}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                                <p className="text-[11px] text-stone-400 italic text-center mt-4 font-serif">
                                    Tomadas {humanTime(latestVitals.createdAt)}
                                </p>
                            </div>
                        </section>

                        <Diamond />
                    </>
                )}

                {/* ═══ CUIDADOS DEL DÍA — minimalista ═══════════════════════ */}
                <section>
                    <SectionLabel>Cuidados de hoy</SectionLabel>

                    <div className="max-w-sm mx-auto space-y-4 font-serif">
                        <div className="flex justify-between items-baseline py-2">
                            <span className="text-stone-500 italic text-sm">Alimentación</span>
                            <span className="text-stone-900 text-lg tracking-tight">
                                {latestLog?.foodIntake != null ? `${latestLog.foodIntake}%` : "Sin registrar"}
                            </span>
                        </div>
                        <div className="flex justify-between items-baseline py-2 border-t border-stone-200">
                            <span className="text-stone-500 italic text-sm">Higiene</span>
                            <span className="text-stone-900 text-lg tracking-tight">
                                {latestLog?.bathCompleted ? "Completada" : "Pendiente"}
                            </span>
                        </div>
                    </div>

                    {latestLog?.notes && (
                        <div className="mt-12 max-w-md mx-auto text-center">
                            <p
                                className="font-serif italic text-stone-600 leading-relaxed"
                                style={{ fontSize: "1.0625rem" }}
                            >
                                &ldquo;{latestLog.notes.trim()}&rdquo;
                            </p>
                            <p className="text-xs text-stone-400 italic font-serif mt-3">
                                — anotado {humanTime(latestLog.createdAt)}
                            </p>
                        </div>
                    )}
                </section>

                <Diamond />

                {/* ═══ EXPLORAR — links como índice editorial ═══════════════ */}
                <section>
                    <SectionLabel>Explora</SectionLabel>

                    <div className="max-w-sm mx-auto">
                        {quickLinks.map((link, idx) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="group flex items-baseline justify-between py-5 border-b border-stone-200 last:border-b-0 hover:bg-stone-50/0 transition-colors"
                            >
                                <div className="flex-1">
                                    <p className="font-serif text-stone-900 text-2xl tracking-tight group-hover:text-teal-700 transition-colors">
                                        {link.label}
                                    </p>
                                    <p className="text-xs text-stone-400 italic font-serif mt-0.5">
                                        {link.note}
                                    </p>
                                </div>
                                <ArrowUpRight
                                    className="w-5 h-5 text-stone-300 group-hover:text-teal-600 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all"
                                    strokeWidth={1.25}
                                />
                            </Link>
                        ))}
                    </div>
                </section>

                {/* ═══ COLOFÓN — footer editorial ═══════════════════════════ */}
                <footer className="text-center mt-20 sm:mt-28 pb-8">
                    <p className="text-stone-300 text-xs tracking-[0.5em] mb-3">◆ ◆ ◆</p>
                    <p className="font-serif italic text-stone-400 text-xs leading-relaxed">
                        Con cariño desde<br />
                        {resident.headquarters?.name || "Zéndity"}
                    </p>
                </footer>

            </div>
        </div>
    );
}
