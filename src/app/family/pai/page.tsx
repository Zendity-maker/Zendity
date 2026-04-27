"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle, Clock, Printer } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
    INITIAL: "Plan Inicial",
    QUARTERLY: "Plan Trimestral",
    REVISION: "Plan de Revisión",
};

export default function FamilyPaiPage() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);

    useEffect(() => {
        fetch('/api/family/pai')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setPlans(data.plans);
                    if (data.plans.length > 0) setSelected(data.plans[0]);
                }
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/family" className="p-2 rounded-xl hover:bg-slate-100 transition">
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-teal-600" />
                        Plan de Atención
                    </h1>
                    <p className="text-sm text-slate-500">Planes aprobados por el equipo clínico</p>
                </div>
            </div>

            {plans.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center">
                    <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-700 text-lg">Sin planes aprobados aún</h3>
                    <p className="text-slate-500 mt-2 text-sm">El equipo clínico está preparando el Plan de Atención de su familiar.</p>
                </div>
            ) : (
                <div className="space-y-5">

                    {/* Timeline de planes */}
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {plans.map((plan, idx) => (
                            <button key={plan.id} onClick={() => setSelected(plan)}
                                className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition border ${
                                    selected?.id === plan.id
                                        ? 'bg-teal-600 text-white border-teal-600 shadow'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400'
                                }`}>
                                {TYPE_LABELS[plan.type] || plan.type}
                                <span className="block text-[10px] font-normal opacity-75 mt-0.5">
                                    {plan.approvedAt ? new Date(plan.approvedAt).toLocaleDateString('es-PR', { month: 'short', year: 'numeric' }) : '—'}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Contenido del plan seleccionado */}
                    {selected && (
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden">

                            {/* Header del plan */}
                            <div className="bg-gradient-to-r from-teal-600 to-emerald-700 p-6 text-white">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <CheckCircle className="w-5 h-5 text-emerald-300" />
                                            <span className="text-sm font-bold text-emerald-200 uppercase tracking-widest">Aprobado</span>
                                        </div>
                                        <h2 className="text-xl font-black">{TYPE_LABELS[selected.type] || selected.type}</h2>
                                        {selected.approvedAt && (
                                            <p className="text-teal-200 text-sm mt-1">
                                                {new Date(selected.approvedAt).toLocaleDateString('es-PR', {
                                                    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                                                })}
                                            </p>
                                        )}
                                    </div>
                                    <Link href={`/family/pai/print/${selected.id}`} target="_blank"
                                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-bold text-sm transition backdrop-blur-sm">
                                        <Printer className="w-4 h-4" /> Imprimir
                                    </Link>
                                </div>
                                {selected.approvedBy?.name && (
                                    <p className="text-teal-300 text-xs mt-3">
                                        Aprobado por: <span className="font-bold text-white">{selected.approvedBy.name}</span>
                                    </p>
                                )}
                            </div>

                            {/* Versión familiar */}
                            <div className="p-6">
                                {selected.familyVersion ? (
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                                            Mensaje del Equipo Clínico
                                        </h3>
                                        <div className="bg-teal-50 border border-teal-100 rounded-2xl p-5 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                            {selected.familyVersion}
                                        </div>
                                        {/* Tags de áreas derivados del contenido */}
                                        {(() => {
                                            const text = (selected.familyVersion as string).toLowerCase();
                                            const areas = [
                                                { key: 'nutrición',   terms: ['nutrición','alimentación','dieta','comida'] },
                                                { key: 'movilidad',   terms: ['movilidad','ejercicio','fisioterapia','traslado'] },
                                                { key: 'higiene',     terms: ['higiene','baño','aseo','limpieza'] },
                                                { key: 'medicación',  terms: ['medicamento','medicación','fármaco','dosis'] },
                                                { key: 'bienestar',   terms: ['social','actividad','recreación','bienestar'] },
                                                { key: 'descanso',    terms: ['sueño','descanso','nocturno'] },
                                            ].filter(a => a.terms.some(t => text.includes(t)));
                                            if (areas.length === 0) return null;
                                            return (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {areas.map(a => (
                                                        <span key={a.key} className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                                                            style={{ backgroundColor: '#E1F5EE', color: '#0F6B78' }}>
                                                            {a.key}
                                                        </span>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-400">
                                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">El equipo está preparando tu plan de atención. Estará disponible próximamente.</p>
                                    </div>
                                )}

                                {/* Fechas clave */}
                                <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
                                    {selected.startDate && (
                                        <div>
                                            <span className="font-bold text-slate-700 block">Inicio</span>
                                            {new Date(selected.startDate).toLocaleDateString('es-PR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </div>
                                    )}
                                    {selected.nextReview && (
                                        <div>
                                            <span className="font-bold text-slate-700 block">Próxima Revisión</span>
                                            {new Date(selected.nextReview).toLocaleDateString('es-PR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </div>
                                    )}
                                    {selected.emailSentAt && (
                                        <div>
                                            <span className="font-bold text-emerald-700 block">Email enviado</span>
                                            {new Date(selected.emailSentAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="text-center pt-4">
                <p className="text-xs text-slate-400">
                    Si tienes preguntas sobre el Plan de Atención, contacta directamente al equipo clínico de la residencia.
                </p>
            </div>
        </div>
    );
}
