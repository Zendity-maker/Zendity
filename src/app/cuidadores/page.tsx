"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

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

    // Modal State para firmas
    const [signingPlan, setSigningPlan] = useState<LifePlan | null>(null);
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

    const handleSign = async () => {
        if (!signaturePin || signaturePin.length < 4 || !signingPlan || !user) return;
        setIsSubmitting(true);

        try {
            const res = await fetch("/api/cuidadores/lifeplans/sign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    planId: signingPlan.id,
                    userId: user.id,
                    signature: signaturePin
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSignaturePin("");
                setSigningPlan(null);
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

    const canSign = user?.role === "NURSE" || user?.role === "ADMIN";

    if (loading) return <div className="p-10 font-bold text-center text-teal-600 animate-pulse">Cargando Plataforma de Cuidadores...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-slate-900 pb-4 gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
                        <span className="text-teal-600">🪪</span> Zendity Life Plan
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Fichas de Cuidado Operativo (PAI) generadas por IA y validadas por Enfermería.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {plans.length === 0 && (
                    <div className="col-span-full p-10 text-center text-slate-400 font-bold bg-slate-50 rounded-3xl border border-slate-200">
                        Aún no hay Fichas de Vida procesadas desde Zendity Intake.
                    </div>
                )}

                {plans.map((plan) => (
                    <div key={plan.id} className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col group hover:shadow-2xl transition-all duration-300">
                        {/* Cabecera / Estatus */}
                        <div className={`p-4 flex justify-between items-center text-white ${plan.status === 'APPROVED' ? 'bg-teal-600' : 'bg-slate-400'}`}>
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-lg">
                                    {plan.patient.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-black text-lg leading-tight">{plan.patient.name}</h3>
                                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-80">Residente</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-black backdrop-blur-sm">
                                    {plan.status === 'APPROVED' ? '✅ ACREDITADO' : '🚧 BORRADOR IA'}
                                </span>
                            </div>
                        </div>

                        {/* Alertas Críticas */}
                        {plan.criticalAlerts && !plan.criticalAlerts.includes("Ninguna") && (
                            <div className="bg-rose-50 border-b border-rose-100 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="text-xl mt-0.5">🚨</span>
                                    <div>
                                        <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider mb-1">Alerta Médica</h4>
                                        <p className="text-sm font-bold text-rose-600 leading-snug">{plan.criticalAlerts}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Cuerpo de la Ficha Técnica */}
                        <div className="p-6 space-y-5 flex-1 bg-slate-50/50">
                            <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-2 text-3xl opacity-80">🍏</div>
                                <div className="col-span-10">
                                    <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Alimentación</h4>
                                    <p className="font-bold text-slate-700 leading-tight mt-0.5">{plan.feeding}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-2 text-3xl opacity-80">🦽</div>
                                <div className="col-span-10">
                                    <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Movilidad & Piel</h4>
                                    <p className="font-bold text-slate-700 leading-tight mt-0.5">{plan.mobility}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-2 text-3xl opacity-80">🧩</div>
                                <div className="col-span-10">
                                    <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Rutinas & Emoción</h4>
                                    <p className="font-bold text-slate-700 leading-tight mt-0.5">{plan.customs}</p>
                                </div>
                            </div>
                        </div>

                        {/* Pie de Firma */}
                        <div className="p-4 bg-white border-t border-slate-100">
                            {plan.status === 'APPROVED' ? (
                                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                                    <span className="flex items-center gap-1.5"><span className="text-teal-500">✍️</span> Firmado por: <strong>{plan.signedBy?.name}</strong></span>
                                    <span>{plan.signedAt ? new Date(plan.signedAt).toLocaleDateString() : ''}</span>
                                </div>
                            ) : (
                                canSign ? (
                                    <button
                                        onClick={() => setSigningPlan(plan)}
                                        className="w-full py-3 bg-slate-900 hover:bg-black text-white text-sm font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <span>🛡️</span> Validar y Firmar PAI Permanentemente
                                    </button>
                                ) : (
                                    <div className="text-center text-xs font-bold text-amber-600 bg-amber-50 p-2 rounded-lg">
                                        Borrador en espera de auditoría Clínica.
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Firma */}
            {signingPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Firma Autorizada</h3>
                        <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">Verificando Plan de Cuidados para <strong>{signingPlan.patient.name}</strong>. Introduzca PIN profesional.</p>

                        <input
                            type="password"
                            placeholder="PIN Biomédico (Min 4 dictos)"
                            className="w-full text-center text-2xl tracking-[0.5em] font-black text-slate-800 border-2 border-slate-200 rounded-xl py-4 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 mb-6"
                            value={signaturePin}
                            onChange={e => setSignaturePin(e.target.value)}
                            maxLength={6}
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => setSigningPlan(null)}
                                className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSign}
                                disabled={isSubmitting || signaturePin.length < 4}
                                className="flex-1 py-3 text-sm font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-500/20 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Certificando...' : 'Aprobar PAI'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
