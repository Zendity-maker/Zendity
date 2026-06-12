/**
 * SignaturePad — canvas firma digital de la TS para aprobar la evaluación.
 *
 *   - HTML5 canvas, eventos mouse + touch (tablet/laptop)
 *   - Output: base64 PNG vía `onAccept(base64)`
 *   - Validación de área mínima firmada (anti-firma-vacía) — % de pixels
 *     no-fondo. Si está por debajo del umbral, "Aceptar" queda deshabilitado.
 *   - Botón "Limpiar" + "Aceptar"
 *   - Trazo teal Zéndity sobre fondo blanco, grosor 2.5px
 *   - Tablet-friendly: canvas 100% width, alto fijo cómodo, touch-action: none
 *     para evitar scroll mientras la TS firma.
 *
 * NO maneja modal/backdrop por sí mismo — se monta dentro de un Modal del
 * page de eval (P5). Razón: el modal de aprobación incluye más que la firma
 * (nombre del firmante, número de colegiado, reason del addendum eventual).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SignaturePadProps {
    /** Callback con el dataURL base64 PNG cuando el usuario clica "Aceptar". */
    onAccept: (base64Png: string) => void;
    /** Callback opcional para "Cancelar" — typically cerrar el modal padre. */
    onCancel?: () => void;
    /** Alto del canvas en píxels. Default 180 — cómodo en tablet+laptop. */
    height?: number;
    /** Umbral mínimo (0-1) de pixels firmados sobre total. Default 0.005 (~0.5%). */
    minFillRatio?: number;
}

const STROKE_COLOR = '#0F6B78';   // Zéndity teal
const STROKE_WIDTH = 2.5;

export function SignaturePad({
    onAccept,
    onCancel,
    height = 180,
    minFillRatio = 0.005,
}: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef<boolean>(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);
    const [hasInk, setHasInk] = useState(false);
    const [fillRatio, setFillRatio] = useState(0);

    // ─── Setup canvas con dpr (retina) ──────────────────────────────────
    const setupCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = STROKE_COLOR;
        ctx.lineWidth = STROKE_WIDTH;
        // Fondo blanco — fundamental para que el base64 PNG no salga transparente
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
    }, []);

    useEffect(() => {
        setupCanvas();
        const onResize = () => setupCanvas();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [setupCanvas]);

    // ─── Pointer handlers (mouse + touch unified) ──────────────────────
    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.setPointerCapture(e.pointerId);
        drawing.current = true;
        lastPoint.current = getPoint(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const point = getPoint(e);
        if (lastPoint.current) {
            ctx.beginPath();
            ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
        }
        lastPoint.current = point;
        if (!hasInk) setHasInk(true);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        drawing.current = false;
        lastPoint.current = null;
        try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        recomputeFillRatio();
    };

    // ─── Fill ratio — % pixels no-blancos, decide si "Aceptar" se habilita ──
    const recomputeFillRatio = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const { width, height: h } = canvas;
        const img = ctx.getImageData(0, 0, width, h);
        let inked = 0;
        const total = (width * h);
        // Loop por canal R cada 4 bytes. Pixel "firmado" = R<240 (no blanco puro).
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i] < 240) inked++;
        }
        const ratio = inked / total;
        setFillRatio(ratio);
    }, []);

    // ─── Limpiar ────────────────────────────────────────────────────────
    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
        setHasInk(false);
        setFillRatio(0);
    };

    // ─── Aceptar — emite base64 PNG ─────────────────────────────────────
    const handleAccept = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const base64 = canvas.toDataURL('image/png');
        // base64 incluye el prefijo "data:image/png;base64," — el caller decide
        // si lo strip antes de enviar al endpoint.
        onAccept(base64);
    };

    const canAccept = hasInk && fillRatio >= minFillRatio;

    return (
        <div className="flex flex-col gap-3">
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white overflow-hidden">
                <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: `${height}px`, touchAction: 'none' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    aria-label="Firma de la Trabajadora Social"
                />
            </div>

            <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500 leading-snug">
                    {hasInk
                        ? canAccept
                            ? 'Firma capturada. Toca "Aceptar" para confirmar.'
                            : 'Trazo muy corto — agrega un poco más antes de aceptar.'
                        : 'Firma en el espacio con el dedo o el mouse.'}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={!hasInk}
                        className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Limpiar
                    </button>
                    <button
                        type="button"
                        onClick={handleAccept}
                        disabled={!canAccept}
                        className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Aceptar firma
                    </button>
                </div>
            </div>
        </div>
    );
}
