"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ShieldAlert, CheckCircle2, Clock, User, FileSignature } from 'lucide-react';

interface LifePlan {
    id: string;
    patient: { name: string };
    status: "DRAFT" | "APPROVED";
    criticalAlerts: string;
    feeding: string;
    mobility: string;
    customs: string;
    signedBy?: { name: string; role: string };
    signedAt?: string;
    createdAt: string;
}

export default function CaregiversLifePlanPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [plans, setPlans] = useState<LifePlan[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State para firmas (Convertido en In-Line flow)
    const [signingPlanId, setSigningPlanId] = useState<string | null>(null);
    const [signaturePin, setSignaturePin] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchLifePlans();
    }, []);

    const fetchLifePlans = async () => {
        try {
            const res = await fetch("/api/cuidadores/lifeplans");
            const data = await res.json();
            if (data.success) {
                setPlans(data.lifePlans);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSign = async (planId: string) => {
        if (!signaturePin || signaturePin.length < 4 || !user) return;
        setIsSubmitting(true);

        try {
            const res = await fetch("/api/cuidadores/lifeplans/sign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    planId,
                    userId: user.id,
                    signature: signaturePin
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSignaturePin("");
                setSigningPlanId(null);
                fetchLifePlans();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const canSign = ["NURSE", "ADMIN", "DIRECTOR", "CLINICAL_DIRECTOR", "SUPER_ADMIN"].includes(user?.role || "");

    if (loading) return (
        <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-500">
                    <FileSignature className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-500 tracking-wider text-sm uppercase">Cargando Plataforma de Cuidadores...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-[0.98] duration-500 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end pb-6 border-b border-slate-200/60 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                        <span className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-teal-600"></span>
                        Zendity Life Plan
                    </h1>
                    <p className="text-slate-500 mt-3 font-medium text-sm">Fichas de Cuidado Operativo (PAI) generadas por IA y validadas por Enfermería clínica.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {plans.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-500 font-bold bg-white rounded-3xl border border-dashed border-slate-200">
                        Aún no hay Fichas de Vida procesadas desde Zendity Intake.
                    </div>
                )}

                {plans.map((plan) => (
                    <div key={plan.id} className="bg-white rounded-xl border border-slate-200/80 overflow-hidden flex flex-col group hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-teal-200 transition-all duration-300">

                        {/* Cabecera / Estatus */}
                        <div className="p-5 flex justify-between items-start border-b border-slate-100/50 bg-slate-50/30">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-white shadow-sm flex items-center justify-center font-black text-xl text-slate-600">
                                    {plan.patient.name.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-lg leading-tight text-slate-800">{plan.patient.name}</h3>
                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                                        <User className="w-3 h-3" /> Residente
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                {plan.status === 'APPROVED' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Acreditado
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm">
                                        <Clock className="w-3.5 h-3.5" /> Borrador IA
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Alertas Críticas */}
                        {plan.criticalAlerts && !plan.criticalAlerts.includes("Ninguna") && (
                            <div className="bg-rose-50/50 border-b border-rose-100/50 p-4 px-5">
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg">
                                        <ShieldAlert className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black text-rose-800 uppercase tracking-widest mb-1.5">Alerta Médica</h4>
                                        <p className="text-sm font-semibold text-rose-700 leading-snug">{plan.criticalAlerts}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Cuerpo de la Ficha Técnica */}
                        <div className="p-6 space-y-6 flex-1 bg-white">
                            <div className="flex items-start gap-4">
                                <div className="text-2xl mt-0.5 opacity-80"></div>
                                <div>
                                    <h4 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Alimentación</h4>
                                    <p className="font-semibold text-slate-700 leading-snug mt-1 text-sm">{plan.feeding}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="text-2xl mt-0.5 opacity-80"></div>
                                <div>
                                    <h4 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Movilidad & Piel</h4>
                                    <p className="font-semibold text-slate-700 leading-snug mt-1 text-sm">{plan.mobility}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="text-2xl mt-0.5 opacity-80"></div>
                                <div>
                                    <h4 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Rutinas & Emoción</h4>
                                    <p className="font-semibold text-slate-700 leading-snug mt-1 text-sm">{plan.customs}</p>
                                </div>
                            </div>
                        </div>

                        {/* Pie de Firma / Aprobación */}
                        <div className="p-5 bg-slate-50/50 border-t border-slate-100">
                            {plan.status === 'APPROVED' ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold border border-teal-200">
                                            {plan.signedBy?.name?.charAt(0) || 'V'}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Validado por</p>
                                            <p className="text-xs font-bold text-slate-700">{plan.signedBy?.name || 'Zendity Staff'}</p>
                                        </div>
                                    </div>
                                    {plan.signedAt && (
                                        <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
                                            {new Date(plan.signedAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                canSign ? (
                                    signingPlanId === plan.id ? (
                                        <div className="animate-in fade-in space-y-3">
                                            <p className="text-xs text-slate-500 font-medium">Validación Clínica para {plan.patient.name}:</p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="password"
                                                    placeholder="PIN Médico..."
                                                    className="w-full text-center tracking-[0.3em] font-black text-slate-800 border border-slate-300 rounded-xl py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white shadow-inner text-sm outline-none transition-all"
                                                    value={signaturePin}
                                                    onChange={e => setSignaturePin(e.target.value)}
                                                    maxLength={6}
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSign(plan.id)}
                                                    disabled={isSubmitting || signaturePin.length < 4}
                                                    className="px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50 transition-colors"
                                                >
                                                    {isSubmitting ? '...' : 'OK'}
                                                </button>
                                                <button
                                                    onClick={() => setSigningPlanId(null)}
                                                    className="px-3 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold rounded-xl transition-colors"
                                                >
                                                    X
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setSigningPlanId(plan.id)}
                                            className="w-full py-2.5 bg-white border border-slate-200 hover:border-teal-400 hover:text-teal-700 text-slate-600 text-sm font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 group"
                                        >
                                            <FileSignature className="w-4 h-4 text-slate-500 group-hover:text-teal-500 transition-colors" />
                                            Revisar y Firmar PAI
                                        </button>
                                    )
                                ) : (
                                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 py-2.5 rounded-xl">
                                        <Clock className="w-4 h-4" /> En espera de auditoría
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
