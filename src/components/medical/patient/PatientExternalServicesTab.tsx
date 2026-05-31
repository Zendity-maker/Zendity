"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";

interface VisitForPatient {
    id: string;
    providerName: string;
    categoryName: string;
    categoryIcon: string | null;
    serviceType: string | null;
    comment: string | null;
    status: 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED';
    isFacilityWide: boolean;
    registeredAt: string;
    autoPublished: boolean;
}

/**
 * Tab "Servicios Externos" del perfil del residente.
 *
 * Lista las visitas externas que afectaron a este residente (vía pivot o
 * facilityWide). Reemplaza al antiguo PatientSocialWorkTab que estaba basado
 * en SpecialistVisit (0 datos en prod). La data subyacente es ahora
 * ExternalServiceVisit, registrada desde el kiosko del piso.
 *
 * Auth: la página padre ya requiere DIRECTOR/ADMIN/NURSE/SUPERVISOR. Este
 * componente consume /api/corporate/external-services/visits?patientId=XXX
 * que respeta esos roles.
 */
export default function PatientExternalServicesTab({ patientId }: { patientId: string }) {
    const [visits, setVisits] = useState<VisitForPatient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/corporate/external-services/visits?patientId=${patientId}&take=50`, { cache: 'no-store' });
                const data = await res.json();
                if (data.success) {
                    setVisits((data.visits || []).map((v: any) => ({
                        id: v.id,
                        providerName: v.provider.name,
                        categoryName: v.provider.category.name,
                        categoryIcon: v.provider.category.icon,
                        serviceType: v.serviceType,
                        comment: v.comment,
                        status: v.status,
                        isFacilityWide: v.isFacilityWide,
                        registeredAt: v.registeredAt,
                        autoPublished: v.autoPublished,
                    })));
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [patientId]);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                        <UserPlus className="w-5 h-5 text-teal-700" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900">Servicios Externos</h2>
                        <p className="text-xs text-slate-500">Visitas de proveedores externos a este residente (hospicios, terapias, médicos especialistas, etc.)</p>
                    </div>
                </div>
                <Link
                    href="/corporate/external-services"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 transition"
                >
                    Dashboard general <ExternalLink className="w-3 h-3" />
                </Link>
            </div>

            {visits.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-slate-300">
                    <UserPlus className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-600">Sin visitas externas registradas</p>
                    <p className="text-xs text-slate-400 mt-1">Las visitas se registran desde la tablet del piso por el proveedor externo.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {visits.map(v => (
                        <div key={v.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="text-2xl flex-shrink-0">{v.categoryIcon || '🏷️'}</div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-slate-900 truncate">{v.providerName}</h3>
                                        <p className="text-xs text-slate-500">
                                            {v.categoryName}{v.serviceType ? ` · ${v.serviceType}` : ''}
                                            {v.isFacilityWide && <span className="ml-2 text-indigo-700 font-bold">· Visita a toda la sede</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <StatusPill status={v.status} autoPublished={v.autoPublished} />
                                    <p className="text-xs text-slate-400">{new Date(v.registeredAt).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                                </div>
                            </div>
                            {v.comment && (
                                <div className="mt-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                                    <p className="text-sm text-slate-700 leading-relaxed">{v.comment}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function StatusPill({ status, autoPublished }: { status: string; autoPublished: boolean }) {
    const map: Record<string, { label: string; cls: string }> = {
        PENDING_REVIEW: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800' },
        PUBLISHED:      { label: autoPublished ? 'Auto-pub' : 'Publicada', cls: autoPublished ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800' },
        REJECTED:       { label: 'Rechazada', cls: 'bg-rose-100 text-rose-700' },
    };
    const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-700' };
    return <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${s.cls}`}>{s.label}</span>;
}
