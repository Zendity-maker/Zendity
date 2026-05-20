"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, X, Rocket, Building2, Users, UserRound, Pill, CalendarDays } from "lucide-react";

type Step = {
    id: string;
    label: string;
    description: string;
    done: boolean;
    href: string;
};

const STEP_ICONS: Record<string, React.ElementType> = {
    hq_setup:    Building2,
    staff:       Users,
    residents:   UserRound,
    medications: Pill,
    schedule:    CalendarDays,
};

export default function OnboardingChecklist({ hqId }: { hqId: string }) {
    const [steps, setSteps] = useState<Step[]>([]);
    const [completedCount, setCompletedCount] = useState(0);
    const [allDone, setAllDone] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [loading, setLoading] = useState(true);

    const STORAGE_KEY = `zendity_onboarding_dismissed_${hqId}`;

    useEffect(() => {
        if (!hqId || hqId === 'ALL') { setLoading(false); return; }

        // Si ya lo cerraron antes, no mostrar
        if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true') {
            setDismissed(true);
            setLoading(false);
            return;
        }

        fetch(`/api/corporate/onboarding-status?hqId=${hqId}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.success) {
                    setSteps(data.steps ?? []);
                    setCompletedCount(data.completedCount ?? 0);
                    setAllDone(data.completed ?? false);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [hqId]);

    const dismiss = () => {
        if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, 'true');
        setDismissed(true);
    };

    // Ocultar si: cargando, ya cerrado, todos completos, sin pasos, o vista ALL
    if (loading || dismissed || allDone || steps.length === 0 || hqId === 'ALL') return null;

    const progress = Math.round((completedCount / 5) * 100);
    const nextStep = steps.find((s) => !s.done);

    return (
        <div className="bg-white border border-[#0F6B78]/20 rounded-2xl shadow-sm overflow-hidden">
            {/* Barra de color en el tope */}
            <div className="h-1 bg-slate-100">
                <div
                    className="h-full bg-gradient-to-r from-[#0F6B78] to-[#3CC6C4] transition-all duration-700"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F6B78] to-[#3CC6C4] flex items-center justify-center shadow shadow-[#3CC6C4]/25 shrink-0">
                            <Rocket className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-black text-slate-900 text-base leading-tight">
                                ¡Tu sede está activa! Completa el arranque.
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {completedCount === 0
                                    ? "Sigue estos pasos para tener la plataforma operativa."
                                    : completedCount === 4
                                    ? "¡Casi listo! Solo falta un paso más."
                                    : `${completedCount} de 5 pasos completados — vas bien.`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={dismiss}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
                        title="Ocultar checklist de arranque"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {steps.map((step, i) => {
                        const Icon = STEP_ICONS[step.id] ?? ChevronRight;
                        const isNext = step.id === nextStep?.id;

                        return (
                            <Link
                                key={step.id}
                                href={step.done ? '#' : step.href}
                                onClick={step.done ? (e) => e.preventDefault() : undefined}
                                className={`group relative flex flex-col gap-2.5 p-3.5 rounded-xl border transition-all duration-200 ${
                                    step.done
                                        ? "bg-emerald-50 border-emerald-200/60 cursor-default"
                                        : isNext
                                        ? "bg-[#0F6B78]/5 border-[#0F6B78]/30 hover:border-[#0F6B78]/60 hover:bg-[#0F6B78]/8 hover:shadow-sm"
                                        : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white"
                                }`}
                            >
                                {/* Número + estado */}
                                <div className="flex items-center justify-between">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                        step.done
                                            ? "bg-emerald-500 text-white"
                                            : isNext
                                            ? "bg-[#0F6B78] text-white"
                                            : "bg-slate-200 text-slate-500"
                                    }`}>
                                        {step.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                                    </div>
                                    {!step.done && (
                                        <ChevronRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${
                                            isNext ? "text-[#0F6B78]" : "text-slate-300"
                                        }`} />
                                    )}
                                </div>

                                {/* Icono del paso */}
                                <Icon className={`w-4 h-4 ${
                                    step.done ? "text-emerald-500" : isNext ? "text-[#0F6B78]" : "text-slate-400"
                                }`} />

                                {/* Texto */}
                                <div>
                                    <p className={`text-xs font-bold leading-tight ${
                                        step.done ? "text-emerald-700 line-through decoration-emerald-300" : isNext ? "text-[#0F6B78]" : "text-slate-700"
                                    }`}>
                                        {step.label}
                                    </p>
                                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5 hidden sm:block">
                                        {step.description}
                                    </p>
                                </div>

                                {/* Badge "Siguiente" */}
                                {isNext && (
                                    <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-[#0F6B78] text-white text-[9px] font-black uppercase tracking-wider">
                                        Siguiente
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* CTA del próximo paso */}
                {nextStep && (
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                        <p className="text-xs text-slate-500">
                            Próximo paso: <span className="font-bold text-slate-700">{nextStep.label}</span>
                        </p>
                        <Link
                            href={nextStep.href}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F6B78] text-white text-xs font-bold hover:bg-[#0d5a66] transition-colors"
                        >
                            Ir ahora <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
