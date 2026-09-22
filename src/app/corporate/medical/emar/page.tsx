"use client";

import { useState, useEffect } from "react";
import HoraDelRegistro from "@/components/care/HoraDelRegistro";
import { useAuth } from '@/context/AuthContext';
import Link from "next/link";
import {
    BeakerIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    MoonIcon,
    SunIcon,
    ChevronDownIcon,
    ChevronUpIcon
} from "@heroicons/react/24/outline";

/** "05:00 AM" → 300. Para ordenar las rondas por el reloj y no por el alfabeto. */
function minutosDe(franja: string): number {
    const m = franja.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return 9999;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const periodo = m[3]?.toUpperCase();
    if (periodo === 'PM' && h !== 12) h += 12;
    if (periodo === 'AM' && h === 12) h = 0;
    return h * 60 + min;
}

export default function EMARDashboardPage() {
    const { user } = useAuth();
    const [patients, setPatients] = useState<any[]>([]);
    // Arranca en la ronda de las 8:00 AM si existe; si no, en la primera que haya.
    const [activeFilter, setActiveFilter] = useState("08:00 AM");
    const [loadingData, setLoadingData] = useState(true);
    const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

    const fetchPatients = async () => {
        try {
            const res = await fetch("/api/emar");
            const data = await res.json();
            if (data.success) {
                setPatients(data.patients);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    // -- Modales de Novedad Clínica --
    const [selectedMed, setSelectedMed] = useState<any>(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [actionNotes, setActionNotes] = useState("");
    const [actionType, setActionType] = useState<"ADMINISTERED" | "REFUSED" | "OMITTED" | null>(null);
    /**
     * LA HORA A LA QUE SE ADMINISTRÓ DE VERDAD. `null` = ahora.
     *
     * Esta pantalla es desde donde dirección registra lo que YA pasó — casi
     * siempre después de preguntar al piso. Hasta el 22-sep-2026 no tenía dónde
     * decirlo y el servidor clavaba la hora del tecleo: el 21-sep eso dejó **51
     * dosis pautadas a las 8:00 AM diciendo que se dieron a las 17:0x**, con la
     * administración ya corroborada por teléfono. La hora del teclado escrita
     * como si fuera la del acto.
     */
    const [horaRegistro, setHoraRegistro] = useState<Date | null>(null);

    /**
     * `franja` es la ronda concreta sobre la que se actúa, no la receta entera.
     *
     * Antes se mandaba `selectedMed.time`, que para una receta de dos tomas es
     * la cadena completa — "08:00 AM, 08:00 PM". Eso no identifica ninguna dosis:
     * el servidor no puede reconstruir su hora, no encuentra su fila, y termina
     * escribiendo una administración suelta al lado de la que el cron ya creó.
     * Es el mismo fallo que costó las diez omisiones fantasma del 15-sep.
     */
    const openActionModal = (med: any, patientInfo: any, type: "ADMINISTERED" | "REFUSED" | "OMITTED", franja: string | null) => {
        setSelectedMed({ ...med, patientName: patientInfo.name, room: patientInfo.room, franja });
        setActionType(type);
        // La hora NO se arrastra de la dosis anterior: dejar fijado
        // "hace 2 h" y seguir registrando a otra persona seria peor
        // que el problema original.
        setHoraRegistro(null);
        setIsActionModalOpen(true);
    };

    const confirmAction = async () => {
        if (!selectedMed || !actionType) return;
        if (actionType !== "ADMINISTERED" && !actionNotes.trim()) {
            return alert("Debes justificar clínicamente por qué se Rechazó/Omitió la dosis.");
        }

        try {
            const res = await fetch("/api/emar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientMedicationId: selectedMed.id,
                    status: actionType,
                    notes: actionNotes,
                    // La franja concreta. Con ella el servidor reconstruye el
                    // instante exacto y firma sobre la fila que ya existe.
                    scheduledFor: selectedMed.franja ?? null,
                    // La hora declarada. Sin ella el servidor usa `ahora`, que
                    // es el comportamiento de siempre.
                    administeredAt: horaRegistro?.toISOString(),
                })
            });

            const data = await res.json();
            if (data.success) {
                // Actualización Optimista del Frontend
                const updatedPatients = patients.map(p => ({
                    ...p,
                    medications: p.medications.map((m: any) =>
                        m.id === selectedMed.id ? { ...m, status: actionType } : m
                    )
                }));
                setPatients(updatedPatients);
                // Y se relee, para que la franja recién firmada deje de contar
                // entre las que faltan. La pintura optimista solo evita el parpadeo.
                fetchPatients();
                setTimeout(() => alert(` Transacción Exitosa: Fármaco [${actionType}] guardado irrevocablemente en el sistema.`), 100);
            } else {
                alert("Error al guardar firma biométrica.");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión al servidor Zendity.");
        } finally {
            setIsActionModalOpen(false);
            setHoraRegistro(null);
            setActionNotes("");
            setSelectedMed(null);
        }
    };

    // Tipado de autorización extendido para satisfacer Role Enum de Prisma
    const isAuthorized = user?.role === 'NURSE' || user?.role === 'ADMIN' || user?.role === 'DIRECTOR' || user?.role === 'CAREGIVER';

    if (!isAuthorized) {
        return <div className="p-8 text-center text-red-500 font-bold">Acceso Restringido: Módulo Clínico eMAR.</div>;
    }

    /**
     * LAS RONDAS QUE DE VERDAD TIENE ESTA CASA, NO CUATRO ESCRITAS A MANO.
     *
     * Aquí había cuatro botones fijos —8AM, 5PM, 8PM, PRN— y el filtro era una
     * búsqueda de texto: `m.time.includes("8") && m.time.includes("AM")`.
     *
     * Medido el 16-sep-2026 sobre los 251 medicamentos de la pantalla: **12 no
     * aparecían bajo NINGÚN filtro**. Los 11 de las "05:00 AM" —que son la ronda
     * de tiroides— y uno de las "02:00 PM". Invisibles del todo, sin manera de
     * llegar a ellos desde esta pantalla.
     *
     * Y no era un detalle: ese mismo día el panel de dirección anunciaba "10
     * medicamentos sin administrar" y enlazaba aquí. Las diez eran de las 5:00 AM.
     * El aviso llevaba al sitio correcto y el sitio no podía enseñarlas.
     *
     * Además la búsqueda por texto se contaminaba: "08:00 AM, 05:00 PM" contiene
     * un "8" y un "PM", así que salía también en la ronda de las 8 de la noche.
     *
     * Ahora las rondas salen de los datos y se comparan por franja exacta.
     */
    const RONDAS = (() => {
        const vistas = new Set<string>();
        for (const p of patients) {
            for (const m of p.medications ?? []) {
                if (m.time === 'PRN') { vistas.add('PRN'); continue; }
                (m.dosisDeHoy ?? []).forEach((d: any) => vistas.add(d.franja));
            }
        }
        const conPrn = vistas.has('PRN');
        vistas.delete('PRN');
        const ordenadas = [...vistas].sort((a, b) => minutosDe(a) - minutosDe(b));
        return conPrn ? [...ordenadas, 'PRN'] : ordenadas;
    })();

    /**
     * Si la ronda abierta no existe en esta casa, se cae a la primera que sí.
     * Sin esto, una sede sin pack de las 8:00 AM abriría en una pestaña vacía —
     * que es como se llega a creer que no hay medicamentos.
     */
    const rondaActiva = RONDAS.includes(activeFilter) ? activeFilter : (RONDAS[0] ?? activeFilter);

    const filterFn = (m: any) => {
        if (rondaActiva === 'PRN') return m.time === 'PRN';
        if (m.time === 'PRN') return false;
        return (m.dosisDeHoy ?? []).some((d: any) => d.franja === rondaActiva);
    };

    /** La franja de esta receta que toca en la ronda abierta. */
    const dosisDeLaRonda = (m: any) =>
        (m.dosisDeHoy ?? []).find((d: any) => d.franja === rondaActiva) ?? null;

    /** Todo lo que hoy quedó sin administrar, con nombre y hora. */
    const sinAdministrarHoy = patients.flatMap((p: any) =>
        (p.medications ?? []).flatMap((m: any) =>
            (m.dosisDeHoy ?? [])
                .filter((d: any) => d.estado === 'MISSED')
                .map((d: any) => ({ paciente: p, med: m, franja: d.franja })),
        ),
    );

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* 1. Header & KPI Sincronizados */}
                <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <span className="bg-teal-100 text-teal-600 p-2 rounded-xl"><BeakerIcon className="w-8 h-8" /></span>
                            eMAR Corporativo (Medications)
                        </h1>
                        <p className="text-slate-500 text-sm mt-2 font-medium">
                            Rondas de Suministro Controlado. Firma electrónica y seguimiento de adherencia.
                        </p>
                    </div>

                    {/* Las rondas que de verdad tiene la casa. Ver el comentario de RONDAS. */}
                    <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap">
                        {RONDAS.map(ronda => {
                            const pendientes = sinAdministrarHoy.filter(x => x.franja === ronda).length;
                            const Icono = ronda === 'PRN' ? BeakerIcon
                                : minutosDe(ronda) < 12 * 60 ? SunIcon
                                    : minutosDe(ronda) >= 18 * 60 ? MoonIcon : ClockIcon;
                            return (
                                <button
                                    key={ronda}
                                    onClick={() => setActiveFilter(ronda)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${rondaActiva === ronda ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Icono className="w-5 h-5" /> {ronda === 'PRN' ? 'P.R.N.' : ronda}
                                    {pendientes > 0 && (
                                        <span className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{pendientes}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/*
                    LO QUE HOY QUEDO SIN ADMINISTRAR, ARRIBA Y CON NOMBRE.

                    El panel de direccion enlaza aqui cuando cuenta medicamentos sin
                    administrar. Antes se aterrizaba en una lista de 251 filas todas
                    iguales; ahora lo que motivo el aviso esta en la primera pantalla.
                */}
                {sinAdministrarHoy.length > 0 && (
                    <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5">
                        <h2 className="text-base font-black text-rose-900 flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-5 h-5" />
                            {sinAdministrarHoy.length === 1
                                ? '1 dosis de hoy sin administrar'
                                : `${sinAdministrarHoy.length} dosis de hoy sin administrar`}
                        </h2>
                        <p className="text-sm font-medium text-rose-800 mt-1 leading-snug">
                            Su ronda ya cerró y nadie las registró. Si se dieron y falta anotarlas,
                            quien las dio puede firmarlas desde la tableta y el expediente se corrige solo.
                        </p>
                        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                            {sinAdministrarHoy.map((x, i) => (
                                <li key={i} className="text-sm flex items-baseline gap-2">
                                    <span className="font-black text-rose-900 shrink-0">{x.franja}</span>
                                    <span className="font-bold text-slate-800">{x.med.name}</span>
                                    <span className="text-slate-500 truncate">— {x.paciente.name?.trim()}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {loadingData ? (
                    <div className="p-12 text-center animate-pulse">
                        <BeakerIcon className="w-12 h-12 text-teal-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-teal-700">Enlazando con Farmacia...</h2>
                        <p className="text-sm font-medium text-slate-500 mt-2">Buscando prescripciones y horarios B2B.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {patients.map(patient => {
                            const filteredMeds = patient.medications.filter(filterFn);
                            if (filteredMeds.length === 0) return null; // No renderizar si no tiene prescipciones en este turno

                            const isExpanded = expandedPatientId === patient.id;

                            return (
                                <div key={patient.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">

                                    <div
                                        className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => setExpandedPatientId(isExpanded ? null : patient.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 font-black flex items-center justify-center border-2 border-white shadow-sm">
                                                {patient.room}
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-black text-slate-800">{patient.name}</h2>
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{filteredMeds.length} Fármacos Asignados</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Link href={`/corporate/medical/patients/${patient.id}`} className="text-teal-600 font-bold text-sm hover:underline" onClick={(e) => e.stopPropagation()}>
                                                Ver Historial
                                            </Link>
                                            {isExpanded ? (
                                                <ChevronUpIcon className="w-6 h-6 text-slate-500" />
                                            ) : (
                                                <ChevronDownIcon className="w-6 h-6 text-slate-500" />
                                            )}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2">
                                            {filteredMeds.map((med: any) => {
                                            /**
                                             * El estado de LA DOSIS DE ESTA RONDA, no el de la receta.
                                             *
                                             * `med.status` salía de "la última administración de hoy" y
                                             * daba PENDING para todo lo no administrado — incluidas las
                                             * omisiones, que es justo lo que había que ver. El 16-sep la
                                             * pantalla pintaba 251 filas y las 251 decían PENDING.
                                             */
                                            const dosis = dosisDeLaRonda(med);
                                            const estado = med.time === 'PRN' ? 'PRN' : (dosis?.estado ?? 'SIN_PROGRAMAR');
                                            const resuelta = ['ADMINISTERED', 'REFUSED', 'OMITTED', 'HELD'].includes(estado);
                                            const omitida = estado === 'MISSED';
                                            return (
                                                <div key={med.id} className={`p-6 flex justify-between items-center transition-colors ${omitida ? 'bg-rose-50 border-l-4 border-rose-400' : resuelta ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}>

                                                    <div className="flex gap-5">
                                                        {/* Status Indicator Icon */}
                                                        <div className="mt-1">
                                                            {(estado === 'PENDING' || estado === 'PRN' || estado === 'SIN_PROGRAMAR') && <ClockIcon className="w-6 h-6 text-slate-500" />}
                                                            {estado === 'MISSED' && <ExclamationTriangleIcon className="w-6 h-6 text-rose-600" />}
                                                            {estado === 'ADMINISTERED' && <CheckCircleIcon className="w-6 h-6 text-emerald-500" />}
                                                            {estado === 'REFUSED' && <XCircleIcon className="w-6 h-6 text-rose-500" />}
                                                            {(estado === 'OMITTED' || estado === 'HELD') && <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />}
                                                        </div>

                                                        <div>
                                                            <div className="flex items-center gap-3">
                                                                <h3 className={`font-black text-lg ${resuelta ? 'text-slate-500 line-through decoration-slate-300' : omitida ? 'text-rose-900' : 'text-slate-800'}`}>
                                                                    {med.name}
                                                                </h3>
                                                                {med.time === 'PRN' ? (
                                                                    <span className="bg-rose-100 text-rose-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">SOS / PRN</span>
                                                                ) : (
                                                                    <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">{dosis?.franja ?? med.time}</span>
                                                                )}
                                                                {omitida && (
                                                                    <span className="bg-rose-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">Sin administrar</span>
                                                                )}
                                                            </div>

                                                            <div className="flex gap-4 mt-2">
                                                                <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                                                    <span className="inline-block w-2 h-2 rounded-full bg-teal-400"></span>
                                                                    Vía {med.route}
                                                                </p>
                                                                <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                                                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-400"></span>
                                                                    Nota: {med.instructions}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons (Firma Electrónica).
                                                        Una dosis MISSED tambien se puede firmar: si se dio y
                                                        falta anotarla, anotarla es lo correcto y la fila se
                                                        corrige. Lo que no se vuelve a tocar es lo ya resuelto. */}
                                                    {!resuelta ? (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => openActionModal(med, patient, 'ADMINISTERED', dosis?.franja ?? null)}
                                                                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all"
                                                            >
                                                                Suministrar
                                                            </button>
                                                            <button
                                                                onClick={() => openActionModal(med, patient, 'REFUSED', dosis?.franja ?? null)}
                                                                className="bg-white text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all"
                                                            >
                                                                Rechazó
                                                            </button>
                                                            <button
                                                                onClick={() => openActionModal(med, patient, 'OMITTED', dosis?.franja ?? null)}
                                                                className="bg-white text-amber-600 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all"
                                                            >
                                                                Omitir
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                                                            Registrado 
                                                        </div>
                                                    )}

                                                </div>
                                            );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Empty State Guard */}
                        {patients.every(p => p.medications.filter(filterFn).length === 0) && (
                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center">
                                <BeakerIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                <h3 className="text-xl font-black text-slate-500">Ronda Limpia</h3>
                                <p className="text-slate-500 mt-2 font-medium">No hay prescripciones activas para este horario de recuento.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. MODAL DE BIO-FIRMA CLINICA */}
                {isActionModalOpen && selectedMed && (
                    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className={`bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border-t-8 
                            ${actionType === 'ADMINISTERED' ? 'border-emerald-500' :
                                actionType === 'REFUSED' ? 'border-rose-500' : 'border-amber-500'}
                        `}>
                            <div className="p-6">
                                <h3 className="text-xl font-black text-slate-800 mb-1">
                                    {actionType === 'ADMINISTERED' ? 'Confirmar Suministro' :
                                        actionType === 'REFUSED' ? 'Registrar Rechazo' : 'Omitir Dosis'}
                                </h3>
                                <p className="text-slate-500 text-sm font-medium mb-6">Residente: <span className="font-bold text-slate-700">{selectedMed.patientName} (Hab. {selectedMed.room})</span></p>

                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6">
                                    <p className="font-black text-lg text-slate-800">{selectedMed.name}</p>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{selectedMed.route}  {selectedMed.time}</p>
                                </div>

                                {/* La hora real, solo donde tiene sentido: una dosis que
                                    NO se dio no tiene hora de administración. */}
                                {actionType === 'ADMINISTERED' && (
                                    <div className="mb-6">
                                        <HoraDelRegistro valor={horaRegistro} onChange={setHoraRegistro} />
                                    </div>
                                )}

                                {actionType !== 'ADMINISTERED' && (
                                    <div className="mb-6">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Justificación Médica (Obligatorio) </label>
                                        <textarea
                                            value={actionNotes}
                                            onChange={(e) => setActionNotes(e.target.value)}
                                            placeholder={actionType === 'REFUSED' ? "Ej. Residente escupió la pastilla..." : "Ej. Médico ordenó suspender por fiebre..."}
                                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none min-h-[100px]"
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={confirmAction}
                                    className={`w-full py-3.5 rounded-xl font-black text-white shadow-md transition-all 
                                        ${actionType === 'ADMINISTERED' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' :
                                            actionType === 'REFUSED' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' :
                                                'bg-amber-500 hover:bg-amber-600 shadow-amber-200'}
                                    `}
                                >
                                    Firmar con PIN Virtual
                                </button>
                                <button
                                    onClick={() => { setIsActionModalOpen(false); setActionNotes(""); setSelectedMed(null); setHoraRegistro(null); }}
                                    className="w-full py-3 mt-2 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar Operación
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
