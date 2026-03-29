"use client";

import { useState, useEffect } from "react";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, dateFnsLocalizer, View, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Calendar as CalendarIcon, Loader2, Plus, Trash2, Clock, MapPin, UserSquare2, CheckCircle2, Users, User, Palette } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const locales = { es };
const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), // Lunes a Domingo
    getDay,
    locales,
});

type CorporateEvent = {
    id: string;
    title: string;
    description: string | null;
    type: string;
    startTime: string;
    endTime: string;
    patient?: { id: string, name: string } | null;
};

export default function CorporateCalendarPage() {
    const { user } = useAuth();
    const [events, setEvents] = useState<CorporateEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);

    // Form state
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [type, setType] = useState("OTHER");
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Advanced Audience Targeting States
    const [patientsList, setPatientsList] = useState<any[]>([]);
    const [targetPopulation, setTargetPopulation] = useState("ALL"); // ALL, GROUP, SPECIFIC
    const [targetGroups, setTargetGroups] = useState<string[]>([]);
    const [targetPatients, setTargetPatients] = useState<string[]>([]);

    useEffect(() => {
        fetchEvents();
        fetchPatients();
    }, []);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    const fetchPatients = async () => {
        try {
            const res = await fetch("/api/corporate/medical/patients");
            if (res.ok) {
                const data = await res.json();
                setPatientsList(data.patients || []);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchEvents = async () => {
        try {
            const res = await fetch("/api/corporate/calendar");
            if (res.ok) {
                const data = await res.json();
                setEvents(data.events || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/corporate/calendar?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchEvents();
                setToast({ msg: "Evento eliminado del calendario.", type: 'ok' });
            } else {
                setToast({ msg: "Sin permiso para eliminar este evento.", type: 'err' });
            }
        } catch (error) {
            console.error(error);
            setToast({ msg: "Error al eliminar el evento.", type: 'err' });
        } finally {
            setDeleteModal(null);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const startDateTime = new Date(`${startDate}T${startTime}`);
            const endDateTime = new Date(`${startDate}T${endTime}`);

            const payload = {
                title,
                description: desc,
                type,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                targetPopulation,
                targetGroups: targetPopulation === "GROUP" ? targetGroups : [],
                targetPatients: targetPopulation === "SPECIFIC" ? targetPatients : []
            };

            const res = await fetch("/api/corporate/calendar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsModalOpen(false);
                setTitle("");
                setDesc("");
                setTargetPopulation("ALL");
                setTargetGroups([]);
                setTargetPatients([]);
                fetchEvents();
            } else {
                setToast({ msg: "Error guardando el evento. Intenta de nuevo.", type: 'err' });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Adaptador de eventos para React Big Calendar
    const calendarEvents = events.map(e => ({
        id: e.id,
        title: e.title,
        start: new Date(e.startTime),
        end: new Date(e.endTime),
        resource: e
    }));

    // Estilizador Condicional B2B
    const eventPropGetter = (event: any) => {
        let backgroundColor = '#3174ad';
        switch (event.resource.type) {
            case 'LABORATORY': backgroundColor = '#ef4444'; break; // Rojo
            case 'MEDICAL_VISIT': backgroundColor = '#3b82f6'; break; // Azul
            case 'FAMILY_VISIT': backgroundColor = '#f59e0b'; break; // Ambar
            case 'ACTIVITY': backgroundColor = '#10b981'; break; // Verde
            default: backgroundColor = '#64748b'; break; // Gris
        }
        return { style: { backgroundColor, borderRadius: '6px', border: 'none', color: 'white', fontWeight: 'bold' } };
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-teal-600" />
                        Calendario Institucional
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Sincronización Operativa B2B. Los eventos notificarán a las Tabletas de Piso.</p>
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold shadow-md flex items-center gap-2 transition-transform transform active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Agendar Actividad
                </button>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                {loading ? (
                    <div className="h-[600px] flex items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
                    </div>
                ) : (
                    <div className="h-[600px]">
                        <Calendar
                            localizer={localizer}
                            events={calendarEvents}
                            startAccessor="start"
                            endAccessor="end"
                            culture="es"
                            views={['month', 'week', 'day']}
                            defaultView="week"
                            eventPropGetter={eventPropGetter}
                            messages={{
                                next: "Siguiente",
                                previous: "Anterior",
                                today: "Hoy",
                                month: "Mes",
                                week: "Semana",
                                day: "Día"
                            }}
                            onSelectEvent={(event: any) => setDeleteModal({ id: event.id, title: event.title })}
                        />
                    </div>
                )}
            </div>

            {/* Agendar Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">Nueva Operación</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-2 bg-slate-100 rounded-full">X</button>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Título del Evento</label>
                                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Laboratorios Clínicos en Ayunas" className="w-full font-bold text-slate-900 border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-teal-500 outline-none" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Categoría</label>
                                    <select value={type} onChange={e => setType(e.target.value)} className="w-full font-bold text-slate-900 border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-teal-500 outline-none">
                                        <option value="LABORATORY"> Laboratorio (Rojo)</option>
                                        <option value="MEDICAL_VISIT"> Visita Médica (Azul)</option>
                                        <option value="FAMILY_VISIT"> Visita Familiar (Ambar)</option>
                                        <option value="ACTIVITY"> Recreación (Verde)</option>
                                        <option value="OTHER"> Otro / Administrativo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Fecha</label>
                                    <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-teal-500 outline-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Hora Arribo</label>
                                    <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-teal-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Hora Fin Estimado</label>
                                    <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-teal-500 outline-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Instrucciones a Cuidadores (Opcional)</label>
                                <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej. Mantener al residente en ayunas..." className="w-full font-medium text-slate-900 border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-teal-500 outline-none h-24 resize-none"></textarea>
                            </div>

                            {/* AUDIENCE SELECTORS (FASE 51) */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
                                <label className="block text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-indigo-500" />
                                    Audiencia del Evento (Sincronización Zendi)
                                </label>
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    <button type="button" onClick={() => setTargetPopulation('ALL')} className={`py-2 px-3 text-xs font-bold rounded-lg border ${targetPopulation === 'ALL' ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>Toda la Población</button>
                                    <button type="button" onClick={() => setTargetPopulation('GROUP')} className={`py-2 px-3 text-xs font-bold rounded-lg border ${targetPopulation === 'GROUP' ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>Grupos de Color</button>
                                    <button type="button" onClick={() => setTargetPopulation('SPECIFIC')} className={`py-2 px-3 text-xs font-bold rounded-lg border ${targetPopulation === 'SPECIFIC' ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>Residentes Específicos</button>
                                </div>

                                {targetPopulation === 'GROUP' && (
                                    <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95">
                                        {['RED', 'YELLOW', 'GREEN', 'BLUE'].map(color => (
                                            <label key={color} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                                <input type="checkbox" checked={targetGroups.includes(color)} onChange={(e) => {
                                                    if (e.target.checked) setTargetGroups([...targetGroups, color]);
                                                    else setTargetGroups(targetGroups.filter(c => c !== color));
                                                }} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-3 h-3 rounded-full bg-${color.toLowerCase()}-500`}></div>
                                                    <span className="text-sm font-bold text-slate-700 uppercase">{color}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {targetPopulation === 'SPECIFIC' && (
                                    <div className="max-h-40 overflow-y-auto space-y-1 bg-white border border-slate-200 rounded-lg p-2 animate-in fade-in zoom-in-95">
                                        {patientsList.length > 0 ? patientsList.map(patient => (
                                            <label key={patient.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors">
                                                <input type="checkbox" checked={targetPatients.includes(patient.id)} onChange={(e) => {
                                                    if (e.target.checked) setTargetPatients([...targetPatients, patient.id]);
                                                    else setTargetPatients(targetPatients.filter(id => id !== patient.id));
                                                }} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-800">{patient.name}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">Piso / Cuarto: {patient.roomNumber || 'N/A'}</span>
                                                </div>
                                            </label>
                                        )) : (
                                            <p className="text-xs text-center text-slate-500 py-4 font-medium">Cargando residentes...</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg mt-6 flex justify-center items-center gap-2">
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Agendar y Notificar</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {deleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200">
                        <h3 className="text-xl font-black text-slate-800 mb-2">Eliminar evento</h3>
                        <p className="text-slate-500 text-sm font-medium mb-2">¿Confirmas que deseas cancelar este evento del sistema?</p>
                        <p className="font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 text-sm">{deleteModal.title}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModal(null)}
                                className="flex-1 py-4 rounded-[2rem] bg-slate-100 text-slate-600 font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(deleteModal.id)}
                                className="flex-1 py-4 rounded-[2rem] bg-rose-600 text-white font-black text-sm uppercase tracking-widest hover:bg-rose-700 transition-colors"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div
                    className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-[2rem] shadow-xl font-bold text-sm flex items-center gap-3 cursor-pointer ${
                        toast.type === 'ok' ? 'bg-teal-900 text-teal-100' : 'bg-rose-900 text-rose-100'
                    }`}
                    onClick={() => setToast(null)}
                >
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
