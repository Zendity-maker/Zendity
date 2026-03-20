"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FileSignature, Users, AlertOctagon, ActivitySquare } from 'lucide-react';

interface PatientNote {
    patient: { name: string; roomNumber: string };
    clinicalNotes: string;
    isCritical: boolean;
}

interface Handover {
    id: string;
    shiftType: string;
    outgoingNurse: { name: string; role: string };
    incomingNurse?: { name: string; role: string };
    status: string;
    createdAt: string;
    acceptedAt?: string;
    notes: PatientNote[];
}

export default function HandoversPage() {
    const { user } = useAuth();
    const activeHqId = user?.headquartersId || user?.hqId;
    const [handovers, setHandovers] = useState<Handover[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // -- ESTADO DEL MODAL --
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [patients, setPatients] = useState<{ id: string, name: string, roomNumber: string }[]>([]);
    const [nurses, setNurses] = useState<{ id: string, name: string }[]>([]);
    const [formShift, setFormShift] = useState('MORNING');
    const [formIncomingUser, setFormIncomingUser] = useState('');
    const [formNotes, setFormNotes] = useState<{ patientId: string, clinicalNotes: string, isCritical: boolean }[]>([]);

    // -- AI STATE --
    const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);

    // -- FASE 23: UPP COMPLIANCE LOCK --
    const [hasNegligenceWarning, setHasNegligenceWarning] = useState(false);
    const [patientsWithOverdueRotations, setPatientsWithOverdueRotations] = useState<{ name: string, overdueHours: number }[]>([
        // Mock de datos para prueba de Phase 23. En Prod, esto vendría del Backend (PosturalLogs)
        { name: "Carmen Rivera", overdueHours: 2.5 }
    ]);

    // -- FASE 24: FALL RISK LOCK --
    const [hasFallRiskWarning, setHasFallRiskWarning] = useState(false);
    const [recentFallsWithoutNotes, setRecentFallsWithoutNotes] = useState<{ id: string, name: string, time: string }[]>([
        // Mock de datos para prueba de Phase 24. Residentes con incidentes en las últimas 8 hrs.
        { id: "p-roberto", name: "Roberto González", time: "Hace 4 horas (Baño)" }
    ]);

    const fetchHandovers = async () => {
        if (!activeHqId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`/api/medical/handovers?headquartersId=${activeHqId}`);
            if (res.ok) {
                const data = await res.json();
                setHandovers(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user !== undefined) fetchHandovers();
    }, [activeHqId, user]);

    // -- ABRIR MODAL & CARGAR DATA --
    const handleOpenModal = async () => {
        if (!activeHqId) return alert("Falta Contexto HQ.");
        setIsModalOpen(true);
        try {
            // Llenar Lista de Residentes (Asignables)
            const pRes = await fetch(`/api/patients?headquartersId=${activeHqId}`);
            if (pRes.ok) setPatients(await pRes.json());

            // Llenar Lista de Enfermeros Entrantes (B2B Staff)
            // Asumimos un endpoint corporativo existente de RRHH o lo simulamos
            const uRes = await fetch(`/api/corporate/users?headquartersId=${activeHqId}&role=NURSE,CAREGIVER`);
            if (uRes.ok) setNurses(await uRes.json());
        } catch (e) { console.error(e); }
    };

    const addNoteField = () => {
        setFormNotes([...formNotes, { patientId: '', clinicalNotes: '', isCritical: false }]);
    };

    const autoCompleteWithZendi = async () => {
        if (!activeHqId) return;
        setIsGeneratingDigest(true);
        try {
            const res = await fetch('/api/ai/zendi-digest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ headquartersId: activeHqId })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.notes && data.notes.length > 0) {
                    // Combinar las notas generadas por AI con las que ya estaban
                    setFormNotes(prev => [...prev, ...data.notes]);
                } else {
                    alert(data.message || "No se detectaron novedades clínicas en las bitácoras recientes.");
                }
            } else {
                alert("Error al contactar con Zendi AI.");
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión con OpenAI.");
        } finally {
            setIsGeneratingDigest(false);
        }
    };

    const submitHandover = async () => {
        if (!formIncomingUser || formNotes.length === 0) {
            return alert("Requerido: Una enfermera entrante y al menos 1 nota clínica.");
        }

        // FASE 23 COMPLIANCE: Validar si hay residentes en rojo antes de submitear
        if (patientsWithOverdueRotations.length > 0 && !hasNegligenceWarning) {
            setHasNegligenceWarning(true);
            return; // Bloquea la entrega de guardia (No-Code Lock)
        }

        // FASE 24 FALL RISK LOCK: Validar si hubo caídas y no fueron reportadas en notes
        const unreportedFalls = recentFallsWithoutNotes.filter(
            fall => !formNotes.some(note => note.patientId === fall.id)
        );

        if (unreportedFalls.length > 0 && !hasFallRiskWarning) {
            setHasFallRiskWarning(true);
            return; // Bloqueo de Caídas (Fase 24)
        }

        try {
            const res = await fetch(`/api/medical/handovers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "CREATE_HANDOVER",
                    headquartersId: activeHqId,
                    shiftType: formShift,
                    outgoingNurseId: user?.id,
                    incomingNurseId: formIncomingUser,
                    // Si se forzó el handover, adjuntamos la infracción auto-generada
                    notes: hasNegligenceWarning ? [
                        ...formNotes,
                        { patientId: "mock", clinicalNotes: "ALERTA DE SISTEMA: Entrega de turno con rotaciones postulares vencidas (>2 hrs) en Carmen Rivera.", isCritical: true }
                    ] : hasFallRiskWarning ? [
                        ...formNotes,
                        { patientId: unreportedFalls[0].id, clinicalNotes: `ALERTA DE SISTEMA: Entrega de turno omitiendo ampliación sobre Incidente de Caída en ${unreportedFalls[0].name}.`, isCritical: true }
                    ] : formNotes
                })
            });

            if (res.ok) {
                alert("Guardia Entregada y encolada.");
                setIsModalOpen(false);
                setHasNegligenceWarning(false);
                setHasFallRiskWarning(false);
                fetchHandovers();
                setFormNotes([]);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleAcceptHandover = async (handoverId: string) => {
        // En un entorno de producción, verificaremos que incomingNurseId === user.id
        const confirmAccept = confirm("¿Declaras haber leído las notas críticas y asumes formalmente la guardia de los residentes?");
        if (!confirmAccept) return;

        try {
            const res = await fetch(`/api/medical/handovers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "ACCEPT_HANDOVER", handoverId })
            });

            if (res.ok) {
                alert("Guardia Relevada Exitosamente.");
                fetchHandovers();
            } else {
                alert("Hubo un error al firmar el relevo.");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const isAuthorized = user?.role && ['NURSE', 'ADMIN', 'CAREGIVER', 'DIRECTOR', 'HR', 'SUPERADMIN'].includes(user.role);

    if (!isAuthorized) {
        return <div className="p-8 text-center text-red-500 font-bold">No tienes permiso para acceder al registro de Relevos de Guardia.</div>;
    }

    // -- KPIs DE AUDITORIA CORPORATIVA --
    const pendingHandovers = handovers.filter(h => h.status === 'PENDING').length;
    const criticalNotesCount = handovers.reduce((acc, h) => acc + h.notes.filter(n => n.isCritical).length, 0);
    const uniqueStaff = new Set();
    handovers.forEach(h => {
        if (h.outgoingNurse) uniqueStaff.add(h.outgoingNurse.name);
        if (h.incomingNurse) uniqueStaff.add(h.incomingNurse.name);
    });
    const staffCount = uniqueStaff.size;

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200/60 mb-8">
                <div>
                    <h1 className="text-3xl font-black bg-gradient-to-r from-teal-900 to-teal-700 bg-clip-text text-transparent tracking-tight flex items-center gap-3">
                        <ActivitySquare className="w-8 h-8 text-teal-600" />
                        Auditoría de Relevos de Guardia
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-2">
                        Dashboard Directivo: Monitorea la continuidad clínica y firmas de responsabilidad (Shift Handovers).
                    </p>
                </div>
                <button
                    className="mt-4 md:mt-0 bg-slate-900 hover:bg-black text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-slate-900/10 transition-all flex items-center gap-2"
                    onClick={handleOpenModal}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Nuevo Reporte Mixto
                </button>
            </div>

            {/* FASE 68: KPI CARDS DIRECTIVAS */}
            {!isLoading && handovers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200/80 hover:border-amber-300 transition-colors">
                        <div className="flex justify-between items-start">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Pendientes de Firma</h3>
                            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><FileSignature className="w-5 h-5" /></div>
                        </div>
                        <div className="mt-4 flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-800">{pendingHandovers}</span>
                            <span className="text-sm font-bold text-amber-500 uppercase">Sin Autorizar</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200/80 hover:border-rose-300 transition-colors">
                        <div className="flex justify-between items-start">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Alertas Críticas Activas</h3>
                            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl"><AlertOctagon className="w-5 h-5" /></div>
                        </div>
                        <div className="mt-4 flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-800">{criticalNotesCount}</span>
                            <span className="text-sm font-bold text-rose-500 uppercase">Avisos Zendi</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200/80 hover:border-teal-300 transition-colors">
                        <div className="flex justify-between items-start">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Staff Involucrado</h3>
                            <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl"><Users className="w-5 h-5" /></div>
                        </div>
                        <div className="mt-4 flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-800">{staffCount}</span>
                            <span className="text-sm font-bold text-teal-500 uppercase">Enfermeros</span>
                        </div>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                        <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-500">
                            <ActivitySquare className="w-6 h-6" />
                        </div>
                        <p className="font-bold text-slate-400 tracking-wider text-sm uppercase">Recuperando Bitácoras...</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {handovers.length === 0 ? (
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                            <h3 className="text-slate-500 font-bold mb-2">No hay Handovers Existentes.</h3>
                            <p className="text-slate-400 text-sm">Empieza tu cultura operativa libre de papeles creando el primero.</p>
                        </div>
                    ) : (
                        handovers.map((handover) => (
                            <div key={handover.id} className={`bg-white border rounded-3xl p-6 shadow-sm overflow-hidden relative ${handover.status === 'PENDING' ? 'border-amber-300 ring-4 ring-amber-50' : 'border-slate-200'}`}>

                                {/* Cinta Superior Decorativa */}
                                <div className={`absolute top-0 left-0 w-full h-2 ${handover.status === 'PENDING' ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-emerald-400 to-teal-400'}`} />

                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="bg-slate-100 text-slate-600 text-xs font-black uppercase px-3 py-1 rounded-lg tracking-wider">
                                                Turno {handover.shiftType}
                                            </span>
                                            <span className={`text-xs font-black uppercase px-3 py-1 rounded-lg flex items-center gap-1 ${handover.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {handover.status === 'PENDING' ? (
                                                    <>
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        Pendiente de Firma
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        Guardia Relevada
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 text-xs">{new Date(handover.createdAt).toLocaleString('es-PR')}</p>
                                    </div>

                                    {handover.status === 'PENDING' && (
                                        <button
                                            onClick={() => handleAcceptHandover(handover.id)}
                                            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-md shadow-amber-200 text-sm"
                                        >
                                            Asumir Piso (Recibir)
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6">
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Enfermera Saliente</p>
                                        <p className="text-slate-800 font-bold flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">S</span>
                                            {handover.outgoingNurse.name}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Enfermera Entrante</p>
                                        <p className="text-slate-800 font-bold flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">E</span>
                                            {handover.incomingNurse?.name || "No Especificada / Abierta"}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                        Novedades por Residente ({handover.notes.length})
                                    </h4>
                                    <div className="space-y-3">
                                        {handover.notes.map((note, idx) => (
                                            <div key={idx} className={`p-4 rounded-2xl border ${note.isCritical ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className={`font-bold ${note.isCritical ? 'text-rose-700' : 'text-slate-700'}`}>
                                                        {note.patient.name} <span className="text-xs opacity-60 ml-1">(Cuarto {note.patient.roomNumber || 'N/A'})</span>
                                                    </p>
                                                    {note.isCritical && (
                                                        <span className="bg-rose-100 text-rose-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                            Atención Crítica
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`text-sm ${note.isCritical ? 'text-rose-600 font-medium' : 'text-slate-600'}`}>
                                                    {note.clinicalNotes}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        ))
                    )}
                </div>
            )}

            {/* MODAL CREADOR DE HANDOVERS */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-600 p-2 rounded-xl">✍️</span>
                                Redactar Relevo de Guardia
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mi Turno Saliente</label>
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none" value={formShift} onChange={e => setFormShift(e.target.value)}>
                                        <option value="MORNING">Mañana (6am - 2pm)</option>
                                        <option value="EVENING">Tarde (2pm - 10pm)</option>
                                        <option value="NIGHT">Noche (10pm - 6am)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Transfiero El Mando A:</label>
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none" value={formIncomingUser} onChange={e => setFormIncomingUser(e.target.value)}>
                                        <option value="">-- Seleccionar Relevo --</option>
                                        {nurses.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="block text-sm font-bold text-indigo-900 uppercase">Alertas a Vigilar ({formNotes.length})</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={autoCompleteWithZendi}
                                            disabled={isGeneratingDigest}
                                            className="bg-slate-900 hover:bg-black text-white border border-indigo-500/30 hover:border-indigo-400 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                                        >
                                            {isGeneratingDigest ? (
                                                <svg className="animate-spin h-3.5 w-3.5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            ) : (
                                                <>
                                                    <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors">✨</span> Zendi AI Auto-Completar
                                                </>
                                            )}
                                        </button>
                                        <button onClick={addNoteField} className="text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-indigo-200 bg-white">+ Añadir Manual</button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {formNotes.map((note, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 grid gap-3 relative">
                                            <button onClick={() => setFormNotes(formNotes.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-rose-400 hover:text-rose-600">✕</button>
                                            <select
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-medium pr-8"
                                                value={note.patientId}
                                                onChange={e => {
                                                    const newNotes = [...formNotes];
                                                    newNotes[idx].patientId = e.target.value;
                                                    setFormNotes(newNotes);
                                                }}
                                            >
                                                <option value="">Seleccionar Residente</option>
                                                <option value="p-roberto">Roberto González (H. 101)</option>
                                                {patients.map(p => <option key={p.id} value={p.id}>{p.name} (H. {p.roomNumber})</option>)}
                                            </select>

                                            <textarea
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm min-h-[80px]"
                                                placeholder="Novedades: Vómito leve, se recetó descanso."
                                                value={note.clinicalNotes}
                                                onChange={e => {
                                                    const newNotes = [...formNotes];
                                                    newNotes[idx].clinicalNotes = e.target.value;
                                                    setFormNotes(newNotes);
                                                }}
                                            />

                                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer w-fit">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500"
                                                    checked={note.isCritical}
                                                    onChange={e => {
                                                        const newNotes = [...formNotes];
                                                        newNotes[idx].isCritical = e.target.checked;
                                                        setFormNotes(newNotes);
                                                    }}
                                                />
                                                Marcar como Riesgo Crítico 🚨
                                            </label>
                                        </div>
                                    ))}
                                    {formNotes.length === 0 && (
                                        <div className="text-center py-4 text-indigo-300 text-sm font-medium">Ninguna nota activa. Pincha en "+ Añadir Residente" para informar eventualidades.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between">
                            <span className="text-xs text-slate-400 flex max-w-xs items-center leading-tight">Zendity Corporate: Todas las entregas quedan firmadas temporalmente.</span>
                            <div className="flex gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors">Cancelar</button>
                                <button onClick={submitHandover} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-200 transition-colors">Firmar y Entregar Cuidado</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* FASE 23: MODAL DE NEGLIGENCIA (No-Code Lock) */}
            {hasNegligenceWarning && (
                <div className="fixed inset-0 z-[60] bg-rose-900/40 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-5 text-rose-600">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">¡Alto! Reloj Cutáneo Vencido</h3>
                        <p className="text-slate-600 mb-6">
                            El sistema detectó que estás intentando hacer el traspaso de mando pero dejaste residentes encamados con su reloj de rotación postural expirado (Rojo).
                        </p>

                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-left mb-8 space-y-2">
                            {patientsWithOverdueRotations.map(p => (
                                <p key={p.name} className="flex justify-between font-bold text-rose-800 text-sm">
                                    <span>{p.name}</span>
                                    <span>{p.overdueHours} hs de inmovilidad</span>
                                </p>
                            ))}
                        </div>

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setHasNegligenceWarning(false)}
                                className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-neutral-100 hover:bg-neutral-200 transition"
                            >
                                Regresar y Rotarlos
                            </button>
                            <button
                                onClick={submitHandover}
                                className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl font-bold shadow-md shadow-rose-200 transition"
                            >
                                Forzar Handover (Reportar Dto. Salud)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FASE 24: MODAL DE RIESGO DE CAÍDA SILENCIADA */}
            {hasFallRiskWarning && (
                <div className="fixed inset-0 z-[60] bg-amber-900/40 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center animate-in fade-in zoom-in duration-200 border-2 border-amber-500">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5 text-amber-600">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-black text-amber-800 mb-2">¡Alto! Hubo una Caída en tu turno</h3>
                        <p className="text-slate-600 mb-6">
                            Zendity Engine interceptó el traspaso. Tienes residentes que sufrieron Incidentes de Caída recientemente, pero **no redactaste Notas Clínicas** aclarando su estado actual para la enfermera entrante.
                        </p>

                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left mb-8 space-y-2">
                            {recentFallsWithoutNotes.map(p => (
                                <p key={p.name} className="flex justify-between font-bold text-amber-800 text-sm">
                                    <span>{p.name}</span>
                                    <span>{p.time}</span>
                                </p>
                            ))}
                        </div>

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setHasFallRiskWarning(false)}
                                className="px-6 py-3 rounded-xl font-bold text-slate-800 bg-amber-200 hover:bg-amber-300 transition shadow-md"
                            >
                                Regresar y Añadir Notas
                            </button>
                            <button
                                onClick={submitHandover}
                                className="bg-neutral-800 hover:bg-neutral-900 text-white px-6 py-3 rounded-xl font-bold shadow-md transition"
                            >
                                Entregar sin Novedad (Riesgoso)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
