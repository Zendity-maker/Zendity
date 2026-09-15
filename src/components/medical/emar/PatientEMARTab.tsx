"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
    BeakerIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    ChartPieIcon,
    ClockIcon,
    PencilSquareIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/context/AuthContext";
import { FRECUENCIAS, DIAS, tieneHoraLegible, esFrecuenciaValida } from "@/lib/receta";

/**
 * LOS BORRADORES DEL INGRESO, EN LA PANTALLA DONDE SE TRABAJA.
 *
 * Una receta capturada en la admisión nace inerte —`status: DRAFT`,
 * `isActive: false`— a propósito: alguien tiene que mirarla antes de que llegue
 * a la tableta. Esa barrera se queda. Lo que fallaba era esta pantalla.
 *
 * Hasta el 14-sep-2026 esta pestaña PINTABA los borradores exactamente igual
 * que una receta viva —los sumaba bajo "Tratamientos Activos", les ponía la
 * etiqueta de carrito— y el único botón de cada fila, "Asignar Horario",
 * mandaba `action: MODIFIED`, rama que por diseño NO toca `status` ni
 * `isActive` (ver el comentario en api/med/crud/route.ts:206).
 *
 * Qué produjo eso, medido en la bitácora de producción: Celia hizo el ingreso
 * de Iris Delia Colón el 14-sep y pulsó ese botón TRECE veces sobre sus cinco
 * medicamentos —16:49:27 a 16:49:48, otra vez 16:52:28 a 16:52:51, y tres más
 * hasta 16:53:01—. Las trece devolvieron "guardado". Ninguna activó nada.
 * Repetir tres veces seguidas es lo que hace una persona cuando la pantalla no
 * responde. Después paró y lo reportó.
 *
 * Y ya había costado un caso: el Baclofen 10mg de Carlos Varona entró en su
 * ingreso el 24-jul, se quedó en borrador, y él estuvo 27 días en el hogar
 * recibiendo 4 de sus 5 medicamentos (35, 18, 18 y 17 administraciones; el
 * Baclofen, CERO). Se fue de alta el 20-ago sin recibirlo nunca.
 *
 * La ironía está documentada en el propio historial: el commit c58992e de
 * abril se titulaba "display drafted meds on profile and auto-activate on
 * schedule assignment". En septiembre se retiró la segunda mitad —con razón,
 * modificar no puede resucitar una receta sin que nada lo diga— y la pantalla
 * no se enteró. Esto cierra el hueco por el lado correcto: poniendo el acto que
 * falta, con nombre propio, no devolviendo el atajo.
 */
const ES_BORRADOR = (pm: any) => pm?.status === 'DRAFT';

/** Quien puede autorizar. Igual que WRITE_ROLES en api/med/crud/route.ts:9. */
const ROLES_QUE_AUTORIZAN = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const AVAILABLE_TIMES = [
    "05:00 AM",
    "06:00 AM",
    "08:00 AM",
    "12:00 PM",
    "02:00 PM",
    "05:00 PM",
    "08:00 PM",
    "10:00 PM",
    "08:00 AM (Semanal)"
];

const FREQUENCY_PRESETS = [
    { label: "PRN (A demanda)", times: ["PRN"], color: "rose" },
    { label: "BID (2x al día)", times: ["08:00 AM", "08:00 PM"], color: "indigo" },
    { label: "TID (3x al día)", times: ["08:00 AM", "02:00 PM", "08:00 PM"], color: "emerald" },
    { label: "QID (4x al día)", times: ["06:00 AM", "02:00 PM", "05:00 PM", "08:00 PM"], color: "amber" },
    { label: "Semanal", times: ["08:00 AM (Semanal)"], color: "purple" }
];

export default function PatientEMARTab({ patientId }: { patientId: string }) {
    const { user } = useAuth();
    const [medications, setMedications] = useState<any[]>([]);
    const [adherenceRate, setAdherenceRate] = useState<number>(0);
    const [weeklyLogsCount, setWeeklyLogsCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    // Manual Schedule Edit State
    const [editingMedId, setEditingMedId] = useState<string | null>(null);
    const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
    const [prepDuration, setPrepDuration] = useState<string>("1_SEMANA");
    const [submitting, setSubmitting] = useState(false);

    // Autorizar un borrador del ingreso.
    const [autorizando, setAutorizando] = useState<any>(null);
    const [autForm, setAutForm] = useState<{ scheduleTimes: string; frequency: string; scheduleDays: number[]; prepDuration: string; prescribedBy: string }>(
        { scheduleTimes: "", frequency: "DIARIO", scheduleDays: [], prepDuration: "1_SEMANA", prescribedBy: "" },
    );
    const [autMotivo, setAutMotivo] = useState("");
    const [autError, setAutError] = useState("");

    const puedeAutorizar = !!user?.role && ROLES_QUE_AUTORIZAN.includes(user.role);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/emar/patient/${patientId}`);
            const data = await res.json();
            if (data.success) {
                setMedications(data.medications);
                setAdherenceRate(data.adherenceRate);
                setWeeklyLogsCount(data.weeklyLogsCount);
            }
        } catch (error) {
            console.error("Error fetching patient eMAR data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (patientId) {
            fetchData();
        }
    }, [patientId]);

    const openEditModal = (pm: any) => {
        setEditingMedId(pm.id);
        const existing = pm.scheduleTimes ? pm.scheduleTimes.split(',').map((t: string) => t.trim()) : [];
        setSelectedTimes(existing);
        setPrepDuration(pm.prepDuration || "1_SEMANA");
    };

    const abrirAutorizacion = (pm: any) => {
        setAutorizando(pm);
        setAutForm({
            scheduleTimes: pm.scheduleTimes ?? "",
            frequency: esFrecuenciaValida(pm.frequency) ? pm.frequency : "DIARIO",
            scheduleDays: Array.isArray(pm.scheduleDays) ? [...pm.scheduleDays] : [],
            prepDuration: pm.prepDuration ?? "1_SEMANA",
            prescribedBy: pm.prescribedBy ?? "",
        });
        setAutMotivo("");
        setAutError("");
    };

    const toggleDia = (n: number) => {
        setAutForm(f => ({
            ...f,
            scheduleDays: f.scheduleDays.includes(n) ? f.scheduleDays.filter(d => d !== n) : [...f.scheduleDays, n].sort(),
        }));
    };

    /**
     * AUTORIZA DE VERDAD. Manda `AUTHORIZED`, que es la única rama que escribe
     * `isActive: true` + `status: 'ACTIVE'` (crud/route.ts:166-181).
     *
     * Las mismas dos guardas que /med, y por la misma razón: una pauta semanal
     * sin ningún día marcado NUNCA toca (`tocaHoy` trata la lista vacía como
     * "todos los días"), y una hora que el agrupador de packs no sabe leer se
     * descarta en silencio — es lo que dejó a 13 medicamentos de Cupey sin una
     * sola administración.
     */
    const autorizar = async () => {
        if (!autorizando) return;
        setAutError("");
        if (autMotivo.trim().length < 5) {
            setAutError("Escribe por qué se autoriza (mínimo 5 caracteres). Queda firmado con tu nombre en el expediente.");
            return;
        }
        if (autForm.frequency === 'SEMANAL' && autForm.scheduleDays.length === 0) {
            setAutError("Marca al menos un día de la semana, o el medicamento no aparecerá en ningún pack.");
            return;
        }
        if (autForm.frequency !== 'PRN' && !tieneHoraLegible(autForm.scheduleTimes)) {
            setAutError('El horario tiene que llevar al menos una hora en formato 08:00 AM. Si es solo ciertos días, elige "Solo ciertos días" y márcalos — no lo escribas dentro del horario.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/med/crud", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "AUTHORIZED",
                    patientMedicationId: autorizando.id,
                    scheduleTimes: autForm.scheduleTimes,
                    frequency: autForm.frequency,
                    scheduleDays: autForm.scheduleDays,
                    prepDuration: autForm.prepDuration,
                    prescribedBy: autForm.prescribedBy,
                    reason: autMotivo.trim(),
                }),
            });
            const data = await res.json();
            if (data.success) {
                setAutorizando(null);
                setLoading(true);
                fetchData();
            } else {
                // El modal NO se cierra si falla. Esto es justo lo que le faltaba
                // a /med: un 403 o un 404 dejaban la pantalla muda y la persona
                // volvía a pulsar.
                setAutError(data.error || "No se pudo autorizar. Inténtalo otra vez.");
            }
        } catch (e) {
            console.error(e);
            setAutError("Error de red — no se guardó nada. Comprueba la conexión.");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleTime = (time: string) => {
        setSelectedTimes(prev => {
            if (time === "PRN") return ["PRN"];
            const newTimes = prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time];
            return newTimes.filter(t => t !== "PRN");
        });
    };

    const applyPreset = (times: string[]) => {
        setSelectedTimes(times);
    };

    const saveSchedule = async () => {
        if (!editingMedId) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/med/crud", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "MODIFIED",
                    patientMedicationId: editingMedId,
                    scheduleTimes: selectedTimes.length > 0 ? selectedTimes.join(", ") : "PRN",
                    prepDuration: prepDuration,
                    authorId: user?.id,
                    reason: "Reasignación clínica de horarios (Enfermería)"
                })
            });
            const data = await res.json();
            if (data.success) {
                setEditingMedId(null);
                setLoading(true);
                fetchData();
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error de red");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-12 text-center animate-pulse">
                <BeakerIcon className="w-10 h-10 text-teal-300 mx-auto mb-4" />
                <p className="text-teal-600 font-bold">Cargando Dosier eMAR...</p>
            </div>
        );
    }

    // El endpoint manda las dos cosas en la misma lista (api/emar/patient/[id]:37).
    // Separarlas es todo el arreglo: una receta viva y un borrador del ingreso
    // no son lo mismo y no pueden verse igual.
    const borradores = medications.filter(ES_BORRADOR);
    const vivas = medications.filter(pm => !ES_BORRADOR(pm));

    return (
        <div className="space-y-6">

            {/* 1. KPIs de Adherencia (Ring Chart Simulado) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                                className="text-slate-100"
                                strokeDasharray="100, 100"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="currentColor" strokeWidth="3"
                            />
                            <path
                                className={`${adherenceRate >= 80 ? 'text-emerald-500' : adherenceRate >= 50 ? 'text-amber-500' : 'text-rose-500'}`}
                                strokeDasharray={`${adherenceRate}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="currentColor" strokeWidth="3"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center font-black text-sm text-slate-800">
                            {adherenceRate}%
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Adherencia eMAR Semanal</h3>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">
                            {adherenceRate >= 80 ? 'Óptima' : adherenceRate >= 50 ? 'Regular' : 'Crítica'}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="bg-teal-50 p-3 rounded-xl text-teal-600">
                        <ChartPieIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Dosis Contabilizadas</p>
                        <p className="text-2xl font-black text-slate-800">{weeklyLogsCount} <span className="text-sm font-medium text-slate-400">esta semana</span></p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                        <BeakerIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Tratamientos Activos</p>
                        <p className="text-2xl font-black text-slate-800">{vivas.length} <span className="text-sm font-medium text-slate-400">fármacos</span></p>
                        {/* Los borradores NO se suman aquí. Contarlos bajo el rótulo
                            "Activos" es exactamente lo que hacía creer que ya estaban. */}
                        {borradores.length > 0 && (
                            <p className="text-xs font-bold text-amber-600 mt-1">
                                + {borradores.length} del ingreso, sin autorizar
                            </p>
                        )}
                    </div>
                </div>

            </div>

            {/* AVISO: hay recetas del ingreso esperando. Va arriba del todo y no
                se puede confundir con una receta viva. */}
            {borradores.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <h3 className="text-base font-black text-amber-900">
                                {borradores.length === 1
                                    ? 'Hay 1 medicamento del ingreso sin autorizar'
                                    : `Hay ${borradores.length} medicamentos del ingreso sin autorizar`}
                            </h3>
                            <p className="text-sm font-medium text-amber-800 mt-1 leading-snug">
                                Se capturaron en la admisión y <strong>todavía no llegan a la tableta de la cuidadora</strong>.
                                Nadie los está administrando. Revísalos uno por uno abajo y autorízalos.
                            </p>
                            {!puedeAutorizar && (
                                <p className="text-sm font-bold text-amber-900 mt-2">
                                    Tú no tienes permiso para autorizarlos — avisa a enfermería o a dirección.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Listado de Medicamentos Activos con su Historial Reciente */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-lg font-black text-slate-800">Posología y Trazabilidad (Últimos 20 Eventos)</h3>
                    {/* Botón "Añadir Medicamento" — visible para NURSE+. Abre /med
                        con el paciente pre-cargado vía ?addForPatient=. Resuelve
                        el bug de UX donde la enfermera llegaba a la ficha y no
                        encontraba cómo prescribir desde ahí. */}
                    {user?.role && ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'].includes(user.role) && (
                        <a
                            href={`/med?addForPatient=${patientId}`}
                            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-sm transition-colors"
                        >
                            <BeakerIcon className="w-4 h-4" />
                            Añadir Medicamento
                        </a>
                    )}
                </div>

                {medications.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-slate-500 font-medium">El residente no figura con tratamientos farmacológicos activos.</p>
                        {user?.role && ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'].includes(user.role) && (
                            <a
                                href={`/med?addForPatient=${patientId}`}
                                className="inline-flex items-center gap-2 mt-4 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors"
                            >
                                <BeakerIcon className="w-4 h-4" />
                                Prescribir primer medicamento
                            </a>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {/* Los borradores primero: son los que necesitan una decisión. */}
                        {[...borradores, ...vivas].map((pm: any) => (
                            <div key={pm.id} className={`p-6 ${ES_BORRADOR(pm) ? 'bg-amber-50/60 border-l-4 border-amber-400' : ''}`}>
                                {/* Cabecera del Medicamento */}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className={`text-lg font-black flex items-center gap-2 flex-wrap ${ES_BORRADOR(pm) ? 'text-amber-900' : 'text-teal-900'}`}>
                                            {pm.medication.name}
                                            {pm.frequency === 'PRN' && <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded uppercase tracking-widest">S.O.S</span>}
                                            {ES_BORRADOR(pm) && (
                                                <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded uppercase tracking-widest border border-amber-400">
                                                    Sin autorizar — no llega a la tableta
                                                </span>
                                            )}
                                        </h4>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <p className="text-sm font-bold text-slate-500 mt-1">
                                                Dosis: {pm.medication.dosage}  Vía: {pm.medication.route}  Freq: {pm.frequency === 'PRN' ? 'A demanda' : pm.scheduleTimes}
                                            </p>
                                            {/* La etiqueta de carrito solo si de verdad va a un carrito.
                                                En un borrador prometía algo que no pasaba. */}
                                            {!ES_BORRADOR(pm) && pm.prepDuration === '2_SEMANAS' && (
                                                <span className="text-[10px] mt-1 bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-violet-200">Carrito 14 Días</span>
                                            )}
                                            {!ES_BORRADOR(pm) && pm.prepDuration === '1_SEMANA' && (
                                                <span className="text-[10px] mt-1 bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-blue-200">Carrito 7 Días</span>
                                            )}

                                            {ES_BORRADOR(pm) ? (
                                                puedeAutorizar ? (
                                                    <button
                                                        onClick={() => abrirAutorizacion(pm)}
                                                        className="bg-amber-500 hover:bg-amber-600 text-white font-black px-4 py-1.5 rounded-lg text-xs mt-1 transition-colors flex items-center gap-1.5 shadow-sm"
                                                    >
                                                        <CheckCircleIcon className="w-4 h-4" /> Revisar y autorizar
                                                    </button>
                                                ) : (
                                                    <span className="text-xs font-bold text-amber-700 mt-1">
                                                        Solo enfermería o dirección pueden autorizarlo.
                                                    </span>
                                                )
                                            ) : (
                                                <button
                                                    onClick={() => openEditModal(pm)}
                                                    className="bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 font-bold px-3 py-1 rounded-lg text-xs mt-1 transition-colors flex items-center gap-1 border border-slate-200"
                                                >
                                                    <PencilSquareIcon className="w-3 h-3" /> Asignar Horario
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1 italic">"{pm.instructions}"</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Prescrito por</p>
                                        <p className="text-sm font-medium text-slate-700">{pm.prescribedBy || <span className="text-slate-400 font-normal italic">Sin anotar</span>}</p>
                                    </div>
                                </div>

                                {/* Timeline Minimizado de Suministros (Solo los ultimos 5 por estetica) */}
                                {pm.administrations && pm.administrations.length > 0 ? (
                                    <div className="bg-slate-50 rounded-xl p-4 mt-4 border border-slate-100">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Historial Reciente de Suministros</p>
                                        <div className="space-y-3">
                                            {pm.administrations.slice(0, 5).map((log: any) => (
                                                <div key={log.id} className="flex items-start gap-3">
                                                    <div className="mt-0.5">
                                                        {log.status === 'ADMINISTERED' && <CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
                                                        {log.status === 'REFUSED' && <XCircleIcon className="w-5 h-5 text-rose-500" />}
                                                        {log.status === 'OMITTED' && <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                            {log.status === 'ADMINISTERED' ? 'Suministrado' : log.status === 'REFUSED' ? 'Rechazado' : 'Omitido'}
                                                            <span className="text-xs text-slate-400 flex items-center gap-1 font-medium"><ClockIcon className="w-3 h-3" /> {format(new Date(log.administeredAt), "dd MMM, HH:mm")}</span>
                                                        </p>
                                                        {log.notes && <p className="text-xs text-slate-500 mt-0.5 italic text-rose-600">Nota: {log.notes}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                            {pm.administrations.length > 5 && (
                                                <p className="text-xs text-slate-400 font-medium pl-8 italic">+ {pm.administrations.length - 5} registros anteriores ocultos</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`rounded-xl p-4 mt-4 border border-dashed ${ES_BORRADOR(pm) ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                                        <p className={`text-xs font-medium text-center ${ES_BORRADOR(pm) ? 'text-amber-800' : 'text-slate-400'}`}>
                                            {ES_BORRADOR(pm)
                                                ? 'Todavía no se ha administrado ninguna dosis, y no se administrará hasta que se autorice.'
                                                : 'Ningún registro de administración en el historial aún.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de AUTORIZACIÓN de un borrador del ingreso.
                Exige lo mismo que /med: horario legible, días si es semanal, y
                un motivo clínico escrito a mano que queda firmado con el usuario
                de la sesión. La barrera no se relaja — solo cambia de sitio. */}
            {autorizando && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl p-8 w-full max-w-lg shadow-2xl my-8">
                        <h3 className="text-2xl font-black text-slate-800 mb-1">Revisar y autorizar</h3>
                        <p className="text-lg font-black text-amber-800">{autorizando.medication?.name}</p>
                        <p className="text-sm font-medium text-slate-500 mt-2 mb-6 border-b border-slate-100 pb-4 leading-snug">
                            Se capturó en la admisión y todavía no llega a la tableta. Al autorizarlo
                            empieza a aparecer en el carrito de la cuidadora. Queda firmado con tu nombre.
                        </p>

                        <div className="mb-5">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">¿Con qué frecuencia?</label>
                            <div className="space-y-2">
                                {FRECUENCIAS.map(f => (
                                    <label
                                        key={f.codigo}
                                        className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${autForm.frequency === f.codigo ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <input
                                            type="radio"
                                            checked={autForm.frequency === f.codigo}
                                            onChange={() => setAutForm(s => ({ ...s, frequency: f.codigo }))}
                                            className="mt-0.5 w-4 h-4 text-teal-600 focus:ring-teal-500"
                                        />
                                        <span className="min-w-0">
                                            <span className="block font-bold text-sm text-slate-800">{f.etiqueta}</span>
                                            <span className="block text-xs text-slate-500 leading-snug">{f.ayuda}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {autForm.frequency === 'SEMANAL' && (
                            <div className="mb-5">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">¿Qué días?</label>
                                <div className="flex gap-2 flex-wrap">
                                    {DIAS.map(d => (
                                        <button
                                            key={d.n}
                                            type="button"
                                            onClick={() => toggleDia(d.n)}
                                            title={d.largo}
                                            className={`w-11 h-11 rounded-xl font-black text-sm border-2 transition-all ${autForm.scheduleDays.includes(d.n) ? 'border-teal-500 bg-teal-600 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                        >
                                            {d.corto}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {autForm.frequency !== 'PRN' && (
                            <div className="mb-5">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">¿A qué hora?</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {AVAILABLE_TIMES.filter(t => !t.includes('Semanal')).map(time => {
                                        const puestas = autForm.scheduleTimes.split(',').map(t => t.trim()).filter(Boolean);
                                        const activa = puestas.includes(time);
                                        return (
                                            <label key={time} className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${activa ? 'border-teal-500 bg-teal-50 text-teal-900' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={activa}
                                                    onChange={() => setAutForm(s => {
                                                        const ya = s.scheduleTimes.split(',').map(t => t.trim()).filter(Boolean);
                                                        const nuevas = ya.includes(time) ? ya.filter(t => t !== time) : [...ya, time];
                                                        return { ...s, scheduleTimes: nuevas.join(', ') };
                                                    })}
                                                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                                                />
                                                <span className="font-bold text-sm">{time}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="mb-5">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                Médico que lo recetó <span className="font-medium normal-case tracking-normal text-slate-400">(opcional)</span>
                            </label>
                            <input
                                type="text"
                                value={autForm.prescribedBy}
                                onChange={e => setAutForm(s => ({ ...s, prescribedBy: e.target.value }))}
                                placeholder="Ej: Dra. Rivera, Cardiología"
                                className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-teal-500 focus:outline-none"
                            />
                        </div>

                        <div className="mb-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">¿Para qué es? — obligatorio</label>
                            <input
                                type="text"
                                value={autMotivo}
                                onChange={e => setAutMotivo(e.target.value)}
                                placeholder="Ej: Para la presión arterial"
                                className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-teal-500 focus:outline-none"
                            />
                        </div>

                        {autError && (
                            <div className="mt-4 bg-rose-50 border-2 border-rose-200 rounded-xl p-3">
                                <p className="text-sm font-bold text-rose-800 leading-snug">{autError}</p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-6 mt-4 border-t border-slate-100">
                            <button
                                onClick={() => setAutorizando(null)}
                                className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={autorizar}
                                disabled={submitting}
                                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? 'Autorizando...' : 'Autorizar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Reasignación Manual de Horarios */}
            {editingMedId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 leading-relaxed">
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Asignar Horarios</h3>
                        <p className="text-sm font-medium text-slate-500 mb-6 border-b border-slate-100 pb-4">Define en qué carritos aparecerá este medicamento para las cuidadoras.</p>

                        <div className="mb-6 p-4 bg-teal-50 border border-teal-100 rounded-xl">
                            <h4 className="text-sm font-black text-teal-900 mb-3 flex items-center gap-2"> Preparación de Carrito (Blíster)</h4>
                            <div className="flex gap-4">
                                <label className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${prepDuration === '1_SEMANA' ? 'border-teal-500 bg-teal-600 text-white shadow-md' : 'border-teal-200 text-teal-700 bg-white hover:border-teal-300'}`}>
                                    <input type="radio" value="1_SEMANA" checked={prepDuration === '1_SEMANA'} onChange={(e) => setPrepDuration(e.target.value)} className="hidden" />
                                    <span className="font-bold text-sm">1 Semana</span>
                                    <span className={`text-[10px] uppercase font-bold mt-1 ${prepDuration === '1_SEMANA' ? 'text-teal-200' : 'text-teal-400'}`}>7 Días</span>
                                </label>
                                <label className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${prepDuration === '2_SEMANAS' ? 'border-teal-500 bg-teal-600 text-white shadow-md' : 'border-teal-200 text-teal-700 bg-white hover:border-teal-300'}`}>
                                    <input type="radio" value="2_SEMANAS" checked={prepDuration === '2_SEMANAS'} onChange={(e) => setPrepDuration(e.target.value)} className="hidden" />
                                    <span className="font-bold text-sm">2 Semanas</span>
                                    <span className={`text-[10px] uppercase font-bold mt-1 ${prepDuration === '2_SEMANAS' ? 'text-teal-200' : 'text-teal-400'}`}>14 Días</span>
                                </label>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Accesos Rápidos (Frecuencia)</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {FREQUENCY_PRESETS.map(preset => (
                                    <button
                                        key={preset.label}
                                        onClick={() => applyPreset(preset.times)}
                                        className={`py-2 px-3 rounded-xl font-bold text-sm border-2 transition-all text-left ${JSON.stringify(selectedTimes) === JSON.stringify(preset.times)
                                            ? `border-${preset.color}-500 bg-${preset.color}-50 text-${preset.color}-700 shadow-sm ring-2 ring-${preset.color}-500/20 ring-offset-1`
                                            : `border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50`
                                            }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-8">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Distribución Manual (Recuentos)</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {AVAILABLE_TIMES.map(time => (
                                    <label key={time} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedTimes.includes(time) ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-sm' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTimes.includes(time)}
                                            onChange={() => toggleTime(time)}
                                            className="w-5 h-5 text-teal-600 rounded border-slate-300 focus:ring-teal-500 focus:ring-2 focus:ring-offset-1"
                                        />
                                        <span className="font-bold text-sm">{time}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setEditingMedId(null)}
                                className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveSchedule}
                                disabled={submitting || selectedTimes.length === 0}
                                className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? 'Guardando...' : 'Aplicar Horarios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
