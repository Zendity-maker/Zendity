"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function FamilyDashboardPage() {
    const { user } = useAuth();
    const { status } = useSession();
    const router = useRouter();
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/familiar/login");
        } else if (status === "authenticated" && user?.role === "FAMILY") {
            fetchFamilyReport();
        } else if (status === "authenticated" && user?.role !== "FAMILY") {
            // Un Doctor no debería estar en el portal de familias
            router.push("/");
        }
    }, [status, user]);

    const fetchFamilyReport = async () => {
        try {
            const res = await fetch("/api/family/report");
            const json = await res.json();
            if (json.success) {
                setReport(json.data);
            } else {
                console.error("No se pudo cargar el reporte del residente.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading || status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FFF9F2]">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FFF9F2] p-6 text-center">
                <div>
                    <span className="text-4xl">⚠️</span>
                    <h2 className="text-xl font-bold text-slate-800 mt-4">Aún no hay reportes de enfermería hoy.</h2>
                    <p className="text-slate-500 mt-2">Nuestros cuidadores están organizando el turno. Vuelve pronto.</p>
                    <button onClick={() => signOut({ callbackUrl: "/familiar/login" })} className="mt-6 px-6 py-2 bg-slate-200 rounded-full font-bold text-slate-600">Cerrar Sesión</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FFF9F2] font-sans pb-20">
            {/* Header / Nav Móvil */}
            <div className="bg-white px-6 py-6 rounded-b-[2rem] shadow-sm flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-400 to-rose-400 flex items-center justify-center shadow-md shadow-orange-500/20">
                        <span className="text-white font-bold text-xl">{report.patientParams.name.charAt(0)}</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 leading-tight truncate max-w-[200px]">{report.patientParams.name}</h1>
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Verificado por {user?.hqName}</p>
                    </div>
                </div>
                <button onClick={() => signOut({ callbackUrl: "/familiar/login" })} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                    <span className="text-lg">🚪</span>
                </button>
            </div>

            <main className="px-6 mt-8 space-y-6 max-w-lg mx-auto">
                {/* Saludo de Enfermería */}
                <div className="bg-white rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-[100px] -z-0"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl text-rose-500">💌</span>
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Diario de Cuidados</h2>
                        </div>
                        <p className="text-slate-700 font-medium leading-relaxed">
                            {report.empatheticMessage}
                        </p>
                    </div>
                </div>

                {/* Widgets Gráficos de Bienestar */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-[2rem] p-6 shadow-md shadow-slate-200/50 border border-slate-100 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 delay-100">
                        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-2xl mb-3 ring-4 ring-emerald-50/50">
                            {report.recentLog?.foodIntake >= 75 ? '🍲' : '💧'}
                        </div>
                        <h3 className="text-2xl font-black text-slate-800">{report.recentLog?.foodIntake || 0}%</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Apetito Hoy</p>
                    </div>

                    <div className="bg-white rounded-[2rem] p-6 shadow-md shadow-slate-200/50 border border-slate-100 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 delay-200">
                        <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-2xl mb-3 ring-4 ring-blue-50/50">
                            {report.vitals?.[0]?.temperature > 99.5 ? '🤒' : '❤️'}
                        </div>
                        <h3 className="text-lg font-black text-slate-800">{report.vitals?.[0]?.systolic || '--'}/{report.vitals?.[0]?.diastolic || '--'}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Presión y Vit.</p>
                    </div>
                </div>

                {/* Próximas Citas */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-6 shadow-lg shadow-slate-900/20 text-white animate-in fade-in slide-in-from-bottom-4 delay-300">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold">Próximas Citas o Eventos</h2>
                        <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold">{report.appointments?.length || 0}</span>
                    </div>

                    {report.appointments?.length > 0 ? (
                        <div className="space-y-3">
                            {report.appointments.map((app: any, i: number) => (
                                <div key={i} className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl">
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">📅</div>
                                    <div>
                                        <p className="font-bold text-sm">{app.type}</p>
                                        <p className="text-xs text-slate-300">{new Date(app.appointmentDate).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 font-medium text-center py-4 bg-white/5 rounded-2xl border border-white/10">
                            No hay eventos médicos próximos agendados para este mes y se encuentra en constante mejoría.
                        </p>
                    )}
                </div>

                {/* Action CTA */}
                <button
                    onClick={() => router.push('/familiar/messages')}
                    className="w-full bg-white border-2 border-orange-100 text-orange-600 font-bold rounded-2xl p-5 shadow-sm hover:bg-orange-50 transition-colors flex items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-4 delay-500"
                >
                    <span className="text-xl">💬</span>
                    Dejarle un mensaje al Cuidador
                </button>
            </main>
        </div>
    );
}
