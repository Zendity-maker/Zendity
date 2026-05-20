"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveHq } from "@/contexts/ActiveHqContext";
import {
    AlertTriangle, Activity, ShieldAlert, Pill,
    Filter, Download, Plus, Clock, User,
    ChevronRight, BadgeAlert
} from "lucide-react";
import Link from "next/link";

type Incident = {
    id: string;
    type: string;
    severity: string;
    patientId: string | null;
    patientName: string;
    roomNumber: string | null;
    description: string;
    location: string | null;
    occurredAt: string;
    createdAt: string;
    status?: string;
};

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    FALL:             { label: 'Caída',              icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-red-100 text-red-700 border-red-200' },
    MEDICATION_ERROR: { label: 'Error de Medicación',icon: <Pill className="w-4 h-4" />,          color: 'bg-orange-100 text-orange-700 border-orange-200' },
    INCIDENT:         { label: 'Incidente Operativo',icon: <BadgeAlert className="w-4 h-4" />,    color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    OTHER:            { label: 'Otro',               icon: <Activity className="w-4 h-4" />,      color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

const SEVERITY_META: Record<string, { label: string; dot: string }> = {
    SEVERE:   { label: 'Severo',   dot: 'bg-red-500' },
    MILD:     { label: 'Leve',     dot: 'bg-yellow-400' },
    NONE:     { label: 'Sin lesión',dot: 'bg-green-400' },
    FATAL:    { label: 'Fatal',    dot: 'bg-red-900' },
    CRITICAL: { label: 'Crítico',  dot: 'bg-red-500' },
    HIGH:     { label: 'Alto',     dot: 'bg-orange-500' },
    MEDIUM:   { label: 'Medio',    dot: 'bg-yellow-400' },
    LOW:      { label: 'Bajo',     dot: 'bg-green-400' },
};

function formatRelative(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h === 0) return `hace ${m}m`;
    if (h < 24) return `hace ${h}h ${m}m`;
    return new Date(dateStr).toLocaleDateString('es-PR', { month: 'short', day: '2-digit' });
}

// ── Modal de Reporte Rápido ───────────────────────────────────────────────
function ReportIncidentModal({ hqId, patients, onClose, onSuccess }: {
    hqId: string;
    patients: { id: string; name: string; roomNumber: string | null }[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [type, setType] = useState<'FALL' | 'MEDICATION_ERROR' | 'OTHER'>('FALL');
    const [patientId, setPatientId] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [conscious, setConscious] = useState(true);
    const [bleeding, setBleeding] = useState(false);
    const [painLevel, setPainLevel] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        if (!patientId && type !== 'OTHER') return setError('Selecciona un residente.');
        if (!description.trim() && type !== 'FALL') return setError('La descripción es requerida.');
        setSaving(true); setError('');
        try {
            const body: any = { type, patientId: patientId || undefined, description: description || undefined };
            if (type === 'FALL') {
                body.location = location; body.conscious = conscious;
                body.bleeding = bleeding; body.painLevel = painLevel;
            }
            const res = await fetch('/api/care/incidents', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Error al guardar'); setSaving(false); return; }
            onSuccess();
        } catch { setError('Error de conexión.'); setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 text-white">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5" /> Reportar Incidente Clínico
                    </h3>
                    <p className="text-red-100 text-xs mt-0.5">Se notificará al equipo de supervisión automáticamente.</p>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Tipo */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tipo de Incidente</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['FALL', 'MEDICATION_ERROR', 'OTHER'] as const).map(t => (
                                <button key={t} onClick={() => setType(t)}
                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${type === t ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                    {TYPE_META[t]?.icon}
                                    {TYPE_META[t]?.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Residente */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                            Residente {type !== 'OTHER' && <span className="text-red-500">*</span>}
                        </label>
                        <select
                            value={patientId}
                            onChange={e => setPatientId(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                        >
                            <option value="">Seleccionar residente...</option>
                            {patients.map(p => (
                                <option key={p.id} value={p.id}>{p.name}{p.roomNumber ? ` · Hab. ${p.roomNumber}` : ''}</option>
                            ))}
                        </select>
                    </div>

                    {/* Campos específicos por tipo */}
                    {type === 'FALL' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Ubicación</label>
                                <input value={location} onChange={e => setLocation(e.target.value)}
                                    placeholder="Baño, Habitación, Pasillo..."
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer">
                                    <input type="checkbox" checked={conscious} onChange={e => setConscious(e.target.checked)}
                                        className="w-4 h-4 rounded text-red-500" />
                                    <span className="text-sm font-medium text-gray-700">Consciente</span>
                                </label>
                                <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer">
                                    <input type="checkbox" checked={bleeding} onChange={e => setBleeding(e.target.checked)}
                                        className="w-4 h-4 rounded text-red-500" />
                                    <span className="text-sm font-medium text-gray-700">Sangrado</span>
                                </label>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                    Nivel de Dolor: <span className="text-red-600 font-black">{painLevel}/10</span>
                                </label>
                                <input type="range" min={0} max={10} value={painLevel}
                                    onChange={e => setPainLevel(Number(e.target.value))}
                                    className="w-full accent-red-500" />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                            {type === 'FALL' ? 'Observaciones adicionales' : 'Descripción *'}
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            placeholder={type === 'FALL' ? 'Ej. Residente intentó levantarse sin asistencia...' : 'Describe el incidente detalladamente...'}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                        />
                    </div>

                    {error && <p className="text-sm text-red-600 font-medium bg-red-50 rounded-xl px-4 py-2">{error}</p>}
                </div>

                <div className="p-5 border-t border-gray-100 flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={submit} disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <span className="animate-spin">⏳</span> : <ShieldAlert className="w-4 h-4" />}
                        {saving ? 'Guardando...' : 'Reportar Incidente'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Página Principal ──────────────────────────────────────────────────────
export default function IncidentsDashboard() {
    const { activeHqId } = useActiveHq();
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('');
    const [filterSeverity, setFilterSeverity] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [patients, setPatients] = useState<{ id: string; name: string; roomNumber: string | null }[]>([]);

    const fetchIncidents = useCallback(async () => {
        if (!activeHqId || activeHqId === 'ALL') { setLoading(false); return; }
        setLoading(true);
        try {
            const res = await fetch(`/api/care/incidents?hqId=${activeHqId}&hoursBack=720`);
            const data = await res.json();
            if (data.success) setIncidents(data.incidents || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [activeHqId]);

    const fetchPatients = useCallback(async () => {
        if (!activeHqId || activeHqId === 'ALL') return;
        const res = await fetch(`/api/patients?hqId=${activeHqId}`);
        if (res.ok) setPatients(await res.json());
    }, [activeHqId]);

    useEffect(() => { fetchIncidents(); fetchPatients(); }, [fetchIncidents, fetchPatients]);

    const filtered = incidents.filter(i => {
        if (filterType && i.type !== filterType) return false;
        if (filterSeverity && i.severity !== filterSeverity) return false;
        return true;
    });

    // KPIs
    const total = incidents.length;
    const falls = incidents.filter(i => i.type === 'FALL').length;
    const severe = incidents.filter(i => i.severity === 'SEVERE' || i.severity === 'CRITICAL').length;
    const last24h = incidents.filter(i => Date.now() - new Date(i.occurredAt).getTime() < 86400000).length;

    const exportCSV = () => {
        const header = 'Fecha,Tipo,Severidad,Residente,Habitación,Descripción\n';
        const rows = filtered.map(i =>
            `"${new Date(i.occurredAt).toLocaleString('es-PR')}","${i.type}","${i.severity}","${i.patientName}","${i.roomNumber || '-'}","${i.description.replace(/"/g, "'")}"`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `incidentes-${activeHqId}-${new Date().toISOString().split('T')[0]}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-red-600" />
                        Incidentes Clínicos
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">Últimos 30 días · Sede activa</p>
                </div>
                <div className="flex gap-3">
                    {filtered.length > 0 && (
                        <button onClick={exportCSV}
                            className="flex items-center gap-2 text-sm font-medium border border-gray-200 rounded-xl px-4 py-2.5 hover:bg-gray-50 transition-colors">
                            <Download className="w-4 h-4" /> Exportar CSV
                        </button>
                    )}
                    <button onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl px-5 py-2.5 transition-colors shadow-sm shadow-red-200">
                        <Plus className="w-4 h-4" /> Reportar Incidente
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total 30 días', value: total, icon: <Activity className="w-5 h-5" />, bg: 'bg-gray-50', text: 'text-gray-900', border: 'border-gray-200' },
                    { label: 'Caídas', value: falls, icon: <AlertTriangle className="w-5 h-5" />, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                    { label: 'Severidad Alta', value: severe, icon: <ShieldAlert className="w-5 h-5" />, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                    { label: 'Últimas 24h', value: last24h, icon: <Clock className="w-5 h-5" />, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                ].map(kpi => (
                    <div key={kpi.label} className={`${kpi.bg} border ${kpi.border} rounded-2xl p-5 flex items-center gap-4`}>
                        <div className={`${kpi.text} opacity-70`}>{kpi.icon}</div>
                        <div>
                            <div className={`text-3xl font-black ${kpi.text}`}>{kpi.value}</div>
                            <div className="text-xs text-gray-500 font-medium mt-0.5">{kpi.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3 items-center">
                <Filter className="w-4 h-4 text-gray-400" />
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-300">
                    <option value="">Todos los tipos</option>
                    <option value="FALL">Caídas</option>
                    <option value="MEDICATION_ERROR">Error de Medicación</option>
                    <option value="INCIDENT">Incidente Operativo</option>
                </select>
                <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-300">
                    <option value="">Toda la severidad</option>
                    <option value="SEVERE">Severo</option>
                    <option value="MILD">Leve</option>
                    <option value="NONE">Sin Lesión</option>
                </select>
                {(filterType || filterSeverity) && (
                    <button onClick={() => { setFilterType(''); setFilterSeverity(''); }}
                        className="text-xs text-gray-500 hover:text-gray-700 underline">Limpiar</button>
                )}
                <span className="text-xs text-gray-400 ml-auto">{filtered.length} resultados</span>
            </div>

            {/* Lista */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-16 text-center text-gray-400 text-sm">Cargando incidentes...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-16 text-center flex flex-col items-center gap-4">
                        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                            <ShieldAlert className="w-7 h-7 text-green-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Sin incidentes en este período</h3>
                            <p className="text-gray-400 text-sm mt-1">Excelente — no hay incidentes registrados en los últimos 30 días.</p>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {filtered.map(inc => {
                            const typeMeta = TYPE_META[inc.type] || TYPE_META['OTHER'];
                            const sevMeta = SEVERITY_META[inc.severity] || { label: inc.severity, dot: 'bg-gray-400' };
                            return (
                                <div key={inc.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors flex items-center gap-4">
                                    {/* Dot de severidad */}
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${sevMeta.dot}`} />

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${typeMeta.color}`}>
                                                {typeMeta.icon} {typeMeta.label}
                                            </span>
                                            <span className="text-xs text-gray-500 font-medium">{sevMeta.label}</span>
                                        </div>
                                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                            {inc.patientName}
                                            {inc.roomNumber && <span className="text-gray-400 font-normal text-xs">· Hab. {inc.roomNumber}</span>}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[400px]">{inc.description}</p>
                                    </div>

                                    {/* Tiempo */}
                                    <div className="text-right shrink-0">
                                        <div className="flex items-center gap-1 text-xs text-gray-400 justify-end">
                                            <Clock className="w-3 h-3" />
                                            {formatRelative(inc.occurredAt)}
                                        </div>
                                        {inc.location && (
                                            <span className="text-[10px] text-gray-400">{inc.location}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Link a Registro de Actividad */}
            <div className="flex justify-end">
                <Link href="/audit"
                    className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors">
                    Ver registro completo de auditoría <ChevronRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Modal */}
            {showModal && (
                <ReportIncidentModal
                    hqId={activeHqId || ''}
                    patients={patients}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); fetchIncidents(); }}
                />
            )}
        </div>
    );
}
