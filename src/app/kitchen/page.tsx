"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Loader2, Star } from "lucide-react";

export default function KitchenDashboard() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [activePatients, setActivePatients] = useState<any[]>([]);
    const [hospitalPatients, setHospitalPatients] = useState<any[]>([]);
    const [observations, setObservations] = useState<any[]>([]);
    const [todayMenu, setTodayMenu] = useState<any>(null);
    const [kpi, setKpi] = useState<any>(null);
    const [markingRead, setMarkingRead] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    useEffect(() => {
        if (!user) return;
        const extendedUser = user as any;
        if (!['KITCHEN', 'ADMIN', 'DIRECTOR', 'SUPERVISOR', 'NURSE'].includes(extendedUser.role) && !extendedUser.secondaryRoles?.includes('KITCHEN')) {
            router.replace('/');
            return;
        }
        fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const fetchDashboard = async () => {
        try {
            const res = await fetch(`/api/kitchen/dashboard?hqId=${(user as any)?.headquartersId || (user as any)?.hqId}`);
            const data = await res.json();
            if (data.success) {
                setActivePatients(data.activePatients);
                setHospitalPatients(data.hospitalPatients);
                setObservations(data.observations);
                setTodayMenu(data.todayMenu);
                setKpi(data.kpi);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkRead = async (id: string) => {
        setMarkingRead(id);
        try {
            const res = await fetch(`/api/kitchen/observations?id=${id}`, { method: 'PATCH' });
            const data = await res.json();
            if (data.success) {
                setObservations(prev => prev.map(o => o.id === id ? { ...o, isRead: true } : o));
                setToast({ msg: 'Observación marcada como leída.', type: 'ok' });
            }
        } catch {
            setToast({ msg: 'Error al marcar como leído.', type: 'err' });
        } finally {
            setMarkingRead(null);
        }
    };

    if (!user || loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mr-3" /> Cargando Kitchen...
        </div>
    );

    const solidoCount = activePatients.filter(p => !p.diet || p.diet.toLowerCase().includes('solido') || p.diet.toLowerCase().includes('regular') || p.diet.toLowerCase().includes('sólido')).length;
    const mojadoCount = activePatients.filter(p => p.diet && (p.diet.toLowerCase().includes('mojado') || p.diet.toLowerCase().includes('puré') || p.diet.toLowerCase().includes('pure'))).length;
    const pegCount = activePatients.filter(p => p.diet && p.diet.toLowerCase().includes('peg')).length;
    const diabeticaCount = activePatients.filter(p => p.diet && p.diet.toLowerCase().includes('diab')).length;
    const unreadObs = observations.filter(o => !o.isRead);

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-xl shadow-md">🍽</div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Cocina y Nutrición</h1>
                            <p className="text-xs font-bold text-slate-400">{(user as any).hqName || 'Zendity Network'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="/kitchen/menu" className="text-sm font-bold text-orange-600 hover:text-orange-800 transition bg-orange-50 px-4 py-2 rounded-xl border border-orange-200">
                            📋 Menú del Día
                        </a>
                        <button onClick={logout} className="text-sm font-bold text-slate-500 hover:text-slate-800 transition">
                            Salir
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* KPI Row */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Residentes</p>
                        <p className="text-3xl font-black text-slate-800">{activePatients.length}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl shadow-sm text-center">
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">En Hospital</p>
                        <p className="text-3xl font-black text-amber-700">{hospitalPatients.length}</p>
                    </div>
                    <div className={`p-5 rounded-2xl border shadow-sm text-center ${(kpi?.avgScore ?? 0) >= 4 ? 'bg-emerald-50 border-emerald-200' : (kpi?.avgScore ?? 0) >= 3 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Score Promedio</p>
                        <p className={`text-3xl font-black ${(kpi?.avgScore ?? 0) >= 4 ? 'text-emerald-700' : (kpi?.avgScore ?? 0) >= 3 ? 'text-amber-700' : 'text-rose-700'}`}>
                            {kpi?.avgScore ?? '—'} <span className="text-lg">⭐</span>
                        </p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm text-center">
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Positivos</p>
                        <p className="text-3xl font-black text-emerald-700">{kpi?.positiveCount ?? 0}</p>
                    </div>
                    <div className={`p-5 rounded-2xl border shadow-sm text-center ${(kpi?.unreadCount ?? 0) > 0 ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Sin Leer</p>
                        <p className={`text-3xl font-black ${(kpi?.unreadCount ?? 0) > 0 ? 'text-rose-700' : 'text-slate-400'}`}>{kpi?.unreadCount ?? 0}</p>
                    </div>
                </div>

                {/* Reminder banner */}
                {kpi?.needsReminder && (
                    <div className="bg-amber-50 border-l-4 border-amber-400 rounded-2xl p-5 flex items-center gap-4">
                        <span className="text-2xl">⏰</span>
                        <div>
                            <p className="font-black text-amber-800 text-sm uppercase tracking-widest">Zendi — Recordatorio</p>
                            <p className="text-amber-700 font-medium text-sm mt-1">
                                Han pasado {kpi.lastFeedbackDaysAgo === 999 ? 'varios días' : `${kpi.lastFeedbackDaysAgo} días`} sin feedback del supervisor. Recuérdale que evalúe el servicio de cocina.
                            </p>
                        </div>
                    </div>
                )}

                {/* Menú del día */}
                {todayMenu && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-2 h-6 bg-orange-500 rounded-full inline-block"></span>
                            Menú de Hoy — {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                        </h2>
                        <div className="grid grid-cols-3 gap-4">
                            {([['🌅 Desayuno', todayMenu.breakfast], ['☀️ Almuerzo', todayMenu.lunch], ['🌙 Cena', todayMenu.dinner]] as [string, string | null][]).map(([label, value]) => (
                                <div key={label} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">{label}</p>
                                    <p className="font-medium text-slate-700 text-sm">{value || 'Sin registrar'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Censo */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { label: 'Sólido', count: solidoCount, color: 'bg-slate-100 text-slate-700' },
                                { label: 'Mojado/Puré', count: mojadoCount, color: 'bg-sky-100 text-sky-700' },
                                { label: 'PEG', count: pegCount, color: 'bg-purple-100 text-purple-700' },
                                { label: 'Diabética', count: diabeticaCount, color: 'bg-amber-100 text-amber-700' },
                            ].map(({ label, count, color }) => (
                                <div key={label} className={`${color} p-4 rounded-2xl text-center font-black`}>
                                    <p className="text-2xl">{count}</p>
                                    <p className="text-xs uppercase tracking-widest mt-1 font-bold opacity-70">{label}</p>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-black text-slate-800">Censo Activo para Preparación</h3>
                                <p className="text-sm text-slate-500 font-medium">{activePatients.length} residentes presentes hoy</p>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                                {activePatients.map(patient => (
                                    <div key={patient.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                                                {patient.name.charAt(0)}{patient.name.split(' ')[1]?.charAt(0) || ''}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{patient.name}</p>
                                                <p className="text-xs text-slate-400">Cuarto {patient.roomNumber || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                            (patient.diet || '').toLowerCase().includes('peg') ? 'bg-purple-100 text-purple-700' :
                                            (patient.diet || '').toLowerCase().includes('mojado') || (patient.diet || '').toLowerCase().includes('puré') ? 'bg-sky-100 text-sky-700' :
                                            (patient.diet || '').toLowerCase().includes('diab') ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                            {patient.diet || 'Regular'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Observaciones */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <span className="w-2 h-6 bg-rose-500 rounded-full inline-block"></span>
                            Observaciones
                            {unreadObs.length > 0 && (
                                <span className="bg-rose-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{unreadObs.length}</span>
                            )}
                        </h2>

                        <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                            {observations.length === 0 ? (
                                <div className="text-center p-8 bg-slate-50 rounded-3xl border border-slate-200">
                                    <p className="text-4xl mb-3">📋</p>
                                    <p className="font-bold text-slate-500 text-sm">Sin observaciones recientes.</p>
                                </div>
                            ) : observations.map(obs => (
                                <div key={obs.id} className={`bg-white p-5 rounded-2xl border shadow-sm transition-all ${!obs.isRead ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs font-black px-2 py-1 rounded-lg uppercase tracking-widest ${
                                                obs.feedbackType === 'POSITIVE' ? 'bg-emerald-100 text-emerald-700' :
                                                obs.feedbackType === 'NEGATIVE' ? 'bg-rose-100 text-rose-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {obs.feedbackType === 'POSITIVE' ? '✓ Positivo' : obs.feedbackType === 'NEGATIVE' ? '✗ Negativo' : '— Neutro'}
                                            </span>
                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                                {obs.mealType === 'BREAKFAST' ? '🌅 Desayuno' : obs.mealType === 'LUNCH' ? '☀️ Almuerzo' : obs.mealType === 'DINNER' ? '🌙 Cena' : '🍽 General'}
                                            </span>
                                        </div>
                                        <div className="flex gap-0.5">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} className={`w-3 h-3 ${i < obs.satisfactionScore ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-slate-700 mb-3">{obs.comments}</p>
                                    {obs.photoUrl && (
                                        <img src={obs.photoUrl} alt="Foto" className="w-full h-32 object-cover rounded-xl mb-3 border border-slate-200" />
                                    )}
                                    <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                                        <span className="text-xs text-slate-400 font-medium">
                                            {obs.supervisor?.name} · {format(new Date(obs.createdAt), "dd MMM, hh:mm a", { locale: es })}
                                        </span>
                                        {!obs.isRead ? (
                                            <button
                                                onClick={() => handleMarkRead(obs.id)}
                                                disabled={markingRead === obs.id}
                                                className="flex items-center gap-1 text-xs font-black text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl hover:bg-teal-100 transition-colors disabled:opacity-50"
                                            >
                                                {markingRead === obs.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                                Leído
                                            </button>
                                        ) : (
                                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-teal-500" /> Leído
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {toast && (
                <div
                    className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-[2rem] shadow-xl font-bold text-sm flex items-center gap-3 cursor-pointer ${toast.type === 'ok' ? 'bg-teal-900 text-teal-100' : 'bg-rose-900 text-rose-100'}`}
                    onClick={() => setToast(null)}
                >
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
