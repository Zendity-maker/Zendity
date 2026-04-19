"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Loader2, Utensils, Star, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import ZendiAssist from "@/components/ZendiAssist";

/**
 * Sprint K — Página dedicada de Feedback de Cocina.
 * Reubicada desde el dashboard del supervisor para no saturar Mission Control.
 */
export default function KitchenFeedbackPage() {
    const { user } = useAuth();
    const [mealType, setMealType] = useState<'BREAKFAST' | 'LUNCH' | 'DINNER'>('LUNCH');
    const [feedbackType, setFeedbackType] = useState<'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'>('NEUTRAL');
    const [score, setScore] = useState(4);
    const [comments, setComments] = useState('');
    const [portionsOk, setPortionsOk] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 3500);
            return () => clearTimeout(t);
        }
    }, [toast]);

    const fetchHistory = async () => {
        if (!user) return;
        const hqId = (user as any).hqId || (user as any).headquartersId || '';
        if (!hqId) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/kitchen/dashboard?hqId=${hqId}`);
            const data = await res.json();
            if (data.observations) setHistory(data.observations);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => { fetchHistory(); }, [user]);

    const handleSend = async () => {
        if (!comments.trim() || !user) return;
        setSaving(true);
        try {
            const hqId = (user as any).hqId || (user as any).headquartersId || '';
            const res = await fetch('/api/kitchen/observations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    headquartersId: hqId,
                    supervisorId: user.id,
                    satisfactionScore: score,
                    comments,
                    mealType,
                    feedbackType,
                    portionsAdequate: portionsOk,
                })
            });
            const data = await res.json();
            if (data.success) {
                setSaved(true);
                setComments('');
                setTimeout(() => setSaved(false), 3000);
                setToast({ msg: '✓ Feedback enviado a cocina', type: 'ok' });
                fetchHistory();
            } else {
                setToast({ msg: 'Error enviando feedback', type: 'err' });
            }
        } catch (e) {
            console.error(e);
            setToast({ msg: 'Error de conexión', type: 'err' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 p-6 md:p-8 font-sans">
            <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-6 pb-16">
                <Link href="/care/supervisor" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold text-sm w-max">
                    <ArrowLeft className="w-4 h-4" /> Volver a Mission Control
                </Link>

                <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black text-white flex items-center gap-3 mb-2">
                            <Utensils className="w-8 h-8 text-amber-400" /> Feedback de Cocina
                        </h1>
                        <p className="text-slate-500 font-medium text-sm">
                            Registra la satisfacción del servicio de alimentos por turno. Estas observaciones llegan directo al módulo de Cocina.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Formulario */}
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 space-y-5">
                        <h2 className="text-xl font-black text-slate-800">Nueva Observación</h2>

                        <div className="flex gap-2">
                            {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map(m => (
                                <button key={m} onClick={() => setMealType(m)}
                                    className={`flex-1 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all border ${mealType === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
                                    {m === 'BREAKFAST' ? 'Desayuno' : m === 'LUNCH' ? 'Almuerzo' : 'Cena'}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            {(['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const).map(f => (
                                <button key={f} onClick={() => setFeedbackType(f)}
                                    className={`flex-1 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all border ${
                                        feedbackType === f
                                            ? f === 'POSITIVE' ? 'bg-emerald-500 text-white border-emerald-500'
                                            : f === 'NEGATIVE' ? 'bg-rose-500 text-white border-rose-500'
                                            : 'bg-slate-400 text-white border-slate-400'
                                            : 'bg-white text-slate-500 border-slate-200'}`}>
                                    {f === 'POSITIVE' ? 'Positivo' : f === 'NEGATIVE' ? 'Negativo' : 'Neutro'}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Porciones</span>
                            <button onClick={() => setPortionsOk(!portionsOk)}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${portionsOk ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                {portionsOk ? 'Adecuadas' : 'Inadecuadas'}
                            </button>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <button key={s} onClick={() => setScore(s)}
                                        className={`w-7 h-7 flex items-center justify-center transition-transform hover:scale-110 ${s <= score ? 'text-amber-500' : 'text-slate-200'}`}>
                                        <Star className="w-6 h-6 fill-current" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <ZendiAssist
                            value={comments}
                            onChange={setComments}
                            type="KITCHEN_OBS"
                            context="observación del servicio de cocina"
                            placeholder="Observación sobre el servicio de cocina..."
                            rows={4}
                        />

                        {saved ? (
                            <div className="w-full py-4 rounded-[2rem] bg-teal-50 text-teal-700 font-black text-sm text-center border border-teal-200 flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-5 h-5" /> Feedback enviado a cocina
                            </div>
                        ) : (
                            <button onClick={handleSend} disabled={!comments.trim() || saving}
                                className="w-full py-4 rounded-[2rem] bg-slate-900 text-white font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {saving ? 'Enviando...' : 'Enviar Feedback'}
                            </button>
                        )}
                    </div>

                    {/* Historial */}
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                        <h2 className="text-xl font-black text-slate-800 mb-6">Historial Reciente</h2>
                        {loadingHistory ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                        ) : history.length === 0 ? (
                            <div className="bg-slate-50 border border-slate-100 rounded-[1.5rem] p-8 text-center">
                                <p className="text-slate-500 font-medium text-sm">Sin observaciones registradas.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                {history.slice(0, 30).map((obs: any) => {
                                    const color = obs.feedbackType === 'POSITIVE' ? 'border-l-emerald-400' : obs.feedbackType === 'COMPLAINT' || obs.feedbackType === 'NEGATIVE' ? 'border-l-rose-400' : 'border-l-slate-300';
                                    const date = new Date(obs.createdAt).toLocaleString('es-PR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                                    return (
                                        <div key={obs.id} className={`bg-white border-l-[6px] ${color} border-y border-r border-slate-200 rounded-[1.5rem] p-4 shadow-sm`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                                    {obs.mealType === 'BREAKFAST' ? 'Desayuno' : obs.mealType === 'LUNCH' ? 'Almuerzo' : obs.mealType === 'DINNER' ? 'Cena' : 'General'}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <Star key={s} className={`w-3 h-3 ${s <= obs.satisfactionScore ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`} />
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-700 font-medium leading-snug mb-2">"{obs.comments}"</p>
                                            <p className="text-[10px] text-slate-500 font-bold">
                                                {obs.supervisor?.name || 'Supervisor'} · {date}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {toast && (
                <div
                    className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-[2rem] shadow-xl font-bold text-sm cursor-pointer ${toast.type === 'ok' ? 'bg-teal-900 text-teal-100' : 'bg-rose-900 text-rose-100'}`}
                    onClick={() => setToast(null)}
                >
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
