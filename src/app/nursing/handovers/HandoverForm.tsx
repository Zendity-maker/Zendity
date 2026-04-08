"use client";
import React, { useState, useRef } from 'react';
import { submitNursingHandover } from '@/actions/operational/handover';
import { FlagReason, ShiftType } from '@prisma/client';

export default function HandoverForm({ patients }: { patients: { id: string, name: string }[] }) {
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [flagReason, setFlagReason] = useState<FlagReason>(FlagReason.FALL);
    const [noteText, setNoteText] = useState('');
    const [notes, setNotes] = useState<{ patientId: string, flagReason: FlagReason, nursingNote: string, patientName: string }[]>([]);
    
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Canvas para firma
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.beginPath();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => setIsDrawing(false);
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const addNote = () => {
        if (!selectedPatientId) return setError('Selecciona un residente.');
        if (!noteText.trim()) return setError('La nota de enfermería es obligatoria para los flags clínicos.');
        
        const pt = patients.find(p => p.id === selectedPatientId);
        setNotes([...notes, { patientId: selectedPatientId, flagReason, nursingNote: noteText, patientName: pt?.name || '' }]);
        setSelectedPatientId('');
        setNoteText('');
        setError('');
    };

    const handleSubmit = async () => {
        setError(''); setSuccess('');
        if (notes.length === 0) return setError('Añade al menos una nota clínica para el relevo.');
        
        const canvas = canvasRef.current;
        if (!canvas) return setError('El canvas de firma no cargó.');
        const signatureOutBase64 = canvas.toDataURL('image/png');
        
        setIsSubmitting(true);
        const res = await submitNursingHandover({
            shiftDate: new Date(),
            shiftType: ShiftType.MORNING, // Podríamos hacerlo dinámico, asumo MORNING para el MVP
            signatureOutBase64,
            notes: notes.map(n => ({ patientId: n.patientId, flagReason: n.flagReason, nursingNote: n.nursingNote }))
        });

        setIsSubmitting(false);
        if (res.success) {
            setSuccess('¡Entrega de guardia firmada y enviada a Supervisión exitosamente!');
            setNotes([]);
            clearCanvas();
        } else {
            setError(res.message || res.error || 'Ocurrió un error en el servidor.');
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100 max-w-3xl mx-auto mt-8">
            <h2 className="text-3xl font-black text-gray-800 mb-8 tracking-tight">Nursing Handover (Entrega de Guardia)</h2>
            
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-base font-bold border border-red-100">{error}</div>}
            {success && <div className="bg-green-50 text-green-700 p-4 rounded-xl mb-6 text-base font-bold border border-green-100">{success}</div>}
            
            <div className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border-2 border-slate-100 mb-8 shadow-sm">
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                    <span className="bg-indigo-100 text-indigo-700 rounded-lg w-8 h-8 flex items-center justify-center">1</span> 
                    Añadir Observación Clínica
                </h3>
                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Residente</label>
                    <select className="w-full border-2 border-slate-200 bg-white rounded-2xl shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all p-5 text-lg font-black text-slate-800 outline-none" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                        <option value="">-- Seleccionar Px --</option>
                        {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Bandera Clínica (Flag)</label>
                    <select className="w-full border-2 border-slate-200 bg-white rounded-2xl shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all p-5 text-lg font-black text-slate-800 outline-none" value={flagReason} onChange={e => setFlagReason(e.target.value as FlagReason)}>
                        {Object.values(FlagReason).map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Nota Justificatoria (Obligatoria)</label>
                    <textarea className="w-full border-2 border-slate-200 bg-white rounded-2xl shadow-sm p-5 text-lg font-medium text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none resize-none min-h-[120px]" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Ej: Sufrió caída en el baño, se administró Tylenol..."></textarea>
                </div>
                <button onClick={addNote} className="w-full mt-4 bg-indigo-50 flex-1 hover:bg-indigo-100 text-indigo-700 px-6 py-5 rounded-2xl font-black text-lg transition-all shadow-sm border-2 border-indigo-200 active:scale-95 min-h-[64px] flex items-center justify-center gap-3">
                    <span className="text-3xl leading-none -mt-1">+</span> Adjuntar Nota al Handover
                </button>
            </div>

            {notes.length > 0 && (
                <div className="mb-8">
                    <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2">Notas Registradas</h3>
                    <ul className="space-y-3">
                        {notes.map((n, i) => (
                            <li key={i} className="flex flex-col bg-amber-50 p-4 border border-amber-200 rounded-xl text-base shadow-sm">
                                <span className="font-black text-slate-900 text-lg mb-1">{n.patientName} <span className="text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md text-sm ml-2">{n.flagReason}</span></span>
                                <span className="text-slate-700 font-medium">{n.nursingNote}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="mb-8 p-6 bg-slate-50/50 rounded-2xl border-2 border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2 mb-4">
                    <span className="bg-indigo-100 text-indigo-700 rounded-lg w-8 h-8 flex items-center justify-center">2</span> 
                    Firma Saliente (Obligatorio)
                </h3>
                <div className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white touch-none w-full max-w-lg shadow-inner">
                    <canvas 
                        ref={canvasRef} 
                        width={480} 
                        height={160} 
                        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing}
                        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                        className="cursor-crosshair w-full"
                    />
                </div>
                <button onClick={clearCanvas} className="text-sm font-bold text-slate-500 mt-3 hover:text-slate-800 underline uppercase tracking-widest">Borrar firma</button>
            </div>

            <button 
                onClick={handleSubmit} 
                disabled={isSubmitting || notes.length === 0}
                className={`w-full text-white font-black py-6 px-8 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-4 text-xl ${isSubmitting ? 'bg-indigo-600 opacity-80 cursor-wait shadow-indigo-500/30' : (success ? 'bg-emerald-600 shadow-emerald-500/30' : 'bg-slate-900 hover:bg-slate-800 active:scale-95 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none min-h-[80px]')}`}
            >
                {isSubmitting ? 'Procesando Cierre Clínico...' : (success ? '✅ Guardia Intercambiada' : 'Firmar y Entregar Guardia')}
            </button>
        </div>
    );
}
