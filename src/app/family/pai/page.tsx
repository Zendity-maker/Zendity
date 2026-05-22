"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import { IconPAI } from "@/components/icons/ZendityIcons";

const TYPE_LABELS: Record<string, string> = {
    INITIAL:   "Plan Inicial",
    QUARTERLY: "Plan Trimestral",
    REVISION:  "Plan de Revisión",
};

function fechaLarga(date: string | Date): string {
    return new Date(date).toLocaleDateString("es-PR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function fechaCorta(date: string | Date): string {
    return new Date(date).toLocaleDateString("es-PR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function Diamond() {
    return (
        <div className="flex justify-center py-10">
            <span className="text-stone-300 text-base tracking-[1em]">◆ ◆ ◆</span>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-5 text-center">
            {children}
        </p>
    );
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

    if (loading) {
        return (
            <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen flex items-center justify-center">
                <span className="font-serif italic text-stone-300 text-lg">cargando…</span>
            </div>
        );
    }

    // Extracción de áreas tematizadas (igual lógica que antes)
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
        <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">
            <div className="max-w-2xl mx-auto px-6 sm:px-10 py-16 sm:py-24">

                {/* ═══ Back link sutil ═══════════════════════════════════ */}
                <Link
                    href="/family"
                    className="inline-flex items-center gap-2 text-stone-400 hover:text-stone-700 transition-colors mb-8 font-serif italic text-sm"
                >
                    <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                    Volver al diario
                </Link>

                {/* ═══ MASTHEAD ═══════════════════════════════════════════ */}
                <header className="text-center mb-12">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-medium mb-2">
                        Plan de Atención Integral
                    </p>
                    <p className="font-serif italic text-stone-400 text-sm mb-6">
                        Aprobado por el equipo clínico
                    </p>
                    <div className="flex justify-center mb-4">
                        <IconPAI size={56} />
                    </div>
                    <h1
                        className="font-serif text-stone-900 leading-[1.05] tracking-tight"
                        style={{
                            fontSize: "clamp(2.25rem, 7vw, 3.5rem)",
                            fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                        }}
                    >
                        Mi PAI
                    </h1>
                    <div className="flex items-center justify-center gap-3 mt-6">
                        <span className="block w-12 h-px bg-stone-300" />
                        <span className="text-stone-300 text-xs">◆</span>
                        <span className="block w-12 h-px bg-stone-300" />
                    </div>
                </header>

                {plans.length === 0 ? (
                    <div className="text-center py-20 max-w-md mx-auto">
                        <FileText className="w-12 h-12 text-stone-300 mx-auto mb-6" strokeWidth={1.25} />
                        <p
                            className="font-serif italic text-stone-500 leading-relaxed mb-3"
                            style={{ fontSize: "1.25rem" }}
                        >
                            Tu plan se está preparando.
                        </p>
                        <p className="font-serif italic text-stone-400 text-sm">
                            El equipo clínico está armando el Plan de Atención Integral.
                            Lo verás aquí en cuanto esté aprobado.
                        </p>
                    </div>
                ) : (
                    <>
                        <Diamond />

                        {/* ═══ Selector de planes — timeline serif ═══════ */}
                        {plans.length > 1 && (
                            <section className="mb-12">
                                <SectionLabel>Historial</SectionLabel>
                                <div className="flex flex-wrap gap-3 justify-center">
                                    {plans.map((plan) => {
                                        const isActive = selected?.id === plan.id;
                                        return (
                                            <button
                                                key={plan.id}
                                                onClick={() => setSelected(plan)}
                                                className={`text-center px-5 py-2.5 rounded-full transition-all font-serif border ${
                                                    isActive
                                                        ? "bg-stone-900 text-stone-50 border-stone-900"
                                                        : "bg-transparent text-stone-600 border-stone-200 hover:border-stone-400"
                                                }`}
                                            >
                                                <span className="text-sm">{TYPE_LABELS[plan.type] || plan.type}</span>
                                                <span className={`block text-[10px] italic mt-0.5 ${isActive ? "text-stone-400" : "text-stone-400"}`}>
                                                    {plan.approvedAt
                                                        ? new Date(plan.approvedAt).toLocaleDateString('es-PR', { month: 'long', year: 'numeric' })
                                                        : '—'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* ═══ Plan seleccionado ═══════════════════════════ */}
                        {selected && (
                            <>
                                <Diamond />

                                <section>
                                    <SectionLabel>{TYPE_LABELS[selected.type] || selected.type}</SectionLabel>

                                    <div className="text-center mb-10">
                                        {selected.approvedAt && (
                                            <p className="font-serif italic text-stone-500 text-base capitalize">
                                                Aprobado el {fechaLarga(selected.approvedAt)}
                                            </p>
                                        )}
                                        {selected.approvedBy?.name && (
                                            <p className="text-xs text-stone-400 font-serif italic mt-2">
                                                — por {selected.approvedBy.name}
                                            </p>
                                        )}
                                        <div className="mt-6">
                                            <Link
                                                href={`/family/pai/print/${selected.id}`}
                                                target="_blank"
                                                className="inline-flex items-center gap-2 text-teal-700 hover:text-teal-800 transition-colors font-serif italic text-sm border-b border-teal-700/30 hover:border-teal-700"
                                            >
                                                <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                Imprimir plan completo
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Mensaje del equipo */}
                                    {selected.familyVersion ? (
                                        <div className="max-w-xl mx-auto">
                                            <SectionLabel>Mensaje del equipo</SectionLabel>
                                            <p
                                                className="font-serif text-stone-800 leading-[1.7] tracking-tight whitespace-pre-wrap"
                                                style={{
                                                    fontSize: "1.125rem",
                                                    fontVariationSettings: "'opsz' 24, 'SOFT' 50",
                                                }}
                                            >
                                                {selected.familyVersion}
                                            </p>

                                            {/* Áreas detectadas */}
                                            {(() => {
                                                const areas = extractAreas(selected.familyVersion);
                                                if (areas.length === 0) return null;
                                                return (
                                                    <>
                                                        <div className="flex justify-center py-10">
                                                            <span className="text-stone-300 text-xs tracking-[1em]">◆</span>
                                                        </div>
                                                        <p className="text-center text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-4">
                                                            Áreas atendidas
                                                        </p>
                                                        <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
                                                            {areas.map(a => (
                                                                <span
                                                                    key={a.key}
                                                                    className="font-serif italic text-stone-500 text-base capitalize"
                                                                >
                                                                    {a.key}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <p className="font-serif italic text-stone-500">
                                                El mensaje familiar se está preparando.
                                            </p>
                                        </div>
                                    )}
                                </section>

                                {/* ═══ Fechas clave ═══════════════════════ */}
                                {(selected.startDate || selected.nextReview) && (
                                    <>
                                        <Diamond />
                                        <section>
                                            <SectionLabel>Fechas</SectionLabel>
                                            <dl className="max-w-sm mx-auto font-serif">
                                                {selected.startDate && (
                                                    <div className="flex items-baseline justify-between py-4 border-b border-stone-200">
                                                        <dt className="text-sm text-stone-500 italic">Inicio</dt>
                                                        <dd className="text-stone-900 tracking-tight capitalize">
                                                            {fechaCorta(selected.startDate)}
                                                        </dd>
                                                    </div>
                                                )}
                                                {selected.nextReview && (
                                                    <div className="flex items-baseline justify-between py-4 border-b border-stone-200">
                                                        <dt className="text-sm text-stone-500 italic">Próxima revisión</dt>
                                                        <dd className="text-stone-900 tracking-tight capitalize">
                                                            {fechaCorta(selected.nextReview)}
                                                        </dd>
                                                    </div>
                                                )}
                                                {selected.emailSentAt && (
                                                    <div className="flex items-baseline justify-between py-4">
                                                        <dt className="text-sm text-stone-500 italic">Email enviado</dt>
                                                        <dd className="text-stone-900 tracking-tight capitalize">
                                                            {fechaCorta(selected.emailSentAt)}
                                                        </dd>
                                                    </div>
                                                )}
                                            </dl>
                                        </section>
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* ═══ COLOFÓN ═══════════════════════════════════════════ */}
                <footer className="text-center mt-20 sm:mt-28 pb-8 max-w-md mx-auto">
                    <p className="text-stone-300 text-xs tracking-[0.5em] mb-3">◆ ◆ ◆</p>
                    <p className="font-serif italic text-stone-400 text-xs leading-relaxed">
                        Si tienes preguntas sobre el Plan de Atención,<br />
                        contacta directamente al equipo clínico.
                    </p>
                </footer>

            </div>
        </div>
    );
}
