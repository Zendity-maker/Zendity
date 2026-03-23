"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import TaskAssignmentButton from "@/components/TaskAssignmentButton";

interface Medication { id: string; name: string; dosage: string; }
interface Patient { id: string; name: string; roomNumber: string; colorGroup: string; medications: any[]; }

export default function ZendityMedPage() {
    const { user } = useAuth();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('MAR'); // MAR, OCR, CART

    // OCR Simulator
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrResult, setOcrResult] = useState<any>(null);

    // CRUD State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedMed, setSelectedMed] = useState<any>(null);
    const [crudReason, setCrudReason] = useState("");
    const [crudAction, setCrudAction] = useState<"MODIFIED" | "DISCONTINUED" | null>(null);
    const [newSchedule, setNewSchedule] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Add Med State
    const [addMedModalOpen, setAddMedModalOpen] = useState(false);
    const [catalog, setCatalog] = useState<any[]>([]);
    const [addForm, setAddForm] = useState({ patientId: "", medicationId: "", scheduleTimes: "08:00 AM", prepDuration: "1_SEMANA", reason: "Asignación Inicial de Fármaco" });
    const [medSearch, setMedSearch] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            const hq = user?.hqId || user?.headquartersId || "hq-demo-1";
            const res = await fetch(`/api/med?hqId=${hq}`);
            const data = await res.json();
            if (data.success) {
                // The API returns patientMeds which is an array of medications.
                // We need to group them by patient.
                const grouped = data.data.reduce((acc: any, curr: any) => {
                    if (!acc[curr.patient.id]) {
                        acc[curr.patient.id] = { ...curr.patient, medications: [] };
                    }
                    if (curr.alertsEnabled !== false) { // Don't show discontinued meds
                        acc[curr.patient.id].medications.push(curr);
                    }
                    return acc;
                }, {});
                setPatients(Object.values(grouped));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOcrUpload = async (e: any) => {
        // Simulador interactivo de File Upload -> OCR
        const file = e.target.files[0];
        if (!file) return;

        setOcrLoading(true);
        setOcrResult(null);

        try {
            // LLamamos a la API Simluadora de Visión
            const res = await fetch("/api/med/ocr", { method: "POST", body: new FormData() });
            const data = await res.json();
            if (data.success) {
                setOcrResult(data.parsedMedication);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setOcrLoading(false);
        }
    };

    const handleCrudSubmit = async () => {
        if (!crudReason) { alert("Obligatorio justificar el cambio (Auditoría HIPAA)."); return; }
        setSubmitting(true);
        try {
            const res = await fetch("/api/med/crud", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: crudAction,
                    patientMedicationId: selectedMed.id,
                    scheduleTime: crudAction === 'MODIFIED' ? newSchedule : selectedMed.scheduleTime,
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
        setNewSchedule(med.scheduleTime);
        setModalOpen(true);
    };

    const handleAddMedSubmit = async () => {
        if (!addForm.medicationId || !addForm.reason) return alert("Faltan datos obligatorios.");
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
                    authorId: user?.id,
                    reason: addForm.reason
                })
            });
            const data = await res.json();
            if (data.success) {
                setAddMedModalOpen(false);
                setAddForm({ ...addForm, medicationId: "", scheduleTimes: "08:00 AM", reason: "Asignación Inicial de Fármaco" });
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

    const submitCartSign = async (color: string) => {
        setSubmitting(true);
        try {
            const hq = user?.hqId || user?.headquartersId || "hq-demo-1";
            const res = await fetch("/api/med/cart", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    colorGroup: color,
                    authorId: user?.id,
                    hqId: hq
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(` ` + data.message);
            } else {
                alert(` ` + data.error);
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

    if (loading) return <div className="p-20 text-center font-bold text-slate-400 animate-pulse text-xl">Cargando Zendity Med (eMAR)...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="flex justify-between items-center border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
                         Zendity Med <span className="text-base text-teal-600 font-bold bg-teal-50 px-3 py-1 rounded-full uppercase tracking-widest border border-teal-100">Inteligencia Clínica</span>
                    </h1>
                    <p className="text-slate-500 mt-2 max-w-2xl font-medium">Gestión del Historial de Vida de Fármacos, Cumplimiento de Auditoría HIPAA y Panel de Preparación de Retén para Cuidadores por Grupo de Color.</p>
                </div>

                {/* TABS PESTAÑAS */}
                <div className="flex bg-slate-200 p-1.5 rounded-2xl shadow-inner gap-1">
                    <button onClick={() => setActiveTab('MAR')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'MAR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>e-MAR Central</button>
                    <button onClick={() => setActiveTab('OCR')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'OCR' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                         Escáner OCR
                    </button>
                    <button onClick={() => setActiveTab('CART')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'CART' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Validar Carrito (Turnos)</button>
                    <a href="/med/briefing" className="px-6 py-2.5 rounded-xl font-black text-sm text-indigo-700 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 shadow-sm transition-all flex items-center gap-2 ml-4">
                        <span className="text-xl"></span> Prep. Visita Médica
                    </a>
                    <TaskAssignmentButton user={user} buttonStyle="px-6 py-2.5 rounded-xl font-black text-sm text-white bg-teal-600 hover:bg-teal-700 shadow-sm transition-all flex items-center gap-2 border border-teal-500 ml-2" />
                </div>
            </div>

            {/* ========================================================= */}
            {/* PESTAÑA 1: e-MAR CRÓNICO (HIPAA AUDIT)                     */}
            {/* ========================================================= */}
            {activeTab === 'MAR' && (
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
                                    <p className="text-sm font-medium text-slate-400 text-center py-4">Sin PAI Farmacológico.</p>
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
                                                <button onClick={() => openCruModal(m, 'MODIFIED')} className="text-xs font-bold bg-white text-slate-900 px-4 py-1.5 rounded-lg hover:scale-105 active:scale-95 transition-all">Editar Dosis</button>
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
                                    className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-400 font-bold rounded-xl text-xs hover:border-teal-400 hover:text-teal-600 transition-colors uppercase tracking-widest mt-2"
                                >
                                    + Añadir Fármaco
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ========================================================= */}
            {/* PESTAÑA 2: OCR SIMULADOR (Inteligencia Clínica)           */}
            {/* ========================================================= */}
            {activeTab === 'OCR' && (
                <div className="max-w-3xl mx-auto">
                    <div className="bg-indigo-900 rounded-2xl p-1 shadow-2xl overflow-hidden relative">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>

                        <div className="bg-white m-1 rounded-2xl p-10 relative z-10">

                            <div className="text-center mb-8">
                                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border-4 border-indigo-100 shadow-inner">
                                    
                                </div>
                                <h2 className="text-3xl font-black text-slate-800">Cero Papel Médico</h2>
                                <p className="text-slate-500 font-medium mt-2">Sube una foto de la receta médica. Zendity AI leerá la posología y generará las instrucciones operativas estándar para tu sede.</p>
                            </div>

                            <div className="border-4 border-dashed border-slate-200 rounded-xl p-12 text-center bg-slate-50 hover:bg-slate-100 hover:border-indigo-300 transition-colors cursor-pointer relative group">
                                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" onChange={handleOcrUpload} accept="image/*" />
                                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform"></div>
                                <p className="font-bold text-slate-700 text-lg">Toca para Tomar Foto a la Receta</p>
                                <p className="text-sm font-medium text-slate-400 mt-1">Soporta prescripciones a mano alzada o impresas.</p>
                            </div>

                            {ocrLoading && (
                                <div className="mt-8 p-6 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-4 animate-pulse">
                                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                    <div>
                                        <p className="font-black text-indigo-900 text-lg">Leyendo caligrafía médica...</p>
                                        <p className="text-sm font-medium text-indigo-700/70">Zendity AI procesando NLP de posología.</p>
                                    </div>
                                </div>
                            )}

                            {ocrResult && (
                                <div className="mt-8 bg-slate-900 text-white rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95">
                                    <div className="p-4 bg-teal-500/20 border-b border-white/10 flex items-center gap-3">
                                        <span className="text-xl"></span>
                                        <h3 className="font-bold text-teal-400 tracking-widest uppercase text-sm">Extracción NLP Completada</h3>
                                    </div>
                                    <div className="p-6 space-y-6">
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Texto Crudo Extraído (Receta Físca)</p>
                                            <div className="p-3 bg-white/5 border border-white/10 rounded-xl font-mono text-sm text-slate-300">
                                                "{ocrResult.rawText}"
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Fármaco (DB Link)</p>
                                                <p className="font-black text-xl">{ocrResult.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Dosis (Potencia)</p>
                                                <p className="font-black text-xl">{ocrResult.dosage}</p>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-white/10">
                                            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-2"> Instrucción Traducida para Cuidadores (Piso)</p>
                                            <p className="text-lg font-medium leading-relaxed bg-amber-500/10 p-4 border border-amber-500/20 rounded-xl text-amber-100">
                                                {ocrResult.instructions}
                                            </p>
                                        </div>

                                        <button className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-white font-black rounded-xl text-lg shadow-lg shadow-teal-500/20 active:scale-95 transition-all">
                                            Anexar este Récord al e-MAR
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* PESTAÑA 3: CART VALIDATOR (Retén de Turnos)                 */}
            {/* ========================================================= */}
            {activeTab === 'CART' && (
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                    <div className="mb-8">
                        <h2 className="text-2xl font-black text-slate-900">Validación de Carrito de Medicamentos</h2>
                        <p className="text-slate-500 font-medium">Firme electrónicamente los "Platos de Dosis" preparados divididos por Grupo de Color (Balance de Carga) antes de entregar la responsabilidad de los carritos rodantes al personal del piso de Cuidadores del turno entrante.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        {['RED', 'YELLOW', 'GREEN', 'BLUE'].map(color => {
                            const inZone = patients.filter(p => p.colorGroup === color);
                            const medCount = inZone.reduce((acc, p) => acc + p.medications.length, 0);

                            return (
                                <div key={color} className={`rounded-3xl border-2 p-5 flex flex-col justify-between ${colorMapping[color]}`}>
                                    <div>
                                        <h3 className="font-black text-xl mb-1">Coche {color}</h3>
                                        <p className="text-sm font-bold opacity-80 mb-6">{inZone.length} Residentes  {medCount} Dosis Previstas</p>

                                        <div className="space-y-2 mb-6">
                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                <input type="checkbox" className="w-5 h-5 rounded border-2 bg-white/50 text-current focus:ring-0 cursor-pointer" />
                                                <label>Dosis Mañana Preparada</label>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                <input type="checkbox" className="w-5 h-5 rounded border-2 bg-white/50 text-current focus:ring-0 cursor-pointer" />
                                                <label>Insumos Diabéticos Listos</label>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => submitCartSign(color)}
                                        disabled={submitting}
                                        className="w-full py-3 bg-white/80 border hover:bg-white border-current/20 font-black rounded-xl shadow-sm text-sm transition-all active:scale-95 backdrop-blur-sm"
                                    >
                                        Firmar (Doble Chequeo)
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL AUDITORIA CRUD HIPAA                                  */}
            {/* ========================================================= */}
            {modalOpen && selectedMed && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-8 animate-in zoom-in-95">
                        <h3 className="text-2xl font-black text-slate-900 mb-1">
                            {crudAction === 'MODIFIED' ? 'Modificar Horario' : 'Descontinuar Récord'}
                        </h3>
                        <p className="text-sm font-medium text-slate-500 mb-6 border-b border-slate-100 pb-4">Auditoría Estricta: Fármaco <strong className="text-slate-800">{selectedMed.medication.name}</strong></p>

                        <div className="space-y-4">
                            {crudAction === 'MODIFIED' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nuevo Horario de Suministro</label>
                                    <input type="text" value={newSchedule} onChange={e => setNewSchedule(e.target.value)} className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" />
                                </div>
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
                                        {catalog.filter(c => c.name.toLowerCase().includes(medSearch.toLowerCase())).length === 0 ? (
                                            <li className="p-3 text-slate-500 font-medium text-sm">No se encontraron fármacos.</li>
                                        ) : (
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
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Horario de Suministro</label>
                                <input type="text" value={addForm.scheduleTimes} onChange={e => setAddForm({...addForm, scheduleTimes: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500" placeholder="Ej: 08:00 AM, 08:00 PM, PRN" />
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
