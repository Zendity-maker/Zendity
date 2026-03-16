"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface Employee {
    id: string;
    name: string;
    role: string;
    preferredShift?: string;
    offDays?: string[];
}

interface Shift {
    id: string;
    employeeId: string;
    startTime: string;
    endTime: string;
    zoneColor?: string;
    employee: Employee;
}

// Bloques fijos recomendados según el flujo de Handovers (Phase 21)
const SHIFT_BLOCKS = [
    { id: "MORNING", label: "Mañana (6 AM - 2 PM)", startHour: 6, startMin: 0, endHour: 14, endMin: 0, color: "bg-amber-100 text-amber-800 border-amber-200" },
    { id: "EVENING", label: "Tarde (2 PM - 10 PM)", startHour: 14, startMin: 0, endHour: 22, endMin: 0, color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    { id: "NIGHT", label: "Noche (10 PM - 6 AM)", startHour: 22, startMin: 0, endHour: 6, endMin: 0, color: "bg-slate-800 text-white border-slate-700" },
    { id: "OFFICE", label: "Administrativo (9 AM - 6 PM)", startHour: 9, startMin: 0, endHour: 18, endMin: 0, color: "bg-teal-100 text-teal-800 border-teal-200" }
];

const ZONE_COLORS = [
    { id: "RED", bgClass: "bg-rose-500", borderClass: "border-rose-600", label: "Rojo" },
    { id: "BLUE", bgClass: "bg-blue-500", borderClass: "border-blue-600", label: "Azul" },
    { id: "GREEN", bgClass: "bg-emerald-500", borderClass: "border-emerald-600", label: "Verde" },
    { id: "YELLOW", bgClass: "bg-amber-500", borderClass: "border-amber-600", label: "Amarillo" },
    { id: "PURPLE", bgClass: "bg-purple-500", borderClass: "border-purple-600", label: "Morado" }
];

const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function ShiftSchedulerPage() {
    const { user } = useAuth();
    const activeHqId = user?.headquartersId || user?.hqId;

    const [shifts, setShifts] = useState<Shift[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getStartOfWeek(new Date()));

    // Form states
    const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [selectedBlock, setSelectedBlock] = useState(SHIFT_BLOCKS[0].id);
    const [selectedZone, setSelectedZone] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Grid Interactive States (Click & Assign)
    const [activeCell, setActiveCell] = useState<{ employeeId: string, date: Date, blockId?: string, zoneId?: string } | null>(null);
    const [isSavingGrid, setIsSavingGrid] = useState(false);

    // AI Generation Data & State
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiRuleAM, setAiRuleAM] = useState(3);
    const [aiRulePM, setAiRulePM] = useState(3);
    const [aiRuleNight, setAiRuleNight] = useState(2);
    const [configEmployee, setConfigEmployee] = useState<Employee | null>(null);
    const [tempPrefShift, setTempPrefShift] = useState("");
    const [tempOffDays, setTempOffDays] = useState<string[]>([]);
    
    // SendGrid Publisher State
    const [isPublishing, setIsPublishing] = useState(false);

    useEffect(() => {
        if (activeHqId) {
            fetchData();
        }
    }, [activeHqId, currentWeekStart]);

    // Helpers de Fecha
    function getStartOfWeek(date: Date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0); // Fija a medianoche para evitar saltos de día por Timezone UTC
        const day = d.getDay(),
            diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes
        return new Date(d.setDate(diff));
    }

    function addDays(date: Date, days: number) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            const endDate = addDays(currentWeekStart, 7);
            const endDateLocal = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000).toISOString();
            const startDateLocal = new Date(currentWeekStart.getTime() - currentWeekStart.getTimezoneOffset() * 60000).toISOString();
            const shiftsRes = await fetch(`/api/medical/shifts?startDate=${startDateLocal}&endDate=${endDateLocal}`);
            if (shiftsRes.ok) {
                const data = await shiftsRes.json();
                setShifts(data.shifts || []);
            }

            const empRes = await fetch(`/api/corporate/users?headquartersId=${activeHqId}&role=NURSE,CAREGIVER`);
            if (empRes.ok) {
                setEmployees(await empRes.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAIGenerate = async () => {
        if (!confirm(`⚠️ ¿Estás seguro? Esto usará Inteligencia Artificial para sobreescribir los turnos de la semana mostrada.\n\nReglas a aplicar:\n- MORNING (AM): ${aiRuleAM}\n- EVENING (PM): ${aiRulePM}\n- NIGHT (Noche): ${aiRuleNight}\n\nLos turnos actuales se borrarán y se respetarán los días libres fijos del personal.`)) return;
        
        setIsGeneratingAI(true);
        try {
            const startDateLocal = new Date(currentWeekStart.getTime() - currentWeekStart.getTimezoneOffset() * 60000).toISOString().split('T')[0];
            const res = await fetch("/api/medical/shifts/ai-generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    weekStartDate: startDateLocal,
                    employees: employees,
                    rules: {
                        countAM: aiRuleAM,
                        countPM: aiRulePM,
                        countNight: aiRuleNight
                    }
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert(`✨ ¡Zendi AI generó y organizó ${data.count} turnos equitativamente para esta semana! Revisa el tablero.`);
                fetchData();
            } else {
                alert("Error generando horario: " + data.error);
            }
        } catch (error) {
            console.error(error);
            alert("Ocurrió un error consultando a Zendi AI.");
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handlePublishPDF = async () => {
        if (!confirm("📩 ¿Deseas aprobar este roster y enviarlo en PDF por correo a todos los empleados activos de la sede?")) return;
        setIsPublishing(true);

        try {
            const tableElement = document.getElementById("roster-table");
            if (!tableElement) throw new Error("No se encontró la tabla de turnos para convertir.");

            // 1. Snapshot HTML
            const canvas = await html2canvas(tableElement, { scale: 2 });
            const imgData = canvas.toDataURL("image/jpeg", 0.95);

            // 2. Build PDF (A4 Landscape)
            const pdf = new jsPDF('landscape', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 10, pdfWidth, pdfHeight);
            
            // 3. Obtain Base64
            const pdfBase64 = pdf.output('datauristring');

            // 4. Send to Webhook
            const weekLabel = `${currentWeekStart.toLocaleDateString()} al ${addDays(currentWeekStart, 6).toLocaleDateString()}`;
            
            const res = await fetch("/api/medical/shifts/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pdfBase64, weekLabel })
            });

            const data = await res.json();
            if (res.ok) {
                alert(`✅ Roster aprobado. PDF generado y enviado a ${data.count} empleados activos.`);
            } else {
                alert("Error técnico en envío: " + data.error);
            }
        } catch (error) {
            console.error(error);
            alert("Excepción local: revisa la consola.");
        } finally {
            setIsPublishing(false);
        }
    };

    const handleSaveUserRules = async () => {
        if (!configEmployee) return;
        setIsSavingGrid(true);
        try {
            const res = await fetch(`/api/corporate/users/${configEmployee.id}/preferences`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    preferredShift: tempPrefShift || null,
                    offDays: tempOffDays
                })
            });
            if (!res.ok) throw new Error("Fallo");
            // Refresh
            fetchData();
            setConfigEmployee(null);
        } catch (error) {
            alert("Error guardando preferencias del cuidador.");
        } finally {
            setIsSavingGrid(false);
        }
    };

    const handleAssignShift = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeId || !selectedDate || !selectedBlock) return;
        setIsSaving(true);

        const blockDef = SHIFT_BLOCKS.find(b => b.id === selectedBlock);
        if (!blockDef) return;

        // Construir fechas reales
        const baseDate = new Date(selectedDate);
        const startTime = new Date(baseDate);
        startTime.setHours(blockDef.startHour, blockDef.startMin, 0, 0);

        const endTime = new Date(baseDate);
        // Si es el turno de noche, el Fin es al día siguiente
        if (blockDef.id === "NIGHT") {
            endTime.setDate(endTime.getDate() + 1);
        }
        endTime.setHours(blockDef.endHour, blockDef.endMin, 0, 0);

        try {
            const res = await fetch("/api/medical/shifts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: selectedEmployeeId,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    zoneColor: selectedZone || null
                })
            });

            const data = await res.json();
            if (data.success) {
                fetchData();
                alert("Turno asignado exitosamente.");
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleGridAssign = async (blockId: string, zoneId: string | null) => {
        if (!activeCell) return;
        setIsSavingGrid(true);

        const blockDef = SHIFT_BLOCKS.find(b => b.id === blockId);
        if (!blockDef) return;

        const baseDate = new Date(activeCell.date);
        const startTime = new Date(baseDate);
        startTime.setHours(blockDef.startHour, blockDef.startMin, 0, 0);

        const endTime = new Date(baseDate);
        if (blockDef.id === "NIGHT") {
            endTime.setDate(endTime.getDate() + 1);
        }
        endTime.setHours(blockDef.endHour, blockDef.endMin, 0, 0);

        try {
            const res = await fetch("/api/medical/shifts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: activeCell.employeeId,
                    startTime: new Date(startTime.getTime() - startTime.getTimezoneOffset() * 60000).toISOString(),
                    endTime: new Date(endTime.getTime() - endTime.getTimezoneOffset() * 60000).toISOString(),
                    zoneColor: zoneId || null
                })
            });

            const data = await res.json();
            if (data.success) {
                fetchData();
                setActiveCell(null); // Close popup
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingGrid(false);
        }
    };

    const handleDeleteShift = async (shiftId: string) => {
        if (!confirm("¿Deseas remover este turno asignado?")) return;
        try {
            const res = await fetch(`/api/medical/shifts?id=${shiftId}`, { method: "DELETE" });
            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error(error);
        }
    };

    // UI Helpers para agrupar los shifts en el tablero
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));

    const getShiftClass = (startTimeStr: string) => {
        const hour = new Date(startTimeStr).getHours();
        if (hour === 9) return SHIFT_BLOCKS[3].color; // Administrativo
        if (hour >= 5 && hour < 12) return SHIFT_BLOCKS[0].color; // Mañana
        if (hour >= 12 && hour < 20) return SHIFT_BLOCKS[1].color; // Tarde
        return SHIFT_BLOCKS[2].color; // Noche
    };

    const getShiftLabel = (startTimeStr: string) => {
        const hour = new Date(startTimeStr).getHours();
        if (hour === 9) return "Oficina";
        if (hour >= 5 && hour < 12) return "Mañana";
        if (hour >= 12 && hour < 20) return "Tarde";
        return "Noche";
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <span>🗓️</span> Gestor de Turnos (Scheduler)
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Asigna de manera rápida los turnos pre-definidos que interactúan con el sistema de Handovers Clínicos.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
                    <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))} className="px-3 py-1.5 hover:bg-white rounded-lg text-slate-600 font-bold transition-colors">Semana Ant.</button>
                    <span className="text-sm font-bold text-slate-700 px-4 min-w-[200px] text-center">
                        {currentWeekStart.toLocaleDateString()} - {addDays(currentWeekStart, 6).toLocaleDateString()}
                    </span>
                    <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))} className="px-3 py-1.5 hover:bg-white rounded-lg text-slate-600 font-bold transition-colors">Semana Sig.</button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="font-bold border-r pr-4 text-slate-700">⚙️ Motor Ocupacional AI</span>
                    <label className="text-sm font-medium flex items-center gap-2">AM (6a-2p): <input type="number" value={aiRuleAM} onChange={e => setAiRuleAM(Number(e.target.value))} className="w-16 border rounded px-2 py-1" /></label>
                    <label className="text-sm font-medium flex items-center gap-2">PM (2p-10p): <input type="number" value={aiRulePM} onChange={e => setAiRulePM(Number(e.target.value))} className="w-16 border rounded px-2 py-1" /></label>
                    <label className="text-sm font-medium flex items-center gap-2">Noche (10p-6a): <input type="number" value={aiRuleNight} onChange={e => setAiRuleNight(Number(e.target.value))} className="w-16 border rounded px-2 py-1" /></label>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleAIGenerate}
                        disabled={isGeneratingAI || employees.length === 0}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all"
                    >
                        {isGeneratingAI ? <span className="animate-pulse">✨ Generando...</span> : <>✨ Automatizar con IA</>}
                    </button>
                    <button
                        onClick={handlePublishPDF}
                        disabled={isPublishing || shifts.length === 0}
                        className="bg-indigo-900 hover:bg-slate-900 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all"
                    >
                        {isPublishing ? <span className="animate-pulse">📩 Enviando...</span> : <>📩 Aprobar y Enviar (PDF)</>}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Columna Izquierda: Asignadores */}
                <div className="lg:col-span-1 flex flex-col gap-6">

                    {/* El panel de Zendi fue removido a favor de la cuadrícula interactiva */}

                    {/* Panel de Asignación Manual */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2 uppercase tracking-widest">
                            <span>⚡</span> Asignación Manual
                        </h3>
                        <form onSubmit={handleAssignShift} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Personal</label>
                                <select required value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-500">
                                    <option value="">-- Seleccionar --</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Día</label>
                                <input type="date" required value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Bloque</label>
                                <div className="space-y-2">
                                    {SHIFT_BLOCKS.map(block => (
                                        <label key={block.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedBlock === block.id ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                            <input type="radio" name="shiftBlock" value={block.id} checked={selectedBlock === block.id} onChange={e => setSelectedBlock(e.target.value)} className="text-teal-600 focus:ring-teal-500" />
                                            <span className="text-xs font-bold text-slate-700">{block.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Color de Zona (Opc.)</label>
                                <div className="flex flex-wrap gap-2">
                                    {ZONE_COLORS.map(color => (
                                        <button
                                            key={color.id}
                                            type="button"
                                            onClick={() => setSelectedZone(selectedZone === color.id ? "" : color.id)}
                                            className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${color.bgClass} ${color.borderClass} ${selectedZone === color.id ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                                            title={`Zona ${color.label}`}
                                        >
                                            {selectedZone === color.id && <span className="text-white text-[10px] font-black">✓</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" disabled={isSaving || loading} className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all mt-4 text-sm disabled:opacity-50">
                                {isSaving ? "Guardando..." : "Asignar"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Tablero Semanal Visual (Grid) */}
                <div id="roster-table" className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col pt-2 pb-2">
                    <div className="px-4 py-2 border-b border-slate-100 hidden print:block text-slate-400 font-bold mb-4">
                        Zendity Institutional Shift Planner - Generado el {new Date().toLocaleDateString()}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr>
                                    <th className="p-4 bg-slate-50 border-b border-slate-200 font-black text-slate-600 uppercase text-xs tracking-wider w-40 sticky left-0 z-10">Staff</th>
                                    {weekDays.map((day, idx) => (
                                        <th key={idx} className="p-4 bg-slate-50 border-b border-l border-slate-200 font-bold text-slate-500 text-xs text-center min-w-[120px]">
                                            <div className="uppercase tracking-wider text-[10px] mb-1">{DAYS_OF_WEEK[day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
                                            <div className="text-slate-800 text-sm">{day.getDate()}/{day.getMonth() + 1}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {employees.length === 0 && !loading && (
                                    <tr><td colSpan={8} className="p-8 text-center text-slate-400">No hay personal clínico disponible.</td></tr>
                                )}
                                {loading && (
                                    <tr><td colSpan={8} className="p-8 text-center animate-pulse text-teal-600 font-bold">Cargando Tablero...</td></tr>
                                )}
                                {!loading && employees.map(emp => {
                                    // Filtrar los turnos de este empleado en la semana actual
                                    const empShifts = shifts.filter(s => s.employeeId === emp.id);

                                    return (
                                        <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 bg-white/90 sticky left-0 z-10 border-r border-slate-100 backdrop-blur-sm">
                                                <div className="font-black text-sm text-slate-900 uppercase">{emp.name || 'Sin Nombre'}</div>
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{emp.role}</div>
                                            </td>

                                            {weekDays.map((date, idx) => {
                                                // Buscar turnos que CARGAN (start) en esta fecha específica.
                                                // La forma más segura de evadir problemas de Timzone UTC vs Local al re-renderizar
                                                // es comparar el string YYYY-MM-DD extraido de la fecha local.
                                                const dayShifts = empShifts.filter(s => {
                                                    const shiftDateStr = s.startTime.split('T')[0];

                                                    // Convertimos la fecha de la columna (date) al formato YYYY-MM-DD local
                                                    const localColumnDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];

                                                    return shiftDateStr === localColumnDate;
                                                });

                                                const isCellActive = activeCell?.employeeId === emp.id && activeCell?.date.getTime() === date.getTime();

                                                return (
                                                    <td key={idx} className="p-2 border-l border-slate-100 align-top relative group">
                                                        <div className="flex flex-col gap-2 min-h-[60px]">
                                                            {dayShifts.map(shift => {
                                                                const zoneColorInfo = shift.zoneColor ? ZONE_COLORS.find(c => c.id === shift.zoneColor) : null;
                                                                return (
                                                                    <div key={shift.id} className={`p-2 rounded-lg border text-xs font-bold relative flex flex-col justify-center items-center group/shift ${getShiftClass(shift.startTime)}`}>
                                                                        {zoneColorInfo && (
                                                                            <div className="absolute -top-1.5 -left-1.5 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-full shadow-sm border border-slate-200">
                                                                                <div className={`w-2.5 h-2.5 rounded-full ${zoneColorInfo.bgClass}`}></div>
                                                                            </div>
                                                                        )}
                                                                        <div className="text-center">{getShiftLabel(shift.startTime)}</div>
                                                                        <div className="text-[9px] text-center opacity-80 mt-0.5 font-medium">
                                                                            {new Date(shift.startTime).getHours()}:00 - {new Date(shift.endTime).getHours()}:00
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }}
                                                                            className="absolute -top-2 -right-2 bg-rose-500 text-white w-5 h-5 rounded-full opacity-0 group-hover/shift:opacity-100 transition-opacity shadow-sm flex items-center justify-center font-black z-20"
                                                                            title="Remover Turno"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}

                                                            {/* Empty State / Add Button Trigger */}
                                                            {dayShifts.length === 0 && !isCellActive && (
                                                                <button
                                                                    onClick={() => setActiveCell({ employeeId: emp.id, date })}
                                                                    className="w-full h-full min-h-[50px] flex items-center justify-center text-slate-200 hover:text-teal-500 hover:bg-teal-50 border-2 border-dashed border-transparent hover:border-teal-200 rounded-lg text-xs font-bold transition-all"
                                                                >
                                                                    + Asignar
                                                                </button>
                                                            )}

                                                            {/* Popup Menu (Click-to-Assign) */}
                                                            {isCellActive && (
                                                                <div className="absolute top-0 left-0 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-3 transform translate-x-4 translate-y-4">
                                                                    <div className="flex justify-between items-center mb-3">
                                                                        <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Nuevo Turno</span>
                                                                        <button onClick={() => setActiveCell(null)} className="text-slate-400 hover:text-rose-500 transition-colors">✕</button>
                                                                    </div>

                                                                    {isSavingGrid ? (
                                                                        <div className="py-6 text-center text-teal-600 text-xs font-bold animate-pulse">Guardando...</div>
                                                                    ) : (
                                                                        <div className="space-y-4">
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                {SHIFT_BLOCKS.map(block => {
                                                                                    const isSelected = activeCell.blockId === block.id;
                                                                                    const baseColor = block.color.replace('border-', 'border-opacity-50 border-');
                                                                                    return (
                                                                                        <button
                                                                                            key={block.id}
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setActiveCell(prev => prev ? { ...prev, blockId: block.id } : null);
                                                                                            }}
                                                                                            className={`text-[10px] font-bold py-2 px-1 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all text-center leading-tight
                                                                                            ${isSelected ? 'ring-2 ring-slate-800 shadow-md scale-[1.02] ' + baseColor.replace('bg-', 'bg-opacity-80 bg-') : baseColor} hover:brightness-95`}
                                                                                        >
                                                                                            {block.label.split('(')[0].trim()}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            <div className="pt-2 border-t border-slate-100">
                                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Color de Zona:</span>
                                                                                <div className="flex flex-wrap gap-2 justify-between">
                                                                                    {ZONE_COLORS.map(color => {
                                                                                        const isSelected = activeCell.zoneId === color.id;
                                                                                        return (
                                                                                            <button
                                                                                                key={color.id}
                                                                                                type="button"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setActiveCell(prev => prev ? { ...prev, zoneId: color.id } : null);
                                                                                                }}
                                                                                                className={`w-7 h-7 rounded-full border-2 ${color.bgClass} ${color.borderClass} transition-all ${isSelected ? 'ring-4 ring-offset-1 ring-slate-800 scale-110' : 'hover:scale-110'}`}
                                                                                                title={`Zona ${color.label}`}
                                                                                            />
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                disabled={!activeCell.blockId || !activeCell.zoneId}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (activeCell.blockId && activeCell.zoneId) {
                                                                                        handleGridAssign(activeCell.blockId, activeCell.zoneId);
                                                                                    }
                                                                                }}
                                                                                className={`w-full py-2.5 mt-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 
                                                                                ${activeCell.blockId && activeCell.zoneId ? 'bg-slate-800 text-white shadow-lg hover:bg-slate-700 hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                                                            >
                                                                                Confirmar y Asignar
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal AI Configurations */}
            {configEmployee && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
                            Reglas IA: {configEmployee.name}
                        </h3>
                        <p className="text-sm text-slate-500 mb-6">Restricciones fijas para la automatización de horarios. Si se dejan en blanco, la IA rotará al usuario según su propio cálculo equitativo para cumplir los KPIs del Dashboard.</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Turno Fijo Requerido</label>
                                <select 
                                    value={tempPrefShift} 
                                    onChange={(e) => setTempPrefShift(e.target.value)}
                                    className="w-full border-slate-200 rounded-xl p-3 bg-slate-50"
                                >
                                    <option value="">Rotación Flexible (Dejar que Zendi elija)</option>
                                    <option value="MORNING">Siempre AM (Mañana)</option>
                                    <option value="EVENING">Siempre PM (Tarde)</option>
                                    <option value="NIGHT">Siempre NIGHT (Guardias Nocturnas)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Días Libres Fijos (Off Days)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                        <label key={day} className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={tempOffDays.includes(day)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setTempOffDays([...tempOffDays, day]);
                                                    else setTempOffDays(tempOffDays.filter(d => d !== day));
                                                }}
                                                className="rounded text-indigo-600"
                                            />
                                            <span className="text-sm font-medium text-slate-700">{day}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button 
                                onClick={() => setConfigEmployee(null)}
                                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSaveUserRules}
                                disabled={isSavingGrid}
                                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors"
                            >
                                Guardar Reglas
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
