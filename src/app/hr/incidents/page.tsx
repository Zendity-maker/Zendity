"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AlertTriangle, ChevronRight, Plus, Search, Filter, FileWarning } from 'lucide-react';
import WriteIncidentModal from '@/components/hr/WriteIncidentModal';

type Severity = 'OBSERVATION' | 'WARNING' | 'SUSPENSION' | 'TERMINATION';
type Status = 'DRAFT' | 'NOTIFIED' | 'PENDING_EXPLANATION' | 'EXPLANATION_RECEIVED' | 'APPLIED' | 'DISMISSED' | 'CLOSED';

const STATUS_STYLES: Record<Status, { label: string; bg: string; text: string }> = {
    DRAFT: { label: 'Borrador', bg: 'bg-slate-100', text: 'text-slate-600' },
    NOTIFIED: { label: 'Notificada', bg: 'bg-blue-100', text: 'text-blue-700' },
    PENDING_EXPLANATION: { label: 'Esperando explicación', bg: 'bg-amber-100', text: 'text-amber-700' },
    EXPLANATION_RECEIVED: { label: 'Respuesta recibida', bg: 'bg-teal-100', text: 'text-teal-700' },
    APPLIED: { label: 'Aplicada', bg: 'bg-rose-100', text: 'text-rose-700' },
    DISMISSED: { label: 'Desestimada', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    CLOSED: { label: 'Cerrada', bg: 'bg-gray-100', text: 'text-gray-600' },
};
const SEVERITY_STYLES: Record<Severity, { label: string; bg: string; text: string }> = {
    OBSERVATION: { label: 'Observación', bg: 'bg-blue-50', text: 'text-blue-700' },
    WARNING: { label: 'Amonestación', bg: 'bg-amber-50', text: 'text-amber-700' },
    SUSPENSION: { label: 'Suspensión', bg: 'bg-orange-50', text: 'text-orange-700' },
    TERMINATION: { label: 'Despido', bg: 'bg-red-50', text: 'text-red-700' },
};
const CATEGORY_LABELS: Record<string, string> = {
    PUNCTUALITY: 'Puntualidad',
    PATIENT_CARE: 'Cuidado del Residente',
    HYGIENE: 'Higiene',
    BEHAVIOR: 'Conducta',
    DOCUMENTATION: 'Documentación',
    UNIFORM: 'Uniforme',
    OTHER: 'Otro',
};

const HR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export default function HrIncidentsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [incidents, setIncidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'ALL' | Status>('ALL');
    const [severityFilter, setSeverityFilter] = useState<'ALL' | Severity>('ALL');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);

    const isAuthorized = !!user?.role && HR_ROLES.includes(user.role);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace('/login');
            return;
        }
        if (!isAuthorized) {
            router.replace('/');
            return;
        }
    }, [user, authLoading, isAuthorized, router]);

    const fetchIncidents = async () => {
        if (!isAuthorized) return;
        setLoading(true);
        try {
            const res = await fetch('/api/hr/incidents');
            const data = await res.json();
            if (data.success) setIncidents(data.incidents || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthorized) fetchIncidents();
    }, [isAuthorized]);

    const filtered = useMemo(() => {
        return incidents.filter(i => {
            if (statusFilter !== 'ALL' && i.status !== statusFilter) return false;
            if (severityFilter !== 'ALL' && i.severity !== severityFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                const empName = (i.employee?.name || '').toLowerCase();
                const supName = (i.supervisor?.name || '').toLowerCase();
                if (!empName.includes(q) && !supName.includes(q)) return false;
            }
            return true;
        });
    }, [incidents, statusFilter, severityFilter, search]);

    if (authLoading || !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-slate-400 font-medium">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto p-6 md:p-8">
                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                                <FileWarning size={22} />
                            </div>
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Observaciones de Personal</h1>
                        </div>
                        <p className="text-slate-500 text-sm ml-14">Gestión del flujo disciplinario. Todo borrador pasa por decisión del director.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                    >
                        <Plus size={16} />
                        Nueva observación
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Buscar</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Nombre empleado o supervisor..."
                                className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Estado</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-sm font-medium"
                        >
                            <option value="ALL">Todos</option>
                            {Object.entries(STATUS_STYLES).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Severidad</label>
                        <select
                            value={severityFilter}
                            onChange={(e) => setSeverityFilter(e.target.value as any)}
                            className="border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-sm font-medium"
                        >
                            <option value="ALL">Todas</option>
                            {Object.entries(SEVERITY_STYLES).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">Cargando observaciones...</div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                        <AlertTriangle className="mx-auto text-slate-300 mb-3" size={36} />
                        <p className="text-slate-500 font-medium">No hay observaciones que coincidan con los filtros.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(inc => {
                            const stStyle = STATUS_STYLES[inc.status as Status] || STATUS_STYLES.DRAFT;
                            const sevStyle = SEVERITY_STYLES[inc.severity as Severity] || SEVERITY_STYLES.OBSERVATION;
                            return (
                                <Link
                                    key={inc.id}
                                    href={`/hr/incidents/${inc.id}`}
                                    className="block bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 transition-all hover:shadow-md group"
                                >
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${stStyle.bg} ${stStyle.text}`}>
                                                    {stStyle.label}
                                                </span>
                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${sevStyle.bg} ${sevStyle.text}`}>
                                                    {sevStyle.label}
                                                </span>
                                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-teal-50 text-teal-700">
                                                    {CATEGORY_LABELS[inc.category] || inc.category}
                                                </span>
                                            </div>
                                            <div className="font-bold text-slate-900 text-lg leading-tight mb-1">
                                                {inc.employee?.name ?? 'Empleado desconocido'}
                                                <span className="text-slate-400 text-sm font-medium ml-2">({inc.employee?.role})</span>
                                            </div>
                                            <div className="text-slate-500 text-xs">
                                                Supervisor: <strong>{inc.supervisor?.name ?? '—'}</strong> · {new Date(inc.createdAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </div>
                                        <ChevronRight className="text-slate-300 group-hover:text-slate-500 transition-colors" size={20} />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {showModal && user && (
                <WriteIncidentModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    hqId={user.hqId || ''}
                    supervisorId={user.id}
                    employees={[]}
                    onSuccess={fetchIncidents}
                />
            )}
        </div>
    );
}
