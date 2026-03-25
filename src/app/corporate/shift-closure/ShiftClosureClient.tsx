"use client";
import React, { useState, useRef } from 'react';
import { createShiftClosure } from '@/actions/operational/shift';
import { ShiftType } from '@prisma/client';

export default function ShiftClosureClient({
    blockingTicketsCount,
    handoverExists
}: {
    blockingTicketsCount: number;
    handoverExists: boolean;
}) {
    const [handoverNotes, setHandoverNotes] = useState('');
    const [isOverridden, setIsOverridden] = useState(false);
    
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Canvas para firma
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const isBlocked = (!handoverExists || blockingTicketsCount > 0) && !isOverridden;

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

    const handleSubmit = async () => {
        setError(''); setSuccess('');
        
        const canvas = canvasRef.current;
        if (!canvas) return setError('El canvas de firma no cargó.');
        const signatureOutBase64 = canvas.toDataURL('image/png');
        
        // Blank canvas check (simple heuristic)
        if (signatureOutBase64.length < 1000) {
            return setError('Debe estampar su firma digital para proceder.');
        }

        setIsSubmitting(true);
        const res = await createShiftClosure({
            shiftDate: new Date(),
            shiftType: ShiftType.MORNING, // Dinámico según reloj en producción real
            signatureOutBase64,
            isOverridden,
            handoverNotes
        });

        setIsSubmitting(false);
        if (res.success) {
            setSuccess('¡El turno ha sido cerrado y firmado con éxito! Auditoría generada.');
            clearCanvas();
        } else {
            setError(res.message || res.error || 'Ocurrió un error en el servidor.');
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-2xl mx-auto mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 tracking-tight">Shift Closure Wizard (Cierre de Turno)</h2>
            
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm font-medium border border-red-100">{error}</div>}
            {success && <div className="bg-green-50 text-green-700 p-3 rounded-md mb-4 text-sm font-medium border border-green-100">{success}</div>}
            
            <div className="space-y-4 mb-6">
                {/* Panel de Validación Automática */}
                <div className="p-4 rounded-lg border bg-slate-50 border-slate-200">
                    <h3 className="font-semibold text-slate-700 mb-3">Estado de Dependencias del Turno</h3>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-center justify-between">
                            <span className="text-gray-600">Tickets Urgentes Abiertos:</span>
                            {blockingTicketsCount > 0 ? (
                                <span className="text-red-600 font-bold bg-red-100 px-2 py-1 rounded">{blockingTicketsCount} Bloqueantes</span>
                            ) : (
                                <span className="text-green-600 font-bold">0 (OK)</span>
                            )}
                        </li>
                        <li className="flex items-center justify-between mt-2">
                            <span className="text-gray-600">Relevo Clínico (Handover):</span>
                            {!handoverExists ? (
                                <span className="text-red-600 font-bold bg-red-100 px-2 py-1 rounded">No Recibido (Bloqueante)</span>
                            ) : (
                                <span className="text-green-600 font-bold">Recibido (OK)</span>
                            )}
                        </li>
                    </ul>
                </div>

                {(!handoverExists || blockingTicketsCount > 0) && (
                    <div className="bg-orange-50 p-4 border border-orange-200 rounded-lg">
                        <label className="flex items-start space-x-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="mt-1 h-5 w-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                                checked={isOverridden}
                                onChange={(e) => setIsOverridden(e.target.checked)}
                            />
                            <div>
                                <span className="font-bold text-orange-800 block">Autorizar Forzado (Override)</span>
                                <span className="text-sm text-orange-700 leading-tight block mt-1">
                                    Reconozco que el turno tiene bloqueos activos. Al forzar este cierre, asumo la responsabilidad directiva y este evento quedará registrado en el Log de Auditoría como una excepción.
                                </span>
                            </div>
                        </label>
                    </div>
                )}

                <div>
                    <label className="block text-sm text-gray-600 mb-1 font-medium">Notas Generales del Supervisor (Opcional)</label>
                    <textarea 
                        className="w-full border-gray-300 rounded-md shadow-sm p-3 border placeholder-gray-400 focus:ring-slate-500 focus:border-slate-500" 
                        rows={3} 
                        value={handoverNotes} 
                        onChange={e => setHandoverNotes(e.target.value)} 
                        placeholder="Novedades de infraestructura, personal o eventos notables durante la guardia..."
                    ></textarea>
                </div>
            </div>

            <div className="mb-8">
                <h3 className="font-semibold text-gray-700 mb-2">Firma del Supervisor Saliente</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 touch-none w-full max-w-sm">
                    <canvas 
                        ref={canvasRef} 
                        width={380} 
                        height={120} 
                        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing}
                        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                        className="cursor-crosshair w-full"
                    />
                </div>
                <button onClick={clearCanvas} className="text-xs font-medium text-slate-500 mt-2 hover:text-slate-800 transition">⟳ Limpiar pad de firmas</button>
            </div>

            <button 
                onClick={handleSubmit} 
                disabled={isSubmitting || isBlocked || success !== ''}
                className={`w-full font-bold py-3 px-4 rounded-lg shadow-md transition-all ${
                    isBlocked 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : isOverridden 
                        ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
            >
                {isSubmitting 
                    ? 'Auditando y Cerrando Planta...' 
                    : isBlocked 
                        ? 'Cierre Bloqueado (Requiere Override)' 
                        : isOverridden 
                            ? '⚠ Forzar Cierre con Novedades' 
                            : 'Firmar y Cerrar Planta Oficialmente'
                }
            </button>
        </div>
    );
}
