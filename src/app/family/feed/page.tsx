"use client";

import { useEffect, useState, useCallback } from "react";

// ── Helper: tiempo relativo ────────────────────────────────────────────────
function timeAgo(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return "justo ahora";
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
  return `hace ${Math.floor(diff / 1440)} días`;
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

// ── Badge config per type ──────────────────────────────────────────────────
const TYPE_CONFIG: Record<
  FeedItemType,
  { label: string; badgeCls: string; borderCls: string }
> = {
  NOTE: {
    label: "📝 Nota del equipo",
    badgeCls: "bg-teal-100 text-teal-700",
    borderCls: "border-l-teal-500",
  },
  MOMENT: {
    label: "💚 Mensaje de bienestar",
    badgeCls: "bg-emerald-100 text-emerald-700",
    borderCls: "border-l-emerald-500",
  },
  PHOTO: {
    label: "📷 Foto del día",
    badgeCls: "bg-blue-100 text-blue-700",
    borderCls: "border-l-blue-500",
  },
};

// ── Skeleton card ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-slate-200 p-4 animate-pulse">
      <div className="h-4 w-28 bg-slate-100 rounded mb-3" />
      <div className="h-3 w-full bg-slate-100 rounded mb-2" />
      <div className="h-3 w-3/4 bg-slate-100 rounded mb-4" />
      <div className="h-3 w-24 bg-slate-100 rounded" />
    </div>
  );
}

// ── Feed item card ─────────────────────────────────────────────────────────
function FeedCard({ item }: { item: FeedItem }) {
  const cfg = TYPE_CONFIG[item.type];
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 ${cfg.borderCls} p-4`}
    >
      {/* Badge */}
      <span
        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${cfg.badgeCls}`}
      >
        {cfg.label}
      </span>

      {/* Media */}
      {item.mediaUrl && (
        <img
          src={item.mediaUrl}
          alt="Foto"
          className="w-full rounded-lg object-cover max-h-64 mb-3"
          loading="lazy"
        />
      )}

      {/* Content */}
      <p className="text-slate-700 text-sm leading-relaxed mb-2">{item.content}</p>

      {/* Footer */}
      <p className="text-xs text-slate-400">
        {item.authorName} · {timeAgo(item.createdAt)}
      </p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function FamilyFeedPage() {
  const [residentName, setResidentName] = useState<string>("");
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

  // Initial load: fetch resident name + feed in parallel
  useEffect(() => {
    Promise.all([
      fetch("/api/family/dashboard")
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.resident?.name) {
            setResidentName(data.resident.name);
          }
        })
        .catch(() => {}),
      loadFeed(),
    ]).finally(() => setLoading(false));
  }, [loadFeed]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadFeed();
    }, 60_000);
    return () => clearInterval(interval);
  }, [loadFeed]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">
            {residentName ? `Diario de ${residentName}` : "Diario del residente"}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Actualizaciones de los últimos 60 días · se refresca automáticamente
          </p>
        </div>

        {/* ── Loading skeleton ──────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* ── Error state ───────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!loading && !error && feed.length === 0 && (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-10 text-center flex flex-col items-center gap-3">
            <span className="text-4xl">💚</span>
            <p className="text-slate-600 font-medium text-sm">
              El equipo aún no ha publicado actualizaciones
            </p>
            <p className="text-xs text-slate-400 max-w-xs">
              Aquí aparecerán notas, fotos y mensajes de bienestar que el equipo
              de cuidado comparta sobre tu familiar.
            </p>
          </div>
        )}

        {/* ── Feed list ─────────────────────────────────────────────────── */}
        {!loading && !error && feed.length > 0 && (
          <div className="space-y-4">
            {feed.map((item) => (
              <FeedCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
