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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-2xl mx-auto mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 tracking-tight">Nursing Handover (Entrega de Guardia)</h2>
            
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm font-medium border border-red-100">{error}</div>}
            {success && <div className="bg-green-50 text-green-700 p-3 rounded-md mb-4 text-sm font-medium border border-green-100">{success}</div>}
            
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                <h3 className="font-semibold text-gray-700">1. Añadir Observación Clínica</h3>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Residente</label>
                    <select className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 p-2 border" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                        <option value="">-- Seleccionar Px --</option>
                        {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Bandera Clínica (Flag)</label>
                    <select className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 p-2 border" value={flagReason} onChange={e => setFlagReason(e.target.value as FlagReason)}>
                        {Object.values(FlagReason).map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Nota Justificatoria (Obligatoria)</label>
                    <textarea className="w-full border-gray-300 rounded-md shadow-sm p-2 border" rows={3} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Ej: Sufrió caída en el baño, se administró Tylenol..."></textarea>
                </div>
                <button onClick={addNote} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-md font-medium hover:bg-blue-100 transition shadow-sm border border-blue-200">
                    + Adjuntar Nota al Handover
                </button>
            </div>

            {notes.length > 0 && (
                <div className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-2">Notas Registradas</h3>
                    <ul className="space-y-2">
                        {notes.map((n, i) => (
                            <li key={i} className="flex flex-col bg-yellow-50 p-3 border border-yellow-100 rounded-md text-sm">
                                <span className="font-bold text-gray-800">{n.patientName} <span className="text-red-600">[{n.flagReason}]</span></span>
                                <span className="text-gray-600 mt-1">{n.nursingNote}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">2. Firma Saliente (Obligatorio)</h3>
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50 touch-none w-full max-w-sm">
                    <canvas 
                        ref={canvasRef} 
                        width={380} 
                        height={120} 
                        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing}
                        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                        className="cursor-crosshair w-full"
                    />
                </div>
                <button onClick={clearCanvas} className="text-xs text-gray-500 mt-2 hover:text-gray-800 underline">Borrar firma</button>
            </div>

            <button 
                onClick={handleSubmit} 
                disabled={isSubmitting || notes.length === 0}
                className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition shadow-md"
            >
                {isSubmitting ? 'Procesando Cierre Clínico...' : 'Firmar y Entregar Guardia'}
            </button>
        </div>
    );
}
