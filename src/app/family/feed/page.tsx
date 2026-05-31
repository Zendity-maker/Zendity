"use client";

/**
 * /family/feed — Humanista Suave (Propuesta C)
 *
 * Diario de cuidado. Cards blancas, fondo cálido neutro,
 * iconos Lucide, acento brand.
 */

import { useEffect, useState, useCallback } from "react";
import { BookOpen, StickyNote, Sparkles, Camera, UserPlus } from "lucide-react";

// ── Tiempo humano ──────────────────────────────────────────────────────
function humanTime(date: string | Date): string {
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

interface FeedItem {
    id: string;
    type: "NOTE" | "MOMENT" | "PHOTO" | "EXTERNAL_SERVICE";
    content: string;
    mediaUrl?: string | null;
    author?: { name?: string | null } | null;
    authorName?: string | null;
    createdAt: string;
    externalService?: {
        providerName: string;
        categoryName: string;
        categoryIcon: string | null;
        serviceType: string | null;
        isFacilityWide: boolean;
    };
}

export default function FamilyFeedPage() {
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);

    const loadFeed = useCallback(async () => {
        try {
            const res = await fetch("/api/family/feed");
            const data = await res.json();
            if (data.success) setFeed(data.feed ?? []);
        } catch { /* no-op */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        loadFeed();
        const interval = setInterval(loadFeed, 60_000);
        return () => clearInterval(interval);
    }, [loadFeed]);

    return (
        <div className="bg-[#FAFAF8] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">

            {/* ═══ HEADER ═══ */}
            <div className="bg-white border-b border-stone-100 px-4 py-5">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-brand" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-slate-800 leading-tight">
                            Diario de Cuidado
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Notas y momentos del equipo
                        </p>
                    </div>
                </div>
            </div>

            {/* ═══ FEED ═══ */}
            <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-28">

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="flex gap-1.5">
                            <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                            <div className="w-2 h-2 bg-brand rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                            <div className="w-2 h-2 bg-brand rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                        </div>
                    </div>
                ) : feed.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                        <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" strokeWidth={1.25} />
                        <p className="text-sm text-slate-500 font-medium">
                            El equipo aún no ha publicado actualizaciones
                        </p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                            Aquí aparecerán notas, fotos y momentos especiales que el equipo comparta.
                        </p>
                    </div>
                ) : (
                    feed.map((item) => {
                        const isMoment = item.type === "MOMENT";
                        const isPhoto = item.type === "PHOTO" || !!item.mediaUrl;
                        const isExternal = item.type === "EXTERNAL_SERVICE";
                        const TypeIcon = isExternal ? UserPlus : isMoment ? Sparkles : isPhoto ? Camera : StickyNote;
                        const authorLabel = item.authorName || item.author?.name || "Equipo de cuidado";

                        // Card distintiva para servicios externos: borde teal sutil + badge
                        // con icono UserPlus + descripción del proveedor.
                        if (isExternal && item.externalService) {
                            const es = item.externalService;
                            return (
                                <article
                                    key={item.id}
                                    className="bg-white rounded-2xl border-2 border-brand/20 p-4"
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
                                            <UserPlus className="w-4 h-4 text-brand" strokeWidth={1.75} />
                                        </div>
                                        <span className="bg-brand/10 text-brand text-xs font-bold rounded-full px-2.5 py-0.5">
                                            Visita externa
                                        </span>
                                        {es.isFacilityWide && (
                                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full px-2 py-0.5">
                                                a toda la sede
                                            </span>
                                        )}
                                    </div>
                                    <div className="mb-2">
                                        <p className="text-sm font-bold text-slate-800">
                                            {es.categoryIcon || ""} {es.providerName}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {es.categoryName}
                                            {es.serviceType ? ` · ${es.serviceType}` : ""}
                                        </p>
                                    </div>
                                    {item.content && (
                                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-3 py-2 mt-2 border border-slate-100">
                                            {item.content}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-3">
                                        <div className="w-1 h-1 rounded-full bg-brand-secondary" />
                                        <p className="text-xs text-slate-400">{humanTime(item.createdAt)}</p>
                                    </div>
                                </article>
                            );
                        }

                        return (
                            <article
                                key={item.id}
                                className="bg-white rounded-2xl border border-slate-100 p-4"
                            >
                                {/* Header: tipo + badge */}
                                <div className="flex items-center gap-2 mb-3">
                                    <TypeIcon className="w-4 h-4 text-brand" strokeWidth={1.5} />
                                    {isMoment ? (
                                        <span className="bg-brand/10 text-brand text-xs font-semibold rounded-full px-2 py-0.5">
                                            ✨ Momento Zendi
                                        </span>
                                    ) : isPhoto ? (
                                        <span className="text-xs text-slate-400 font-medium">Foto del día</span>
                                    ) : (
                                        <span className="text-xs text-slate-400 font-medium">Nota del equipo</span>
                                    )}
                                </div>

                                {/* Imagen si existe */}
                                {item.mediaUrl && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={item.mediaUrl}
                                        alt=""
                                        className="w-full rounded-xl object-cover max-h-64 mb-3"
                                        loading="lazy"
                                    />
                                )}

                                {/* Contenido */}
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    {item.content.replace(/^\[Zendi Update\]\s*/i, "").trim()}
                                </p>

                                {/* Footer: autor + tiempo */}
                                <div className="flex items-center gap-1.5 mt-3">
                                    <div className="w-1 h-1 rounded-full bg-brand-secondary" />
                                    <p className="text-xs">
                                        <span className="text-brand font-medium">{authorLabel}</span>
                                        <span className="text-slate-400"> · {humanTime(item.createdAt)}</span>
                                    </p>
                                </div>
                            </article>
                        );
                    })
                )}
            </div>
        </div>
    );
}
