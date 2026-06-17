"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
    MessageCircle, Calendar, Users, Send, Loader2, RefreshCw, Inbox, ArrowRight,
} from "lucide-react";

/**
 * /coordinator — Dashboard del hub compartido "Comunicación Familiar".
 *
 * Accesible a COORDINATOR + ADMIN + DIRECTOR + NURSE. Sprint Coordinador
 * (jun-2026). Muestra contadores rápidos + accesos al hub:
 *   - Mensajes sin leer de familias (POST /api/corporate/family-messages → unreadCount)
 *   - Citas pendientes (GET /api/corporate/family-appointments?status=PENDING)
 *   - Lista de residentes (link a /corporate/medical/patients)
 *
 * El coordinador NO tiene endpoints propios — todo reusa los del hub
 * corporate. Esta página es solo orquestación.
 */

const HUB_ROLES = ['COORDINATOR', 'ADMIN', 'DIRECTOR', 'NURSE'];

export default function CoordinatorDashboardPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [unreadConversations, setUnreadConversations] = useState(0);
    const [totalConversations, setTotalConversations] = useState(0);
    const [pendingAppointments, setPendingAppointments] = useState(0);

    const allowed = user && (
        HUB_ROLES.includes(user.role || '') ||
        ((user as any).secondaryRoles ?? []).some((r: string) => HUB_ROLES.includes(r))
    );

    const fetchCounters = async () => {
        setLoading(true);
        try {
            const [msgRes, apptRes] = await Promise.all([
                fetch('/api/corporate/family-messages'),
                fetch('/api/corporate/family-appointments?status=PENDING'),
            ]);
            if (msgRes.ok) {
                const j = await msgRes.json();
                const convs = j?.conversations || [];
                setTotalConversations(convs.length);
                setUnreadConversations(convs.filter((c: any) => c.unreadCount > 0).length);
            }
            if (apptRes.ok) {
                const j = await apptRes.json();
                setPendingAppointments((j?.appointments || []).length);
            }
        } catch (e) {
            console.error('coordinator dashboard fetch', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && allowed) fetchCounters();
        if (!authLoading && !allowed) router.replace('/');
    }, [authLoading, allowed, router]);

    if (authLoading || !user) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;
    }
    if (!allowed) return null;

    return (
        <div className="max-w-6xl mx-auto p-6 md:p-10">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Comunicación Familiar</h1>
                    <p className="text-sm text-slate-500 mt-1">Hub compartido — coordinación entre el equipo y las familias.</p>
                </div>
                <button
                    onClick={fetchCounters}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:text-teal-700 border border-slate-200 hover:border-teal-300 rounded-xl transition-colors"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Link href="/corporate/family-messages" className="group">
                    <div className="bg-white border border-slate-200 hover:border-teal-300 rounded-2xl p-5 transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center"><Inbox className="w-5 h-5" /></div>
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">Conversaciones</h3>
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-3xl font-black text-slate-900">{unreadConversations}</span>
                            <span className="text-sm text-slate-500">sin leer · de {totalConversations}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-bold text-teal-600 mt-3 group-hover:gap-2 transition-all">
                            Abrir bandeja <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </Link>

                <Link href="/corporate/family-appointments" className="group">
                    <div className="bg-white border border-slate-200 hover:border-teal-300 rounded-2xl p-5 transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><Calendar className="w-5 h-5" /></div>
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">Citas pendientes</h3>
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-3xl font-black text-slate-900">{pendingAppointments}</span>
                            <span className="text-sm text-slate-500">por aprobar</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-600 mt-3 group-hover:gap-2 transition-all">
                            Ver solicitudes <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </Link>

                <Link href="/corporate/medical/patients" className="group">
                    <div className="bg-white border border-slate-200 hover:border-teal-300 rounded-2xl p-5 transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center"><Users className="w-5 h-5" /></div>
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">Residentes</h3>
                        </div>
                        <p className="text-sm text-slate-600">Acceder al directorio para ver perfiles y datos de familia.</p>
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-600 mt-3 group-hover:gap-2 transition-all">
                            Abrir directorio <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </Link>
            </div>

            {/* Acciones rápidas */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Acciones rápidas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Link
                        href="/corporate/family-messages"
                        className="flex items-center gap-3 bg-white border border-slate-200 hover:border-teal-300 rounded-xl px-4 py-3 transition-all group"
                    >
                        <MessageCircle className="w-5 h-5 text-teal-600" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">Responder mensajes</p>
                            <p className="text-xs text-slate-500">Bandeja unificada por residente</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                    <Link
                        href="/corporate/family-broadcast"
                        className="flex items-center gap-3 bg-white border border-slate-200 hover:border-teal-300 rounded-xl px-4 py-3 transition-all group"
                    >
                        <Send className="w-5 h-5 text-teal-600" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">Enviar comunicado</p>
                            <p className="text-xs text-slate-500">Broadcast a todas las familias registradas</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                    <Link
                        href="/coordinator/refer"
                        className="flex items-center gap-3 bg-white border border-slate-200 hover:border-teal-300 rounded-xl px-4 py-3 transition-all group md:col-span-2"
                    >
                        <Users className="w-5 h-5 text-teal-600" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">Referir al equipo</p>
                            <p className="text-xs text-slate-500">Ruta una tarea a Enfermería, Trabajo Social o Administración</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
