"use client";

import { useEffect, useState } from "react";
import { FRECUENCIAS, DIAS, tieneHoraLegible, esFrecuenciaValida } from "@/lib/receta";
import { useAuth } from "@/context/AuthContext";
import { useActiveHq } from "@/contexts/ActiveHqContext";
import TaskAssignmentButton from "@/components/TaskAssignmentButton";

interface Medication { id: string; name: string; dosage: string; }
interface Patient { id: string; name: string; roomNumber: string; colorGroup: string; medications: any[]; }

export default function ZendityMedPage() {
    const { user } = useAuth();
    const { activeHqId } = useActiveHq();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);

    // CRUD State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedMed, setSelectedMed] = useState<any>(null);
    const [crudReason, setCrudReason] = useState("");
    const [crudAction, setCrudAction] = useState<"MODIFIED" | "DISCONTINUED" | null>(null);
    /**
     * LO QUE SE ESTA EDITANDO DE UNA RECETA VIVA.
     *
     * Antes esto era un solo `newSchedule` que se inicializaba con
     * `med.scheduleTime` —un campo que no existe: el modelo lo llama
     * `scheduleTimes`— asi que el recuadro abria VACIO, sin la hora actual. Y
     * el modal no preguntaba por la frecuencia ni por los dias, asi que editar
     * una receta semanal la devolvia a diaria y le borraba los dias.
     */
    const [editForm, setEditForm] = useState({
        scheduleTimes: "", frequency: "DIARIO", scheduleDays: [] as number[], prepDuration: "1_SEMANA",
    });
    const [submitting, setSubmitting] = useState(false);

    // Add Med State
    const [addMedModalOpen, setAddMedModalOpen] = useState(false);
    const [catalog, setCatalog] = useState<any[]>([]);
    /**
     * `frequency` y `prescribedBy` existen en el modelo desde siempre y este
     * formulario no los pedia. Ver src/lib/receta.ts: por eso "semanal" se
     * escribia dentro del horario y el medicamento desaparecia de la tableta,
     * y por eso 261 de 261 medicamentos activos no tienen prescriptor.
     */
    const [addForm, setAddForm] = useState({
        patientId: "", medicationId: "", scheduleTimes: "08:00 AM", prepDuration: "1_SEMANA",
        frequency: "DIARIO", scheduleDays: [] as number[], prescribedBy: "",
        reason: "Asignación Inicial de Fármaco",
    });
    const [medSearch, setMedSearch] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        fetchPatients();
    }, [activeHqId]);

    // Deep-link desde la ficha del residente: ?addForPatient=<id>
    // pre-abre el modal de "Añadir Medicamento" con el paciente seleccionado.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const targetPatient = params.get('addForPatient');
        if (!targetPatient) return;
        // Carga catálogo y abre modal.
        fetch("/api/med/crud").then(r => r.json()).then(d => {
            setCatalog(d.medications || []);
            setAddForm(prev => ({ ...prev, patientId: targetPatient }));
            setAddMedModalOpen(true);
        }).catch(() => {});
    }, []);

    const fetchPatients = async () => {
        try {
            // El hqId es una SUGERENCIA para el switcher multi-sede: el servidor
            // lo pasa por resolveEffectiveHqId y un rol de una sola sede recibe
            // siempre la suya. Antes caia a "hq-demo-1" — un id inventado que
            // CLAUDE.md prohibe y que aqui no hacia nada salvo confundir.
            const hq = (activeHqId && activeHqId !== 'ALL') ? activeHqId : '';
            const res = await fetch(`/api/med${hq ? `?hqId=${hq}` : ''}`);
            const data = await res.json();
            if (data.success) {
                // Nuevo contrato: si el backend ya envía `patients` agrupados,
                // los usamos directos (incluye residentes sin meds — necesario
                // para que la enfermera pueda añadir el PRIMER medicamento).
                // Si no, hacemos fallback al groupBy histórico sobre data.
                if (Array.isArray(data.patients)) {
                    setPatients(
                        data.patients.map((p: any) => ({
                            ...p,
                            medications: (p.medications || []).filter((m: any) => m.isActive !== false),
                        }))
                    );
                } else {
                    const grouped = data.data.reduce((acc: any, curr: any) => {
                        if (!acc[curr.patient.id]) {
                            acc[curr.patient.id] = { ...curr.patient, medications: [] };
                        }
                        if (curr.alertsEnabled !== false) {
                            acc[curr.patient.id].medications.push(curr);
                        }
                        return acc;
                    }, {});
                    setPatients(Object.values(grouped));
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCrudSubmit = async () => {
        if (!crudReason) { alert("Obligatorio justificar el cambio (Auditoría HIPAA)."); return; }
        if (crudAction === 'MODIFIED') {
            // Las mismas dos guardas que al añadir. Una pauta semanal sin día no
            // toca nunca, y una hora que no parsea no llega a la tableta.
            if (editForm.frequency === 'SEMANAL' && editForm.scheduleDays.length === 0) {
                return alert("Marca al menos un día de la semana.");
            }
            if (editForm.frequency !== 'PRN' && !tieneHoraLegible(editForm.scheduleTimes)) {
                return alert("El horario tiene que llevar al menos una hora en formato 08:00 AM.\n\nSi el medicamento es solo ciertos días, elige \"Solo ciertos días\" y marca los días — no lo escribas dentro del horario.");
            }
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/med/crud", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: crudAction,
                    patientMedicationId: selectedMed.id,
                    ...(crudAction === 'MODIFIED' ? {
                        scheduleTimes: editForm.scheduleTimes,
                        frequency: editForm.frequency,
                        scheduleDays: editForm.scheduleDays,
                        prepDuration: editForm.prepDuration,
                    } : {}),
                    authorId: user?.id,
                    reason: crudReason
                })
            });
            const data = await res.json();
            if (data.success) {
                setModalOpen(false);
                setCrudReason("");
                fetchPatients();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const openCruModal = (med: any, action: "MODIFIED" | "DISCONTINUED") => {
        setSelectedMed(med);
        setCrudAction(action);
        setEditForm({
            scheduleTimes: med.scheduleTimes ?? "",
            frequency: esFrecuenciaValida(med.frequency) ? med.frequency : "DIARIO",
            scheduleDays: Array.isArray(med.scheduleDays) ? [...med.scheduleDays] : [],
            prepDuration: med.prepDuration ?? "1_SEMANA",
        });
        setModalOpen(true);
    };

    const handleAddMedSubmit = async () => {
        if (!addForm.medicationId || !addForm.reason) return alert("Faltan datos obligatorios.");
        if (addForm.frequency === 'SEMANAL' && addForm.scheduleDays.length === 0) {
            return alert("Marca al menos un día de la semana.");
        }
        // Un medicamento que no es PRN y cuya hora no parsea NO llega a la
        // tableta: se descarta en silencio al armar los packs. Es lo que dejo a
        // 13 medicamentos de Cupey sin una sola administracion.
        if (addForm.frequency !== 'PRN' && !tieneHoraLegible(addForm.scheduleTimes)) {
            return alert("El horario tiene que llevar al menos una hora en formato 08:00 AM.\n\nSi el medicamento es solo ciertos días, elige \"Solo ciertos días\" y marca los días — no lo escribas dentro del horario.");
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/med/crud", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "ADDED",
                    patientId: addForm.patientId,
                    medicationId: addForm.medicationId,
                    scheduleTimes: addForm.scheduleTimes,
                    prepDuration: addForm.prepDuration,
                    frequency: addForm.frequency,
                    scheduleDays: addForm.scheduleDays,
                    prescribedBy: addForm.prescribedBy,
                    authorId: user?.id,
                    reason: addForm.reason
                })
            });
            const data = await res.json();
            if (data.success) {
                setAddMedModalOpen(false);
                setAddForm({ ...addForm, medicationId: "", scheduleTimes: "08:00 AM", frequency: "DIARIO", scheduleDays: [], prescribedBy: "", reason: "Asignación Inicial de Fármaco" });
                setMedSearch("");
                fetchPatients();
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const colorMapping: Record<string, string> = {
        RED: "bg-red-50 text-red-700 border-red-200",
        YELLOW: "bg-amber-50 text-amber-700 border-amber-200",
        GREEN: "bg-emerald-50 text-emerald-700 border-emerald-200",
        BLUE: "bg-blue-50 text-blue-700 border-blue-200",
        UNASSIGNED: "bg-slate-50 text-slate-700"
    };

    if (loading) return <div className="p-20 text-center font-bold text-slate-500 animate-pulse text-xl">Cargando Zéndity Med (eMAR)…</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="flex justify-between items-center border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
                        Zéndity Med <span className="text-base text-teal-600 font-bold bg-teal-50 px-3 py-1 rounded-full uppercase tracking-widest border border-teal-100">Inteligencia Clínica</span>
                    </h1>
                    <p className="text-slate-500 mt-2 max-w-2xl font-medium">El historial de vida de cada fármaco del hogar. Todo cambio pide una razón escrita y queda firmado.</p>
                </div>

                <div className="flex items-center gap-3">
                    <a href="/med/briefing" className="px-6 py-2.5 rounded-xl font-black text-sm text-indigo-700 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 shadow-sm transition-all">
                        Prep. visita médica
                    </a>
                    <TaskAssignmentButton user={user} buttonStyle="px-6 py-2.5 rounded-xl font-black text-sm text-white bg-teal-600 hover:bg-teal-700 shadow-sm transition-all border border-teal-500" />
                </div>
            </div>

            {/* ========================================================= */}
            {/* PESTAÑA 1: e-MAR CRÓNICO (HIPAA AUDIT)                     */}
            {/* ========================================================= */}
            {(
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {patients.map(p => (
                        <div key={p.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
                            <div className={`p-4 border-b flex justify-between items-center ${colorMapping[p.colorGroup || 'UNASSIGNED']}`}>
                                <div>
                                    <h3 className="font-black text-lg">{p.name}</h3>
                                    <p className="text-xs font-bold uppercase tracking-widest opacity-70">Cuarto {p.roomNumber || 'N/A'}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center font-black">
                                    {p.colorGroup ? p.colorGroup.charAt(0) : '?'}
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                {p.medications.length === 0 ? (
                                    <p className="text-sm font-medium text-slate-500 text-center py-4">Sin PAI Farmacológico.</p>
                                ) : (
                                    p.medications.map((m: any) => (
                                        <div key={m.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl group relative">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-black text-slate-800 text-sm">{m.medication.name}</p>
                                                <span className="text-xs font-bold bg-white text-slate-500 px-2 py-0.5 rounded shadow-sm border border-slate-200">{m.scheduleTime}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium">{m.medication.dosage}</p>

                                            {/* Action Hover for AUDIT CRUD */}
                                            <div className="absolute inset-0 bg-slate-900/90 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                                                <button onClick={() => openCruModal(m, 'MODIFIED')} className="text-xs font-bold bg-white text-slate-900 px-4 py-1.5 rounded-lg hover:scale-105 active:scale-95 transition-all">Editar receta</button>
                                                <button onClick={() => openCruModal(m, 'DISCONTINUED')} className="text-xs font-bold bg-red-500 text-white px-4 py-1.5 rounded-lg shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95 transition-all">Descontinuar</button>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <button
                                    onClick={() => {
                                        setAddForm({ ...addForm, patientId: p.id });
                                        setMedSearch("");
                                        setAddMedModalOpen(true);
                                        if (catalog.length === 0) {
                                            fetch("/api/med/crud").then(res => res.json()).then(data => setCatalog(data.medications || []));
                                        }
                                    }}
                                    className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-500 font-bold rounded-xl text-xs hover:border-teal-400 hover:text-teal-600 transition-colors uppercase tracking-widest mt-2"
                                >
                                    + Añadir Fármaco
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL AUDITORIA CRUD HIPAA                                  */}
            {/* ========================================================= */}
            {modalOpen && selectedMed && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-8 animate-in zoom-in-95">
                        <h3 className="text-2xl font-black text-slate-900 mb-1">
                            {crudAction === 'MODIFIED' ? 'Editar la receta' : 'Descontinuar Récord'}
                        </h3>
                        <p className="text-sm font-medium text-slate-500 mb-6 border-b border-slate-100 pb-4">Auditoría Estricta: Fármaco <strong className="text-slate-800">{selectedMed.medication.name}</strong></p>

                        <div className="space-y-4">
                            {crudAction === 'MODIFIED' && (
                                <>
                                    {/* Los mismos tres campos que al añadir, y por la misma razon:
                                        si el modal no los pregunta, la API no los recibe y la pauta
                                        semanal se pierde al guardar. */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">¿Cada cuándo?</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {FRECUENCIAS.map(f => (
                                                <button
                                                    key={f.codigo}
                                                    type="button"
                                                    onClick={() => setEditForm({ ...editForm, frequency: f.codigo, scheduleDays: f.codigo === 'SEMANAL' ? editForm.scheduleDays : [] })}
                                                    className={`p-3 rounded-xl border-2 text-left transition-all ${editForm.frequency === f.codigo ? 'bg-teal-600 text-white border-teal-700' : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300'}`}
                                                >
                                                    <span className="block text-[13px] font-black leading-tight">{f.etiqueta}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1.5">
                                            {FRECUENCIAS.find(f => f.codigo === editForm.frequency)?.ayuda}
                                        </p>
                                    </div>

                                    {editForm.frequency === 'SEMANAL' && (
                                        <div className="animate-in fade-in">
                                            <label className="block text-sm font-bold text-slate-700 mb-1">¿Qué días?</label>
                                            <div className="grid grid-cols-7 gap-1.5">
                                                {DIAS.map(d => {
                                                    const puesto = editForm.scheduleDays.includes(d.n);
                                                    return (
                                                        <button
                                                            key={d.n}
                                                            type="button"
                                                            title={d.largo}
                                                            onClick={() => setEditForm({ ...editForm, scheduleDays: puesto ? editForm.scheduleDays.filter(x => x !== d.n) : [...editForm.scheduleDays, d.n].sort() })}
                                                            className={`py-3 rounded-xl border-2 font-black text-sm transition-all ${puesto ? 'bg-teal-600 text-white border-teal-700' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300'}`}
                                                        >{d.corto}</button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {editForm.frequency !== 'PRN' && (
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Horario de Suministro</label>
                                            <input type="text" value={editForm.scheduleTimes} onChange={e => setEditForm({ ...editForm, scheduleTimes: e.target.value })} className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500" placeholder="Ej: 08:00 AM, 08:00 PM" />
                                            <p className="text-[11px] text-slate-400 mt-1.5">
                                                Solo horas, separadas por coma. Los días van arriba.
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <label className="block text-sm font-bold text-amber-900 mb-1 flex items-center gap-2"><span></span> Razón Obligatoria (HIPAA)</label>
                                <textarea value={crudReason} onChange={e => setCrudReason(e.target.value)} placeholder="Ej. Por orden médica verbal de Dr. Smith al teléfono 8:00pm." className="w-full p-2 bg-white/50 border border-amber-200 focus:border-amber-400 rounded-lg text-sm font-medium text-amber-900 min-h-[80px]"></textarea>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-6 border-t border-slate-100 mt-6">
                            <button onClick={() => setModalOpen(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cancelar</button>
                            <button onClick={handleCrudSubmit} className={`flex-1 py-3 font-black text-white rounded-xl shadow-lg transition-all active:scale-95 ${crudAction === 'DISCONTINUED' ? 'bg-red-500 shadow-red-500/30 hover:bg-red-600' : 'bg-teal-600 shadow-teal-500/30 hover:bg-teal-700'}`}>
                                {submitting ? 'Guardando...' : 'Aplicar Sello'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL PARA AÑADIR FÁRMACO                                  */}
            {/* ========================================================= */}
            {addMedModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-8 animate-in zoom-in-95">
                        <h3 className="text-2xl font-black text-slate-900 mb-1">Añadir Fármaco</h3>
                        <p className="text-sm font-medium text-slate-500 mb-6 border-b border-slate-100 pb-4">Asignación directa (HIPAA)</p>

                        <div className="space-y-4">
                            <div className="relative">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Seleccionar Fármaco</label>
                                <input 
                                    type="text" 
                                    value={medSearch} 
                                    onChange={(e) => {
                                        setMedSearch(e.target.value);
                                        setShowDropdown(true);
                                        setAddForm({...addForm, medicationId: ""}); 
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                    placeholder="Buscar por nombre..."
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-teal-500"
                                />
                                {showDropdown && (
                                    <ul className="absolute z-10 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                        {catalog.filter(m => m.name.toLowerCase().includes(medSearch.toLowerCase())).length === 0 && medSearch.trim().length > 1 && (
                                            <div className="p-4 text-center">
                                                <p className="text-slate-500 text-sm mb-3">
                                                    "{medSearch}" no está en el catálogo.
                                                </p>
                                                <button
                                                    onClick={async () => {
                                                        // Crear el medicamento en el catálogo y seleccionarlo automáticamente
                                                        try {
                                                            const res = await fetch('/api/med/catalog', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    name: medSearch.trim().toUpperCase(),
                                                                    dosage: 'Ver indicación médica',
                                                                    category: 'General',
                                                                    hqId: user?.hqId || user?.headquartersId
                                                                })
                                                            });
                                                            const data = await res.json();
                                                            if (data.id || data.medication?.id) {
                                                                const newMed = data.medication || data;
                                                                setCatalog(prev => [...prev, newMed]);
                                                                setAddForm(prev => ({ ...prev, medicationId: newMed.id }));
                                                                setMedSearch(newMed.name);
                                                            } else {
                                                                alert('Error agregando el fármaco al catálogo.');
                                                            }
                                                        } catch {
                                                            alert('Error de conexión.');
                                                        }
                                                    }}
                                                    className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all"
                                                >
                                                    + Agregar "{medSearch}" al catálogo
                                                </button>
                                                <p className="text-slate-500 text-xs mt-2">
                                                    Se creará como nuevo fármaco y quedará disponible para toda la sede.
                                                </p>
                                            </div>
                                        )}
                                        {catalog.filter(c => c.name.toLowerCase().includes(medSearch.toLowerCase())).length > 0 && (
                                            catalog.filter(c => c.name.toLowerCase().includes(medSearch.toLowerCase())).map(c => (
                                                <li 
                                                    key={c.id} 
                                                    onClick={() => {
                                                        setAddForm({...addForm, medicationId: c.id});
                                                        setMedSearch(`${c.name} (${c.dosage})`);
                                                        setShowDropdown(false);
                                                    }}
                                                    className="p-3 hover:bg-teal-50 cursor-pointer border-b border-slate-100 last:border-0"
                                                >
                                                    <p className="font-bold text-slate-800">{c.name}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{c.dosage} - {c.category || 'General'}</p>
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                )}
                            </div>
                            {/* FRECUENCIA — el campo que faltaba. Sin el, "semanal" se
                                escribia dentro del horario y el medicamento dejaba de
                                aparecer en la tableta. Ver src/lib/receta.ts. */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">¿Cada cuándo?</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {FRECUENCIAS.map(f => (
                                        <button
                                            key={f.codigo}
                                            type="button"
                                            onClick={() => setAddForm({ ...addForm, frequency: f.codigo, scheduleDays: f.codigo === 'SEMANAL' ? addForm.scheduleDays : [] })}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${addForm.frequency === f.codigo ? 'bg-teal-600 text-white border-teal-700' : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300'}`}
                                        >
                                            <span className="block text-[13px] font-black leading-tight">{f.etiqueta}</span>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                    {FRECUENCIAS.find(f => f.codigo === addForm.frequency)?.ayuda}
                                </p>
                            </div>

                            {addForm.frequency === 'SEMANAL' && (
                                <div className="animate-in fade-in">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">¿Qué días?</label>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {DIAS.map(d => {
                                            const puesto = addForm.scheduleDays.includes(d.n);
                                            return (
                                                <button
                                                    key={d.n}
                                                    type="button"
                                                    title={d.largo}
                                                    onClick={() => setAddForm({ ...addForm, scheduleDays: puesto ? addForm.scheduleDays.filter(x => x !== d.n) : [...addForm.scheduleDays, d.n].sort() })}
                                                    className={`py-3 rounded-xl border-2 font-black text-sm transition-all ${puesto ? 'bg-teal-600 text-white border-teal-700' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300'}`}
                                                >{d.corto}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {addForm.frequency !== 'PRN' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Horario de Suministro</label>
                                    <input type="text" value={addForm.scheduleTimes} onChange={e => setAddForm({...addForm, scheduleTimes: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500" placeholder="Ej: 08:00 AM, 08:00 PM" />
                                    <p className="text-[11px] text-slate-400 mt-1.5">
                                        Solo horas, separadas por coma. Los días van arriba.
                                    </p>
                                </div>
                            )}

                            {/* PRESCRITO POR — la pestaña del eMAR tiene un bloque rotulado
                                asi desde siempre, leyendo un campo que nadie escribia: 261 de
                                261 medicamentos activos con el prescriptor vacio. */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">
                                    Prescrito por <span className="font-medium text-slate-400">(médico que lo ordenó)</span>
                                </label>
                                <input type="text" value={addForm.prescribedBy} onChange={e => setAddForm({...addForm, prescribedBy: e.target.value})} maxLength={120} className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500" placeholder="Ej: Dra. Rivera — Medicina Interna" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Duración Preparación</label>
                                <select value={addForm.prepDuration} onChange={e => setAddForm({...addForm, prepDuration: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-teal-500">
                                    <option value="1_SEMANA">1 Semana Continua</option>
                                    <option value="2_SEMANAS">2 Semanas</option>
                                    <option value="INDEFINIDO">Uso Indefinido / Permanente</option>
                                </select>
                            </div>
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <label className="block text-sm font-bold text-amber-900 mb-1 flex items-center gap-2"><span></span> Razón (Auditoría Médica)</label>
                                <textarea value={addForm.reason} onChange={e => setAddForm({...addForm, reason: e.target.value})} placeholder="Ej. Según orden médica del Dr. García" className="w-full p-2 bg-white/50 border border-amber-200 focus:border-amber-400 rounded-lg text-sm font-medium text-amber-900 min-h-[40px] outline-none"></textarea>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-6 border-t border-slate-100 mt-6">
                            <button onClick={() => setAddMedModalOpen(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cancelar</button>
                            <button onClick={handleAddMedSubmit} disabled={!addForm.medicationId || submitting} className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 font-black text-white rounded-xl shadow-lg shadow-teal-500/30 transition-all active:scale-95 disabled:opacity-50">
                                {submitting ? 'Añadiendo...' : 'Añadir al Perfil'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
