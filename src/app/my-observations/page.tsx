"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, FileWarning, Clock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
    PENDING_EXPLANATION: { label: 'Esperando tu explicación', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
    EXPLANATION_RECEIVED: { label: 'Respuesta enviada', bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-300' },
    APPLIED: { label: 'Aplicada', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-300' },
    DISMISSED: { label: 'Desestimada', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
    NOTIFIED: { label: 'Notificada', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300' },
    CLOSED: { label: 'Cerrada', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300' },
};

const SEVERITY_LABELS: Record<string, string> = {
    OBSERVATION: 'Observación', WARNING: 'Amonestación', SUSPENSION: 'Suspensión', TERMINATION: 'Despido',
};

const CATEGORY_LABELS: Record<string, string> = {
    PUNCTUALITY: 'Puntualidad', PATIENT_CARE: 'Cuidado del Residente', HYGIENE: 'Higiene',
    BEHAVIOR: 'Conducta', DOCUMENTATION: 'Documentación', UNIFORM: 'Uniforme', OTHER: 'Otro',
};

export default function MyObservationsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [incidents, setIncidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { router.replace('/login'); return; }
        const fetchMine = async () => {
            try {
                const res = await fetch('/api/hr/incidents?myOwn=true');
                const data = await res.json();
                if (data.success) setIncidents(data.incidents || []);
            } catch (e) {
                console.error('[my-observations fetch]', e);
            } finally {
                setLoading(false);
            }
        };
        fetchMine();
    }, [user, authLoading, router]);

    const pending = incidents.filter((i) => i.status === 'PENDING_EXPLANATION');
    const active = incidents.filter((i) => ['APPLIED'].includes(i.status));
    const closed = incidents.filter((i) => ['DISMISSED', 'CLOSED', 'EXPLANATION_RECEIVED'].includes(i.status));

    if (authLoading || loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-medium">Cargando observaciones...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            <div className="max-w-3xl mx-auto p-6 md:p-8">
                <button
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium mb-6 transition-colors"
                >
                    <ArrowLeft size={16} /> Volver
                </button>

                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <FileWarning className="text-rose-500" size={32} />
                        Mis Observaciones
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium text-sm">
                        Observaciones del personal relacionadas contigo. Puedes responder las que están en espera.
                    </p>
                </div>

                {incidents.length === 0 && (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <p className="font-black text-slate-800 text-lg">Sin observaciones</p>
                        <p className="text-slate-500 font-medium text-sm mt-1">No tienes observaciones registradas en tu expediente.</p>
                    </div>
                )}

                {pending.length > 0 && (
                    <Section title={`Requieren tu respuesta (${pending.length})`} icon={<AlertTriangle className="text-amber-500" size={18} />}>
                        {pending.map((i) => <IncidentCard key={i.id} incident={i} />)}
                    </Section>
                )}

                {active.length > 0 && (
                    <Section title={`Aplicadas (${active.length})`} icon={<AlertTriangle className="text-rose-500" size={18} />}>
                        {active.map((i) => <IncidentCard key={i.id} incident={i} />)}
                    </Section>
                )}

                {closed.length > 0 && (
                    <Section title={`Historial (${closed.length})`} icon={<CheckCircle2 className="text-slate-400" size={18} />}>
                        {closed.map((i) => <IncidentCard key={i.id} incident={i} />)}
                    </Section>
                )}
            </div>
        </div>
    );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="mb-8">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                {icon} {title}
            </h2>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function IncidentCard({ incident }: { incident: any }) {
    const cfg = STATUS_CONFIG[incident.status] || STATUS_CONFIG.CLOSED;
    return (
        <Link
            href={`/my-observations/${incident.id}`}
            className={`block bg-white rounded-2xl border-2 ${cfg.border} p-5 hover:shadow-md transition-all active:scale-[0.99]`}
        >
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                        {SEVERITY_LABELS[incident.severity] || incident.severity}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {CATEGORY_LABELS[incident.category] || incident.category}
                    </span>
                </div>
                <span className="text-[11px] text-slate-400 font-bold">
                    {new Date(incident.createdAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
            </div>
            <p className="text-sm text-slate-700 font-medium leading-relaxed line-clamp-2">{incident.description}</p>
            {incident.status === 'PENDING_EXPLANATION' && (
                <div className="mt-3 flex items-center gap-2 text-amber-700 text-xs font-bold">
                    <Clock size={14} /> Tienes 48 horas para responder — toca para abrir
                </div>
            )}
        </Link>
    );
}
