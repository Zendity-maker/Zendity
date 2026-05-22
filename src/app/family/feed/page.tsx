"use client";

/**
 * /family/feed — Editorial Calm
 *
 * Diario magazine-style. Serif protagonista, hairlines, mucho whitespace.
 * Notas, fotos y momentos del equipo de cuidado.
 */

import { useEffect, useState, useCallback } from "react";
import { StickyNote, Sparkles, Camera } from "lucide-react";

// ── Tiempo humano ──────────────────────────────────────────────────────────
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

// ── Types ──────────────────────────────────────────────────────────────────
type FeedItemType = "NOTE" | "MOMENT" | "PHOTO";

interface FeedItem {
    id: string;
    type: FeedItemType;
    content: string;
    mediaUrl: string | null;
    authorName: string;
    createdAt: string;
}

// ── Etiquetas tipográficas por tipo ────────────────────────────────────────
const TYPE_LABEL: Record<FeedItemType, { label: string; Icon: typeof StickyNote }> = {
    NOTE: { label: "Nota del equipo", Icon: StickyNote },
    MOMENT: { label: "Momento de bienestar", Icon: Sparkles },
    PHOTO: { label: "Foto del día", Icon: Camera },
};

// ── Separador ornamental ───────────────────────────────────────────────────
function Diamond() {
    return (
        <div className="flex justify-center py-10">
            <span className="text-stone-300 text-xs tracking-[1em]">◆ ◆ ◆</span>
        </div>
    );
}

// ── Etiqueta de sección (label uppercase) ──────────────────────────────────
function TypeLabel({ type }: { type: FeedItemType }) {
    const { label, Icon } = TYPE_LABEL[type];
    return (
        <div className="flex items-center justify-center gap-2 mb-5">
            <Icon className="w-3.5 h-3.5 text-stone-400" strokeWidth={1.5} />
            <span className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium">
                {label}
            </span>
        </div>
    );
}

// ── Item del feed ──────────────────────────────────────────────────────────
function FeedEntry({ item }: { item: FeedItem }) {
    const isPhoto = item.type === "PHOTO" || !!item.mediaUrl;

    return (
        <article className="text-center">
            <TypeLabel type={item.type} />

            {item.mediaUrl && (
                <div className="mb-8 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={item.mediaUrl}
                        alt="Foto compartida por el equipo"
                        loading="lazy"
                        className="w-full max-w-xl object-cover grayscale-[0.15]"
                        style={{
                            borderRadius: "12px",
                            boxShadow:
                                "0 1px 2px rgba(0,0,0,0.04), 0 24px 48px -16px rgba(15,110,120,0.18)",
                            maxHeight: "32rem",
                        }}
                    />
                </div>
            )}

            {item.content && (
                <p
                    className="font-serif text-stone-800 leading-[1.6] tracking-tight max-w-xl mx-auto"
                    style={{
                        fontSize: isPhoto ? "1.125rem" : "1.375rem",
                        fontVariationSettings: "'opsz' 24, 'SOFT' 50",
                        fontStyle: isPhoto ? "italic" : "normal",
                    }}
                >
                    &ldquo;{item.content.replace(/^\[Zendi Update\]\s*/i, "").trim()}&rdquo;
                </p>
            )}

            <p className="mt-5 text-xs text-stone-400 tracking-wide italic font-serif">
                — {item.authorName || "Equipo de cuidado"}, {humanTime(item.createdAt)}
            </p>
        </article>
    );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function FamilyFeedPage() {
    const [residentName, setResidentName] = useState<string>("");
    const [headquartersName, setHeadquartersName] = useState<string>("");
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadFeed = useCallback(async () => {
        try {
            const res = await fetch("/api/family/feed");
            const data = await res.json();
            if (data.success) {
                setFeed(data.feed);
                setError("");
            } else {
                setError(data.error || "No se pudo cargar el diario");
            }
        } catch {
            setError("Error de conexión");
        }
    }, []);

    // Carga inicial: nombre del residente + feed en paralelo
    useEffect(() => {
        Promise.all([
            fetch("/api/family/dashboard")
                .then((r) => r.json())
                .then((data) => {
                    if (data.success && data.resident?.name) {
                        setResidentName(data.resident.name);
                        if (data.resident?.headquarters?.name) {
                            setHeadquartersName(data.resident.headquarters.name);
                        }
                    }
                })
                .catch(() => { }),
            loadFeed(),
        ]).finally(() => setLoading(false));
    }, [loadFeed]);

    // Auto-refresh cada 60 segundos
    useEffect(() => {
        const interval = setInterval(() => {
            loadFeed();
        }, 60_000);
        return () => clearInterval(interval);
    }, [loadFeed]);

    const firstName = residentName?.split(" ")[0] || "tu familiar";
    const dateline = headquartersName || "Zéndity";

    return (
        <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">
            <div className="max-w-2xl mx-auto px-6 sm:px-10 py-16 sm:py-24">

                {/* ═══ MASTHEAD ═════════════════════════════════════════════ */}
                <header className="text-center mb-16 sm:mb-20">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-medium mb-3">
                        {dateline}
                    </p>

                    <h1
                        className="font-serif text-stone-900 leading-[1.05] tracking-tight mb-6"
                        style={{
                            fontSize: "clamp(2.5rem, 8vw, 4rem)",
                            fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                        }}
                    >
                        Diario
                    </h1>

                    <div className="flex items-center justify-center gap-3 mb-6">
                        <span className="block w-12 h-px bg-stone-300" />
                        <span className="text-stone-300 text-xs">◆</span>
                        <span className="block w-12 h-px bg-stone-300" />
                    </div>

                    <p className="font-serif italic text-stone-400 text-base leading-relaxed max-w-md mx-auto">
                        {residentName
                            ? <>Notas, fotos y momentos de <span className="text-stone-600">{residentName}</span></>
                            : "Notas, fotos y momentos de tu ser querido"}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-stone-400 mt-6">
                        Se actualiza automáticamente
                    </p>
                </header>

                {/* ═══ LOADING ══════════════════════════════════════════════ */}
                {loading && (
                    <div className="text-center py-20">
                        <p className="font-serif italic text-stone-300 text-lg">
                            cargando el diario…
                        </p>
                    </div>
                )}

                {/* ═══ ERROR ════════════════════════════════════════════════ */}
                {!loading && error && (
                    <div className="text-center py-16 max-w-md mx-auto">
                        <p className="font-serif italic text-stone-600 text-xl leading-relaxed mb-3">
                            No pudimos cargar las<br />actualizaciones ahora mismo.
                        </p>
                        <p className="text-xs text-stone-400 italic font-serif">
                            {error}. Intentaremos de nuevo en un momento.
                        </p>
                    </div>
                )}

                {/* ═══ EMPTY ════════════════════════════════════════════════ */}
                {!loading && !error && feed.length === 0 && (
                    <div className="text-center py-16 max-w-md mx-auto">
                        <p
                            className="font-serif italic text-stone-500 leading-relaxed"
                            style={{
                                fontSize: "1.375rem",
                                fontVariationSettings: "'opsz' 24, 'SOFT' 50",
                            }}
                        >
                            El equipo todavía no ha<br />publicado actualizaciones.
                        </p>
                        <p className="text-xs text-stone-400 mt-5 font-serif italic leading-relaxed">
                            Aquí aparecerán notas, fotos y momentos<br />
                            que el equipo de cuidado comparta sobre {firstName}.
                        </p>
                    </div>
                )}

                {/* ═══ FEED ═════════════════════════════════════════════════ */}
                {!loading && !error && feed.length > 0 && (
                    <div>
                        {feed.map((item, idx) => (
                            <div key={item.id}>
                                <FeedEntry item={item} />
                                {idx < feed.length - 1 && <Diamond />}
                            </div>
                        ))}
                    </div>
                )}

                {/* ═══ COLOFÓN ══════════════════════════════════════════════ */}
                {!loading && !error && feed.length > 0 && (
                    <footer className="text-center mt-20 sm:mt-28 pb-8">
                        <p className="text-stone-300 text-xs tracking-[0.5em] mb-3">◆ ◆ ◆</p>
                        <p className="font-serif italic text-stone-400 text-xs leading-relaxed">
                            Con cariño desde<br />
                            {headquartersName || "Zéndity"}
                        </p>
                    </footer>
                )}

            </div>
        </div>
    );
}
