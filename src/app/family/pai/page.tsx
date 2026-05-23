"use client";

/**
 * /family/pai — Humanista Suave (Propuesta C)
 *
 * Plan de Atención Integral. Cards blancas con borde suave,
 * fondo cálido neutro, acento teal-700.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { IconPAI } from "@/components/icons/ZendityIcons";

const TYPE_LABELS: Record<string, string> = {
    INITIAL:   "Plan Inicial",
    QUARTERLY: "Plan Trimestral",
    REVISION:  "Plan de Revisión",
};

function fechaCorta(date: string | Date): string {
    return new Date(date).toLocaleDateString("es-PR", { day: "numeric", month: "long", year: "numeric" });
}

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

    const extractAreas = (text: string) => {
        const lower = text.toLowerCase();
        return [
            { key: 'nutrición',  terms: ['nutrición','alimentación','dieta','comida'] },
            { key: 'movilidad',  terms: ['movilidad','ejercicio','fisioterapia','traslado'] },
            { key: 'higiene',    terms: ['higiene','baño','aseo','limpieza'] },
            { key: 'medicación', terms: ['medicamento','medicación','fármaco','dosis'] },
            { key: 'bienestar',  terms: ['social','actividad','recreación','bienestar'] },
            { key: 'descanso',   terms: ['sueño','descanso','nocturno'] },
        ].filter(a => a.terms.some(t => lower.includes(t)));
    };

    return (
        <div className="bg-[#FAFAF8] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">

            {/* ═══ HEADER ═══ */}
            <div className="bg-white border-b border-stone-100 px-4 py-5">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                        <IconPAI size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-slate-800 leading-tight">
                            Plan de Atención
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Aprobado por el equipo clínico
                        </p>
                    </div>
                </div>
            </div>

            {/* ═══ BODY ═══ */}
            <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-28">

                {/* Back link sutil (mobile) */}
                <Link
                    href="/family"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-teal-700 transition-colors"
                >
                    <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Volver al inicio
                </Link>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="flex gap-1.5">
                            <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse" />
                            <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                            <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                        </div>
                    </div>
                ) : plans.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                        <IconPAI size={48} />
                        <p className="text-sm text-slate-500 font-medium mt-3">
                            Tu plan se está preparando
                        </p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                            El equipo clínico está armando el Plan de Atención Integral. Lo verás aquí en cuanto esté aprobado.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Selector de planes (timeline) */}
                        {plans.length > 1 && (
                            <div>
                                <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                                    Historial
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {plans.map((plan) => {
                                        const isActive = selected?.id === plan.id;
                                        return (
                                            <button
                                                key={plan.id}
                                                onClick={() => setSelected(plan)}
                                                className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors ${
                                                    isActive
                                                        ? "bg-teal-600 text-white border-teal-600"
                                                        : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
                                                }`}
                                            >
                                                {TYPE_LABELS[plan.type] || plan.type}
                                                <span className={`block text-[10px] font-normal mt-0.5 ${isActive ? "text-teal-100" : "text-slate-400"}`}>
                                                    {plan.approvedAt ? new Date(plan.approvedAt).toLocaleDateString('es-PR', { month: 'short', year: 'numeric' }) : '—'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Plan seleccionado */}
                        {selected && (
                            <div className="bg-white rounded-2xl border border-slate-100 p-5">

                                {/* Badge tipo + fecha */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className="bg-teal-50 text-teal-700 text-xs font-semibold rounded-full px-3 py-1">
                                        {TYPE_LABELS[selected.type] || selected.type}
                                    </span>
                                    {selected.approvedAt && (
                                        <span className="text-xs text-slate-400">
                                            {fechaCorta(selected.approvedAt)}
                                        </span>
                                    )}
                                </div>

                                {/* Aprobado por */}
                                {selected.approvedBy?.name && (
                                    <p className="text-xs text-slate-400 mb-4">
                                        Aprobado por <span className="text-slate-600 font-medium">{selected.approvedBy.name}</span>
                                    </p>
                                )}

                                {/* Mensaje del equipo */}
                                {selected.familyVersion ? (
                                    <>
                                        <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-2">
                                            Mensaje del equipo
                                        </p>
                                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                            {selected.familyVersion}
                                        </p>

                                        {/* Áreas detectadas */}
                                        {(() => {
                                            const areas = extractAreas(selected.familyVersion);
                                            if (areas.length === 0) return null;
                                            return (
                                                <div className="mt-5 pt-4 border-t border-slate-100">
                                                    <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                                                        Áreas atendidas
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {areas.map(a => (
                                                            <span
                                                                key={a.key}
                                                                className="bg-teal-50 text-teal-700 text-xs font-medium rounded-full px-3 py-1 capitalize"
                                                            >
                                                                {a.key}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-400">
                                        El mensaje familiar se está preparando.
                                    </p>
                                )}

                                {/* Fechas clave */}
                                {(selected.startDate || selected.nextReview) && (
                                    <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                                        {selected.startDate && (
                                            <div>
                                                <p className="text-slate-400 mb-0.5">Inicio</p>
                                                <p className="text-slate-700 font-medium">{fechaCorta(selected.startDate)}</p>
                                            </div>
                                        )}
                                        {selected.nextReview && (
                                            <div>
                                                <p className="text-slate-400 mb-0.5">Próxima revisión</p>
                                                <p className="text-slate-700 font-medium">{fechaCorta(selected.nextReview)}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Botón imprimir */}
                                <Link
                                    href={`/family/pai/print/${selected.id}`}
                                    target="_blank"
                                    className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 border border-teal-200 rounded-full px-4 py-1.5 hover:bg-teal-50 transition-colors"
                                >
                                    <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    Imprimir plan completo
                                </Link>
                            </div>
                        )}
                    </>
                )}

                {/* Nota inferior */}
                <p className="text-xs text-slate-400 text-center pt-4">
                    Si tienes preguntas sobre el Plan, contacta al equipo clínico.
                </p>
            </div>
        </div>
    );
}
