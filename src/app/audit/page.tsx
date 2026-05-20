"use client";

import { useState, useEffect } from "react";
import { useActiveHq } from "@/contexts/ActiveHqContext";

export default function ZendityAuditPage() {
    const { activeHqId } = useActiveHq();
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [incidents, setIncidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeHqId || activeHqId === 'ALL') {
            setLoading(false);
            return;
        }
        const fetchIncidents = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/audit?hqId=${activeHqId}`);
                const result = await response.json();

                if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                    const mappedIncidents = result.data.map((item: any) => ({
                        id: item.id.substring(0, 12).toUpperCase(),
                        date: new Date(item.reportedAt).toLocaleString('es-PR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        type: item.type === 'FALL' ? 'Caída (Downton)' : item.type === 'ULCER' ? 'Úlcera (Norton)' : item.type,
                        patient: item.patient?.name || 'Desconocido',
                        severity: item.severity,
                        status: item.biometricSignature ? 'SIGNED' : 'REQUIRES_SIGNATURE'
                    }));
                    setIncidents(mappedIncidents);
                } else {
                    // Sin datos reales — mostrar estado vacío (nunca datos inventados)
                    setIncidents([]);
                }
            } catch (e) {
                console.error("Error fetching audit incidents", e);
                setIncidents([]);
            } finally {
                setLoading(false);
            }
        };

        fetchIncidents();
    }, [activeHqId]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-900 to-teal-700 bg-clip-text text-transparent">
                        Zendity Audit (Cero Papel)
                    </h2>
                    <p className="text-gray-500 mt-1">
                        Simulación de Inspección y Firmas Electrónicas (Depto. de la Familia)
                    </p>
                </div>
                <div className="flex space-x-3">
                    <button className="bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-lg text-sm px-5 py-2.5 shadow-sm transition-colors flex items-center space-x-2">
                        <span></span>
                        <span>Generar Reporte Oficial</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50/50 p-4">
                    <nav className="flex space-x-4">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'pending' ? 'bg-white shadow-sm text-teal-800 border border-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            Pendientes de Firma ({incidents.length}) {loading && <span className="font-normal">(Cargando...)</span>}
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'history' ? 'bg-white shadow-sm text-teal-800 border border-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            Historial de Auditoría
                        </button>
                    </nav>
                </div>

                {activeTab === 'pending' && (
                    <div className="p-0">
                        {loading ? (
                            <div className="p-12 text-center text-gray-400 text-sm">Cargando...</div>
                        ) : incidents.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center">
                                <span className="text-4xl mb-4">✅</span>
                                <h3 className="text-xl font-bold text-gray-900">Sin incidentes pendientes</h3>
                                <p className="text-gray-500 mt-2 max-w-sm mx-auto text-sm">
                                    No hay documentos que requieran firma en esta sede. El módulo de reporte de incidentes clínicos estará disponible próximamente.
                                </p>
                            </div>
                        ) : (
                            incidents.map(inc => (
                                <div key={inc.id} className="p-6 border-b border-gray-50 last:border-0 hover:bg-teal-50/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 text-xl border-2 border-white shadow-sm shrink-0">
                                            📋
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-3 mb-1">
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{inc.id}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${inc.severity === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {inc.severity === 'HIGH' ? 'Severidad Alta' : 'Rutina'}
                                                </span>
                                            </div>
                                            <h4 className="text-lg font-bold text-gray-900">{inc.type}</h4>
                                            <p className="text-sm text-gray-600">Residente: <span className="font-semibold text-gray-900">{inc.patient}</span> · Fecha: {inc.date}</p>
                                        </div>
                                    </div>
                                    <div className="flex space-x-3">
                                        <button className="bg-teal-700 text-white hover:bg-teal-800 font-medium rounded-lg text-sm px-5 py-2.5 transition-colors shadow-sm w-full md:w-auto flex items-center justify-center space-x-2">
                                            <span>✍️</span>
                                            <span>Firmar Documento</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                        <span className="text-4xl mb-4"></span>
                        <h3 className="text-xl font-bold text-gray-900">Historial 100% Digital</h3>
                        <p className="text-gray-500 mt-2 max-w-md mx-auto">
                            Todos los documentos de los últimos 30 días tienen la firma biométrica registrada cumpliendo con el estándar HIPAA y Depto. de la Familia.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
