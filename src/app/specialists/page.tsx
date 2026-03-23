"use client";

import { useEffect, useState } from "react";
import { FaUserMd, FaCamera, FaCheckCircle, FaExclamationTriangle, FaSignOutAlt, FaNotesMedical, FaListAlt } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SpecialistsPortal() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [evidenceUrl, setEvidenceUrl] = useState("");
    const [notes, setNotes] = useState("");
    const [completingId, setCompletingId] = useState<string | null>(null);

    const loadAppointments = () => {
        fetch('/api/specialists/appointments')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setAppointments(data.appointments);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        loadAppointments();
    }, []);

    const isDiabetic = (diet: string | null) => {
        return diet && diet.toLowerCase().includes('diabétic');
    };

    const markAsCompleted = async (appointmentId: string) => {
        setCompletingId(appointmentId);
        try {
            const res = await fetch('/api/specialists/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appointmentId,
                    status: 'COMPLETED',
                    notes: notes || 'Servicio realizado con éxito.',
                    evidenceUrl
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Servicio finalizado exitosamente. Zendi IA notificará al Familiar con tu reporte.");
                setNotes("");
                setEvidenceUrl("");
                loadAppointments();
            } else {
                alert(data.error || "Hubo un error");
            }
        } catch (e) {
            alert("Error de conexión");
        }
        setCompletingId(null);
    };

    if (loading) return (
        <div className="flex justify-center items-center min-h-screen bg-slate-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            {/* Nav */}
            <nav className="bg-indigo-900 shadow-md">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white font-black text-2xl border border-white/20">
                                <FaUserMd className="text-xl" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Zendity Specialists</h1>
                                <p className="text-xs font-medium text-indigo-300 uppercase tracking-widest">{user?.name} | {user?.role === 'THERAPIST' ? 'Terapia Clínica' : 'Cuidado & Belleza'}</p>
                            </div>
                        </div>
                        <button onClick={logout} className="p-3 rounded-full bg-white/5 text-white hover:bg-rose-500 hover:text-white transition-all border border-white/10">
                            <FaSignOutAlt />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <FaListAlt className="text-indigo-500" /> Agenda de Servicios Pendientes
                    </h2>
                </div>

                {appointments.filter(a => a.status === 'SCHEDULED' || a.status === 'PENDING').length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-100 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-3xl mb-4"></div>
                        <h3 className="text-xl font-bold text-slate-800">No hay citas pendientes</h3>
                        <p className="text-slate-500 mt-2">Has completado todos los servicios o no tienes nuevas reservas en esta Clínica.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {appointments.filter(a => a.status === 'SCHEDULED' || a.status === 'PENDING').map(appt => (
                            <div key={appt.id} className="bg-white rounded-3xl p-6 shadow-md shadow-slate-100/50 border border-slate-100/60 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-indigo-100">
                                            {appt.service.category}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800 mb-1">{appt.patient.name}</h3>
                                    <p className="text-sm font-bold text-slate-500 flex items-center gap-2 mb-4">
                                        Habitación: {appt.patient.roomNumber || 'No Asignada'}
                                    </p>

                                    {/* CRITICAL B2B LOGIC: Diabetics Precaution Alert */}
                                    {isDiabetic(appt.patient.diet) && user?.role === 'BEAUTY_SPECIALIST' && (
                                        <div className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl mb-4 shadow-sm animate-pulse">
                                            <div className="flex items-center gap-2 text-rose-600 font-black mb-1">
                                                <FaExclamationTriangle /> PRECAUCIÓN MÉDICA
                                            </div>
                                            <p className="text-xs font-bold text-rose-500 leading-tight">
                                                El Residente es Diabético. Uso mandatorio de Instrumental Estéril No-Abrasivo. Prohibido extraer cutícula para evitar infecciones.
                                            </p>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Servicio Contratado</p>
                                        <p className="text-slate-800 font-bold">{appt.service.name}</p>
                                    </div>

                                    {user?.role === 'THERAPIST' && (
                                        <div className="mb-4">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Notas Clínicas de Terapia</label>
                                            <textarea
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                                rows={3}
                                                placeholder="Ej. El residente mostró mejoría en la movilidad del brazo..."
                                                value={notes}
                                                onChange={e => setNotes(e.target.value)}
                                            ></textarea>
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-2">
                                            <FaCamera /> Foto Evidencia (Opcional)
                                        </label>
                                        <input
                                            type="url"
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="URL Pública del Antes/Después"
                                            value={evidenceUrl}
                                            onChange={e => setEvidenceUrl(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => markAsCompleted(appt.id)}
                                    disabled={completingId === appt.id}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50 disabled:hover:bg-indigo-600"
                                >
                                    {completingId === appt.id ? 'Marcando...' : <><FaCheckCircle /> Finalizar y Notificar Famila</>}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
