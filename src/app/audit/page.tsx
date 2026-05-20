"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveHq } from "@/contexts/ActiveHqContext";
import { Shield, FileText, Activity, Download, ChevronLeft, ChevronRight } from "lucide-react";

type Incident = {
    id: string;
    date: string;
    type: string;
    patient: string;
    severity: string;
    status: string;
};

type AuditLog = {
    id: string;
    action: string;
    entityName: string;
    entityId: string;
    payloadChanges: any;
    createdAt: string;
    actor: { id: string; name: string; role: string } | null;
};

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    MEDICATION_ADMINISTERED: { label: 'Med. Administrada', color: 'bg-green-100 text-green-800', icon: '💊' },
    MEDICATION_MISSED:       { label: 'Med. Omitida',      color: 'bg-red-100 text-red-800',   icon: '⚠️' },
    MEDICATION_REFUSED:      { label: 'Med. Rechazada',    color: 'bg-orange-100 text-orange-800', icon: '🚫' },
    MEDICATION_ADDED:        { label: 'Med. Añadida',      color: 'bg-blue-100 text-blue-800',  icon: '➕' },
    MEDICATION_MODIFIED:     { label: 'Med. Modificada',   color: 'bg-yellow-100 text-yellow-800', icon: '✏️' },
    MEDICATION_DISCONTINUED: { label: 'Med. Descontinuada',color: 'bg-gray-100 text-gray-800',  icon: '⛔' },
    USER_CREATED:    { label: 'Empleado Creado',    color: 'bg-teal-100 text-teal-800',   icon: '👤' },
    USER_UPDATED:    { label: 'Empleado Actualizado',color: 'bg-blue-100 text-blue-800',   icon: '✏️' },
    USER_DELETED:    { label: 'Empleado Eliminado', color: 'bg-red-100 text-red-800',     icon: '🗑️' },
    USER_BLOCKED:    { label: 'Acceso Suspendido',  color: 'bg-red-100 text-red-800',     icon: '🔒' },
    HANDOVER_CREATED:  { label: 'Relevo Creado',   color: 'bg-indigo-100 text-indigo-800', icon: '🔁' },
    HANDOVER_ACCEPTED: { label: 'Relevo Aceptado', color: 'bg-green-100 text-green-800',  icon: '✅' },
    INCIDENT_REPORTED: { label: 'Incidente Reportado', color: 'bg-red-100 text-red-800', icon: '🚨' },
    CREATED:          { label: 'Creado',           color: 'bg-gray-100 text-gray-700',    icon: '📄' },
    STATE_CHANGED:    { label: 'Estado Cambiado',  color: 'bg-yellow-100 text-yellow-800',icon: '🔄' },
    VOIDED:           { label: 'Anulado',          color: 'bg-red-100 text-red-800',      icon: '❌' },
    SHIFT_REDISTRIBUTE: { label: 'Turno Redistribuido', color: 'bg-purple-100 text-purple-800', icon: '🔀' },
};

function getActionMeta(action: string) {
    return ACTION_LABELS[action] || { label: action, color: 'bg-gray-100 text-gray-700', icon: '📝' };
}

const ROLE_LABELS: Record<string, string> = {
    DIRECTOR: 'Director(a)', ADMIN: 'Admin', NURSE: 'Enfermera',
    CAREGIVER: 'Cuidador(a)', SUPERVISOR: 'Supervisor(a)'
};

export default function ZendityAuditPage() {
    const { activeHqId } = useActiveHq();
    const [activeTab, setActiveTab] = useState<'incidents' | 'activity'>('incidents');

    // Incidents tab
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loadingIncidents, setLoadingIncidents] = useState(true);

    // Activity log tab
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logsPage, setLogsPage] = useState(1);
    const [logsTotal, setLogsTotal] = useState(0);
    const [logsPages, setLogsPages] = useState(1);
    const [filterEntity, setFilterEntity] = useState('');

    const fetchIncidents = useCallback(async () => {
        if (!activeHqId || activeHqId === 'ALL') { setLoadingIncidents(false); return; }
        setLoadingIncidents(true);
        try {
            const res = await fetch(`/api/audit?hqId=${activeHqId}`);
            const result = await res.json();
            if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                setIncidents(result.data.map((item: any) => ({
                    id: item.id.substring(0, 12).toUpperCase(),
                    date: new Date(item.reportedAt).toLocaleString('es-PR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    type: item.type === 'FALL' ? 'Caída (Downton)' : item.type === 'ULCER' ? 'Úlcera (Norton)' : item.type,
                    patient: item.patient?.name || 'Desconocido',
                    severity: item.severity,
                    status: item.biometricSignature ? 'SIGNED' : 'REQUIRES_SIGNATURE'
                })));
            } else {
                setIncidents([]);
            }
        } catch { setIncidents([]); }
        finally { setLoadingIncidents(false); }
    }, [activeHqId]);

    const fetchLogs = useCallback(async (page = 1) => {
        if (!activeHqId || activeHqId === 'ALL') return;
        setLoadingLogs(true);
        try {
            const params = new URLSearchParams({ hqId: activeHqId, page: String(page) });
            if (filterEntity) params.set('entityName', filterEntity);
            const res = await fetch(`/api/audit/logs?${params}`);
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
                setLogsTotal(data.total);
                setLogsPages(data.pages);
                setLogsPage(page);
            }
        } catch (e) { console.error(e); }
        finally { setLoadingLogs(false); }
    }, [activeHqId, filterEntity]);

    useEffect(() => { fetchIncidents(); }, [fetchIncidents]);
    useEffect(() => { if (activeTab === 'activity') fetchLogs(1); }, [activeTab, fetchLogs]);

    const exportCSV = () => {
        if (!logs.length) return;
        const header = 'Fecha,Acción,Entidad,ID Entidad,Actor,Rol\n';
        const rows = logs.map(l =>
            `"${new Date(l.createdAt).toLocaleString('es-PR')}","${l.action}","${l.entityName}","${l.entityId}","${l.actor?.name || '-'}","${l.actor?.role || '-'}"`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `audit-log-${activeHqId}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-900 to-teal-700 bg-clip-text text-transparent flex items-center gap-3">
                        <Shield className="w-8 h-8 text-teal-700" />
                        Centro de Auditoría
                    </h2>
                    <p className="text-gray-500 mt-1">Registro de incidentes clínicos y actividad del sistema.</p>
                </div>
                {activeTab === 'activity' && logs.length > 0 && (
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-lg text-sm px-4 py-2.5 shadow-sm transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Exportar CSV
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Tabs */}
                <div className="border-b border-gray-100 bg-gray-50/50 p-4">
                    <nav className="flex gap-3">
                        <button
                            onClick={() => setActiveTab('incidents')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'incidents' ? 'bg-white shadow-sm text-teal-800 border border-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <FileText className="w-4 h-4" />
                            Incidentes Clínicos
                            {incidents.length > 0 && <span className="bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{incidents.length}</span>}
                        </button>
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'activity' ? 'bg-white shadow-sm text-teal-800 border border-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <Activity className="w-4 h-4" />
                            Registro de Actividad
                            {logsTotal > 0 && <span className="bg-teal-100 text-teal-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{logsTotal}</span>}
                        </button>
                    </nav>
                </div>

                {/* Tab: Incidentes */}
                {activeTab === 'incidents' && (
                    <div>
                        {loadingIncidents ? (
                            <div className="p-12 text-center text-gray-400 text-sm">Cargando...</div>
                        ) : incidents.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center">
                                <span className="text-4xl mb-4">✅</span>
                                <h3 className="text-xl font-bold text-gray-900">Sin incidentes pendientes</h3>
                                <p className="text-gray-500 mt-2 max-w-sm mx-auto text-sm">
                                    No hay incidentes clínicos registrados en esta sede. El módulo completo de reporte de incidentes (caídas, UPP, errores de medicación) estará disponible en la próxima actualización.
                                </p>
                            </div>
                        ) : incidents.map(inc => (
                            <div key={inc.id} className="p-6 border-b border-gray-50 last:border-0 hover:bg-teal-50/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-xl border-2 border-white shadow-sm shrink-0">📋</div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{inc.id}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${inc.severity === 'HIGH' || inc.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {inc.severity === 'HIGH' ? 'Severidad Alta' : inc.severity === 'CRITICAL' ? 'Crítico' : 'Rutina'}
                                            </span>
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-900">{inc.type}</h4>
                                        <p className="text-sm text-gray-600">Residente: <span className="font-semibold text-gray-900">{inc.patient}</span> · {inc.date}</p>
                                    </div>
                                </div>
                                <button className="bg-teal-700 text-white hover:bg-teal-800 font-medium rounded-lg text-sm px-5 py-2.5 transition-colors shadow-sm flex items-center gap-2">
                                    ✍️ Firmar Documento
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tab: Registro de Actividad */}
                {activeTab === 'activity' && (
                    <div>
                        {/* Filtros */}
                        <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex flex-wrap gap-3">
                            <select
                                value={filterEntity}
                                onChange={e => { setFilterEntity(e.target.value); fetchLogs(1); }}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="">Todas las entidades</option>
                                <option value="PatientMedication">Medicamentos</option>
                                <option value="User">Empleados</option>
                                <option value="ShiftHandover">Relevos</option>
                                <option value="Incident">Incidentes</option>
                            </select>
                            <span className="text-xs text-gray-400 self-center">{logsTotal} registros total</span>
                        </div>

                        {loadingLogs ? (
                            <div className="p-12 text-center text-gray-400 text-sm">Cargando registros...</div>
                        ) : logs.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center">
                                <Activity className="w-10 h-10 text-gray-300 mb-3" />
                                <h3 className="text-lg font-bold text-gray-700">Sin actividad registrada</h3>
                                <p className="text-gray-400 mt-1 text-sm max-w-sm mx-auto">
                                    El registro de actividad se irá llenando automáticamente conforme el equipo use el sistema.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="divide-y divide-gray-50">
                                    {logs.map(log => {
                                        const meta = getActionMeta(log.action);
                                        const resourceName = (log.payloadChanges as any)?.resourceName;
                                        return (
                                            <div key={log.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors flex items-start gap-4">
                                                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-base shrink-0 mt-0.5">
                                                    {meta.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${meta.color}`}>
                                                            {meta.label}
                                                        </span>
                                                        <span className="text-xs text-gray-400">{log.entityName}</span>
                                                        {resourceName && (
                                                            <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]">{resourceName}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600">
                                                        {log.actor ? (
                                                            <><span className="font-semibold text-gray-900">{log.actor.name}</span>
                                                            <span className="text-gray-400 text-xs ml-1">({ROLE_LABELS[log.actor.role] || log.actor.role})</span></>
                                                        ) : <span className="text-gray-400 italic">Sistema</span>}
                                                    </p>
                                                </div>
                                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                                    {new Date(log.createdAt).toLocaleString('es-PR', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Paginación */}
                                {logsPages > 1 && (
                                    <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                                        <span className="text-sm text-gray-500">Página {logsPage} de {logsPages}</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => fetchLogs(logsPage - 1)}
                                                disabled={logsPage <= 1}
                                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => fetchLogs(logsPage + 1)}
                                                disabled={logsPage >= logsPages}
                                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
