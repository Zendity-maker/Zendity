"use client";

import { useEffect, useState, useCallback } from "react";
import { UserPlus, Check, X, Loader2, FileDown, AlertCircle, Clock, BarChart3, History, Settings } from "lucide-react";
import Link from "next/link";
import { StatTile } from "@/components/ui/StatTile";

interface PendingVisit {
    id: string;
    provider: { id: string; name: string; category: { id: string; name: string; icon: string | null } };
    serviceType: string | null;
    comment: string | null;
    isFacilityWide: boolean;
    notifyFamilies: boolean;
    registeredAt: string;
    registeredFromFloor: number | null;
    ageHours: number;
    slaExpired: boolean;
    patients: { id: string; name: string; roomNumber: string | null; colorGroup: string }[];
}

interface HistoryVisit {
    id: string;
    provider: { name: string; category: { name: string; icon: string | null } };
    serviceType: string | null;
    comment: string | null;
    isFacilityWide: boolean;
    status: 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED';
    registeredAt: string;
    reviewedBy: { name: string } | null;
    reviewedAt: string | null;
    autoPublished: boolean;
    patients: { id: string; name: string; roomNumber: string | null }[];
}

interface StatsPayload {
    totalPublished: number;
    totalPending: number;
    totalRejected: number;
    autoPublishedCount: number;
    approvalRate: number | null;
    slaExpiredCount: number;
    byCategory: { id: string; name: string; icon: string | null; count: number }[];
    topProviders: { id: string; name: string; count: number }[];
    topPatients: { id: string; name: string; roomNumber: string | null; count: number }[];
}

type Tab = 'pending' | 'history' | 'stats';

export default function ExternalServicesPage() {
    const [tab, setTab] = useState<Tab>('pending');
    const [pending, setPending] = useState<PendingVisit[]>([]);
    const [history, setHistory] = useState<HistoryVisit[]>([]);
    const [stats, setStats] = useState<StatsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    const fetchPending = useCallback(async () => {
        const res = await fetch('/api/corporate/external-services/pending', { cache: 'no-store' });
        const data = await res.json();
        if (data.success) setPending(data.visits);
    }, []);
    const fetchHistory = useCallback(async () => {
        const res = await fetch('/api/corporate/external-services/visits?take=100', { cache: 'no-store' });
        const data = await res.json();
        if (data.success) setHistory(data.visits);
    }, []);
    const fetchStats = useCallback(async () => {
        const res = await fetch('/api/corporate/external-services/stats', { cache: 'no-store' });
        const data = await res.json();
        if (data.success) setStats(data);
    }, []);

    useEffect(() => {
        Promise.all([fetchPending(), fetchStats()]).finally(() => setLoading(false));
    }, [fetchPending, fetchStats]);
    useEffect(() => {
        if (tab === 'history' && history.length === 0) fetchHistory();
    }, [tab, history.length, fetchHistory]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    const approve = async (id: string) => {
        setActing(id);
        try {
            const res = await fetch(`/api/corporate/external-services/${id}/approve`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: data.message || 'Aprobada', type: 'ok' });
                await Promise.all([fetchPending(), fetchStats()]);
            } else {
                setToast({ msg: data.error || 'No se pudo aprobar', type: 'err' });
            }
        } finally { setActing(null); }
    };

    const reject = async (id: string) => {
        if (!confirm('¿Rechazar esta visita? No se publicará a familias.')) return;
        setActing(id);
        try {
            const res = await fetch(`/api/corporate/external-services/${id}/reject`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: 'Visita rechazada', type: 'ok' });
                await Promise.all([fetchPending(), fetchStats()]);
            } else {
                setToast({ msg: data.error || 'No se pudo rechazar', type: 'err' });
            }
        } finally { setActing(null); }
    };

    const downloadPDF = () => {
        const url = '/api/corporate/external-services/export-pdf';
        window.open(url, '_blank');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-teal-600 flex items-center justify-center">
                            <UserPlus className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900">Servicios Externos</h1>
                            <p className="text-sm text-slate-500">Aprobación y registro de visitas de proveedores externos</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={downloadPDF}
                            className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:border-teal-500 hover:text-teal-700 px-4 py-2 rounded-xl text-sm font-bold transition"
                        >
                            <FileDown className="w-4 h-4" /> Exportar PDF mes
                        </button>
                        <Link
                            href="/corporate/admin/external-services"
                            className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:border-teal-500 hover:text-teal-700 px-4 py-2 rounded-xl text-sm font-bold transition"
                        >
                            <Settings className="w-4 h-4" /> Administrar
                        </Link>
                    </div>
                </div>

                {/* KPI strip — StatTile (cross-screen #2). Pendientes y Auto-publicadas
                    pasan a warning cuando hay backlog, igual que Vencido total en billing. */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                        <StatTile
                            tone={stats.totalPending > 0 ? "warning" : "neutral"}
                            value={stats.totalPending}
                            label="Pendientes"
                            className="rounded-2xl"
                        />
                        <StatTile tone="teal" value={stats.totalPublished} label="Publicadas mes" className="rounded-2xl" />
                        <StatTile value={stats.totalRejected} label="Rechazadas" className="rounded-2xl" />
                        <StatTile
                            tone={stats.autoPublishedCount > 0 ? "warning" : "neutral"}
                            value={stats.autoPublishedCount}
                            label="Auto-publicadas"
                            caption="por SLA 24h"
                            className="rounded-2xl"
                        />
                        <StatTile
                            tone="teal"
                            value={stats.approvalRate !== null ? `${stats.approvalRate}%` : '—'}
                            label="Tasa aprob."
                            className="rounded-2xl"
                        />
                    </div>
                )}

                {/* SLA alert */}
                {stats && stats.slaExpiredCount > 0 && (
                    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-amber-900">
                                {stats.slaExpiredCount} visita{stats.slaExpiredCount === 1 ? '' : 's'} con SLA expirado (más de 24h sin revisar)
                            </p>
                            <p className="text-sm text-amber-800">
                                Estas se publicarán automáticamente. Revísalas para mantener control editorial.
                            </p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-slate-200">
                    <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')} icon={<AlertCircle className="w-4 h-4" />} label={`Pendientes (${pending.length})`} />
                    <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={<History className="w-4 h-4" />} label="Historial" />
                    <TabBtn active={tab === 'stats'} onClick={() => setTab('stats')} icon={<BarChart3 className="w-4 h-4" />} label="Estadísticas" />
                </div>

                {/* PENDING */}
                {tab === 'pending' && (
                    <div className="space-y-4">
                        {pending.length === 0 ? (
                            <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
                                <Check className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                                <h3 className="text-lg font-black text-slate-800">Sin visitas pendientes</h3>
                                <p className="text-slate-500">Todo está al día.</p>
                            </div>
                        ) : pending.map(v => (
                            <div key={v.id} className={`bg-white rounded-2xl p-5 shadow-sm border ${v.slaExpired ? 'border-amber-400' : 'border-slate-100'}`}>
                                <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                                    <div className="flex items-start gap-3">
                                        <div className="text-3xl">{v.provider.category.icon || '🏷️'}</div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900">{v.provider.name}</h3>
                                            <p className="text-sm text-slate-500">{v.provider.category.name}{v.serviceType ? ` · ${v.serviceType}` : ''}</p>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs text-slate-500">
                                        <div className="flex items-center gap-1 justify-end">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className={v.slaExpired ? 'font-black text-amber-700' : ''}>
                                                Hace {v.ageHours}h
                                            </span>
                                        </div>
                                        <div>{new Date(v.registeredAt).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                                        {v.registeredFromFloor && <div>Piso {v.registeredFromFloor}</div>}
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Residentes</p>
                                    {v.isFacilityWide ? (
                                        <p className="text-sm font-bold text-indigo-700">Toda la sede</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {v.patients.map(p => (
                                                <span key={p.id} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg font-medium">
                                                    {p.name}{p.roomNumber ? ` · ${p.roomNumber}` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {v.comment && (
                                    <div className="mb-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
                                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Comentario</p>
                                        <p className="text-sm text-slate-700">{v.comment}</p>
                                    </div>
                                )}
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => reject(v.id)}
                                        disabled={acting === v.id}
                                        className="px-4 py-2 rounded-xl border border-slate-300 hover:border-rose-500 hover:bg-rose-50 hover:text-rose-700 text-sm font-bold transition disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <X className="w-4 h-4" /> Rechazar
                                    </button>
                                    <button
                                        onClick={() => approve(v.id)}
                                        disabled={acting === v.id}
                                        className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-black transition disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {acting === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Aprobar y publicar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* HISTORY */}
                {tab === 'history' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-3 font-black text-slate-700">Fecha</th>
                                    <th className="text-left px-4 py-3 font-black text-slate-700">Proveedor</th>
                                    <th className="text-left px-4 py-3 font-black text-slate-700">Residentes</th>
                                    <th className="text-left px-4 py-3 font-black text-slate-700">Estado</th>
                                    <th className="text-left px-4 py-3 font-black text-slate-700">Revisor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Sin visitas registradas todavía.</td></tr>
                                )}
                                {history.map(v => (
                                    <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="px-4 py-3 text-slate-700">{new Date(v.registeredAt).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                        <td className="px-4 py-3"><span className="font-bold text-slate-800">{v.provider.category.icon || ''} {v.provider.name}</span><br/><span className="text-xs text-slate-500">{v.provider.category.name}</span></td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">{v.isFacilityWide ? 'Toda la sede' : v.patients.map(p => p.name).slice(0, 3).join(', ') + (v.patients.length > 3 ? ` +${v.patients.length - 3}` : '')}</td>
                                        <td className="px-4 py-3">
                                            <StatusPill status={v.status} autoPublished={v.autoPublished} />
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">{v.reviewedBy?.name || (v.autoPublished ? 'SLA auto' : '—')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* STATS */}
                {tab === 'stats' && stats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <StatCard title="Por Categoría" rows={stats.byCategory.map(c => ({ label: `${c.icon || ''} ${c.name}`, value: c.count }))} />
                        <StatCard title="Top 5 Proveedores" rows={stats.topProviders.map(p => ({ label: p.name, value: p.count }))} />
                        <StatCard title="Top 5 Residentes Más Visitados" rows={stats.topPatients.map(p => ({ label: `${p.name}${p.roomNumber ? ` · ${p.roomNumber}` : ''}`, value: p.count }))} />
                    </div>
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm ${toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2.5 font-bold text-sm flex items-center gap-2 border-b-2 transition ${active ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
            {icon} {label}
        </button>
    );
}

function StatusPill({ status, autoPublished }: { status: string; autoPublished: boolean }) {
    const map: Record<string, { label: string; cls: string }> = {
        PENDING_REVIEW: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800' },
        PUBLISHED:      { label: autoPublished ? 'Auto-pub' : 'Publicada', cls: autoPublished ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800' },
        REJECTED:       { label: 'Rechazada', cls: 'bg-rose-100 text-rose-700' },
    };
    const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-700' };
    return <span className={`inline-block text-xs font-black px-2 py-1 rounded-lg ${s.cls}`}>{s.label}</span>;
}

function StatCard({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
    const max = Math.max(1, ...rows.map(r => r.value));
    return (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-black text-slate-800 mb-3">{title}</h3>
            {rows.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Sin datos en el periodo.</p>
            ) : (
                <div className="space-y-2">
                    {rows.map((r, i) => (
                        <div key={i}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-700 font-medium truncate">{r.label}</span>
                                <span className="font-black text-slate-900">{r.value}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(r.value / max) * 100}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
