"use client";

/**
 * /family/preview — MOCKUP del rediseño Premium Warmth
 *
 * Esta página es un PREVIEW para validar la dirección de rediseño.
 * Carga la misma data real de /api/family/dashboard que el portal actual,
 * pero con la nueva estética.
 *
 * Si se aprueba, este código reemplaza /family/page.tsx.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Heart,
    Activity,
    Thermometer,
    Wind,
    UtensilsCrossed,
    Droplets,
    MessageCircle,
    BookOpen,
    Calendar,
    FileHeart,
    Sparkles,
} from "lucide-react";

// ── Helper: tiempo humano (no "hace 4h", sino "Esta mañana", "Anoche") ──
function humanTime(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    const hour = d.getHours();

    if (diffMin < 5) return "justo ahora";
    if (diffMin < 60) return `hace ${diffMin} minutos`;

    // Mismo día calendario
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    if (sameDay) {
        if (hour < 12) return "esta mañana";
        if (hour < 18) return "esta tarde";
        return "esta noche";
    }

    // Ayer
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
    if (diffDays < 7) {
        return d.toLocaleDateString("es-PR", { weekday: "long" });
    }
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
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join("");
}

// ── Monogram avatar elegante (fallback cuando no hay foto) ──────────────
function Monogram({ name, size = "lg" }: { name: string; size?: "sm" | "lg" }) {
    const cls =
        size === "lg"
            ? "w-32 h-32 text-4xl"
            : "w-14 h-14 text-lg";
    return (
        <div
            className={`${cls} rounded-full flex items-center justify-center font-display tracking-tight text-white shadow-[0_8px_24px_-8px_rgba(15,110,120,0.4)]`}
            style={{
                background: "linear-gradient(135deg, #1D9E75 0%, #0F6E56 100%)",
            }}
        >
            {getMonogram(name)}
        </div>
    );
}

// ── Vital tile — datos como números editoriales, no cajitas ─────────────
function VitalLine({
    icon: Icon,
    label,
    value,
    unit,
}: {
    icon: any;
    label: string;
    value: string | number;
    unit?: string;
}) {
    return (
        <div className="flex items-baseline gap-3 py-3 border-b border-stone-100 last:border-0">
            <Icon className="w-4 h-4 text-stone-400 self-center" strokeWidth={1.5} />
            <span className="text-sm text-stone-500 flex-1">{label}</span>
            <span className="font-display text-2xl text-stone-900 tracking-tight">
                {value}
            </span>
            {unit && (
                <span className="text-xs text-stone-400 font-medium">{unit}</span>
            )}
        </div>
    );
}

export default function FamilyDashboardPreview() {
    const [resident, setResident] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);

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

        fetch("/api/family/unread")
            .then((r) => r.json())
            .then((d) => setUnreadCount(d.count || 0))
            .catch(() => {});
    }, []);

    if (loading)
        return (
            <div className="flex justify-center items-center h-96">
                <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse mx-1.5" style={{ animationDelay: "0.15s" }} />
                <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
            </div>
        );

    if (error || !resident)
        return (
            <div className="text-center py-24">
                <p className="font-display text-2xl text-stone-700 mb-2">Bienvenido</p>
                <p className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">
                    {error || "Esta cuenta no tiene residentes asignados. Contacta a la Gerencia."}
                </p>
            </div>
        );

    const latestVitals = resident.vitalSigns?.[0];
    const latestLog = resident.dailyLogs?.[0];
    const wellnessNotes: any[] = resident.wellnessNotes ?? [];
    const firstName = resident.name?.split(" ")[0] || "tu familiar";

    const quickLinks = [
        { icon: BookOpen, label: "Diario", href: "/family/feed", badge: 0 },
        { icon: MessageCircle, label: "Mensajes", href: "/family/messages", badge: unreadCount },
        { icon: Calendar, label: "Citas", href: "/family/calendar", badge: 0 },
        { icon: FileHeart, label: "Mi PAI", href: "/family/pai", badge: 0 },
    ];

    return (
        <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">
            <div className="max-w-2xl mx-auto px-6 sm:px-8 py-10 sm:py-16 space-y-16">

                {/* ═══ HERO ═══════════════════════════════════════════════════ */}
                <header className="text-center space-y-6">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-400 font-medium capitalize">
                        {fechaHoyLarga()}
                    </p>

                    <div className="flex justify-center">
                        {resident.photoUrl ? (
                            <img
                                src={resident.photoUrl}
                                alt={resident.name}
                                className="w-32 h-32 rounded-full object-cover shadow-[0_8px_32px_-8px_rgba(15,110,120,0.35)] ring-1 ring-stone-200/60"
                            />
                        ) : (
                            <Monogram name={resident.name} size="lg" />
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <h1 className="font-display text-4xl sm:text-5xl text-stone-900 tracking-tight leading-tight">
                            {resident.name}
                        </h1>
                        <p className="text-sm text-stone-500">
                            Habitación {resident.roomNumber || "—"}
                            {resident.insurancePlanName && (
                                <span className="text-stone-300 mx-2">·</span>
                            )}
                            {resident.insurancePlanName && (
                                <span>{resident.insurancePlanName}</span>
                            )}
                        </p>
                    </div>
                </header>

                {/* ═══ POSTCARD: Últimas noticias del equipo ═════════════════ */}
                <section>
                    <h2 className="text-xs uppercase tracking-[0.2em] text-stone-400 font-medium mb-5 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Del equipo de cuidado
                    </h2>

                    {wellnessNotes.length > 0 ? (
                        <div className="space-y-4">
                            {wellnessNotes.slice(0, 2).map((note: any, idx: number) => (
                                <article
                                    key={idx}
                                    className="bg-white rounded-2xl px-7 py-6 shadow-[0_2px_24px_-4px_rgba(15,110,120,0.06)] ring-1 ring-stone-100"
                                >
                                    <p className="font-display text-lg leading-relaxed text-stone-800 first-letter:text-3xl first-letter:font-medium first-letter:text-teal-700 first-letter:mr-0.5 first-letter:float-left first-letter:leading-none first-letter:mt-1">
                                        {note.note.replace(/^\[Zendi Update\]\s*/i, "")}
                                    </p>
                                    <p className="text-xs text-stone-400 mt-4 flex items-center gap-2">
                                        <span className="w-6 h-px bg-stone-200" />
                                        <span>{note.author?.name || "Equipo de cuidado"}</span>
                                        <span className="text-stone-300">·</span>
                                        <span>{humanTime(note.createdAt)}</span>
                                    </p>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl px-7 py-10 text-center ring-1 ring-stone-100">
                            <p className="font-display text-base text-stone-500 leading-relaxed">
                                El equipo todavía no ha enviado<br />
                                actualizaciones de {firstName} hoy.
                            </p>
                            <p className="text-xs text-stone-400 mt-3">
                                Verás aquí las notas, fotos y momentos especiales en cuanto se publiquen.
                            </p>
                        </div>
                    )}
                </section>

                {/* ═══ HOY: Signos vitales + estado del día ═════════════════ */}
                <section>
                    <h2 className="text-xs uppercase tracking-[0.2em] text-stone-400 font-medium mb-5">
                        Hoy
                    </h2>

                    <div className="bg-white rounded-2xl shadow-[0_2px_24px_-4px_rgba(15,110,120,0.06)] ring-1 ring-stone-100 overflow-hidden">
                        {/* Vitales como datos editoriales */}
                        {latestVitals ? (
                            <div className="px-7 py-2">
                                <VitalLine
                                    icon={Heart}
                                    label="Presión arterial"
                                    value={`${latestVitals.systolic}/${latestVitals.diastolic}`}
                                    unit="mmHg"
                                />
                                <VitalLine
                                    icon={Activity}
                                    label="Pulso"
                                    value={latestVitals.heartRate}
                                    unit="bpm"
                                />
                                <VitalLine
                                    icon={Thermometer}
                                    label="Temperatura"
                                    value={latestVitals.temperature}
                                    unit="°F"
                                />
                                <VitalLine
                                    icon={Wind}
                                    label="Oxigenación"
                                    value={latestVitals.spo2 ?? "—"}
                                    unit={latestVitals.spo2 ? "%" : ""}
                                />
                            </div>
                        ) : (
                            <p className="px-7 py-8 text-sm text-stone-400 text-center">
                                Vitales del día aún no registrados
                            </p>
                        )}

                        {/* Separador editorial */}
                        <div className="px-7">
                            <div className="border-t border-stone-100" />
                        </div>

                        {/* Cuidados del día */}
                        <div className="px-7 py-5 space-y-3">
                            <div className="flex items-center gap-3">
                                <UtensilsCrossed className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
                                <span className="text-sm text-stone-500 flex-1">Alimentación</span>
                                <span className="text-sm font-medium text-stone-700">
                                    {latestLog?.foodIntake != null ? `${latestLog.foodIntake}%` : "Sin registrar"}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Droplets className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
                                <span className="text-sm text-stone-500 flex-1">Higiene</span>
                                <span className="text-sm font-medium text-stone-700">
                                    {latestLog?.bathCompleted ? "Completada" : "Pendiente"}
                                </span>
                            </div>
                        </div>

                        {/* Footer del card */}
                        {(latestVitals || latestLog) && (
                            <div className="px-7 py-4 bg-stone-50/60 border-t border-stone-100">
                                <p className="text-xs text-stone-400">
                                    Última actualización · {humanTime(latestVitals?.createdAt || latestLog?.createdAt)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Notas adicionales del cuidador, si las hay */}
                    {latestLog?.notes && (
                        <div className="mt-4 px-7">
                            <p className="text-sm text-stone-600 leading-relaxed italic">
                                "{latestLog.notes.trim()}"
                            </p>
                        </div>
                    )}
                </section>

                {/* ═══ ACCESOS RÁPIDOS — cards editoriales ═══════════════════ */}
                <section>
                    <h2 className="text-xs uppercase tracking-[0.2em] text-stone-400 font-medium mb-5">
                        Explora
                    </h2>

                    <div className="grid grid-cols-2 gap-3">
                        {quickLinks.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="group relative bg-white rounded-2xl px-5 py-6 ring-1 ring-stone-100 shadow-[0_2px_24px_-4px_rgba(15,110,120,0.04)] hover:shadow-[0_8px_32px_-4px_rgba(15,110,120,0.12)] hover:-translate-y-0.5 transition-all duration-300"
                                >
                                    <div className="flex flex-col gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                                            <Icon className="w-5 h-5 text-teal-700" strokeWidth={1.5} />
                                        </div>
                                        <span className="font-display text-base text-stone-800">
                                            {item.label}
                                        </span>
                                    </div>
                                    {item.badge > 0 && (
                                        <span className="absolute top-4 right-4 min-w-[20px] h-5 px-1.5 bg-teal-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                            {item.badge > 9 ? "9+" : item.badge}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </section>

                {/* ═══ FOOTER discreto ═══════════════════════════════════════ */}
                <footer className="text-center pt-8 pb-4">
                    <p className="text-xs text-stone-400">
                        Con cariño desde el equipo de {resident.headquarters?.name || "Zéndity"}
                    </p>
                </footer>

            </div>
        </div>
    );
}
