"use client";

import { useState, useEffect, useRef } from "react";
import { FaPaperPlane } from "react-icons/fa";
import { X, MessageSquare, ArrowLeft, Clock, Check } from "lucide-react";

interface Props {
    open: boolean;
    onClose: () => void;
    /**
     * Lo que sube al badge del header ya NO es "sin leer": son HILOS
     * PENDIENTES —familias que escribieron y nadie contestó—, que es lo único
     * que puede moverse. El "sin leer" era cero en las 23 conversaciones
     * porque abrir el hilo lo marcaba entero. Ver la cabecera del GET en
     * /api/corporate/family-messages.
     */
    onPendientesChange: (count: number) => void;
}

/**
 * Días que lleva esperando una familia. Se cuenta en días enteros porque así
 * lo lee una persona: "esperando 68 días", no "hace 1.632 horas".
 *
 * Vive aquí y lo importa la página del hub (/corporate/family-messages) para
 * que las dos pantallas cuenten igual: si una redondea hacia arriba y la otra
 * hacia abajo, el mismo hilo sale con 68 días en una y 69 en la otra.
 */
export function diasEsperando(desde: string | Date): number {
    const ms = Date.now() - new Date(desde).getTime();
    return Math.max(0, Math.floor(ms / 86400000));
}

export function etiquetaEspera(dias: number): string {
    if (dias === 0) return 'esperando hoy';
    if (dias === 1) return 'esperando 1 día';
    return `esperando ${dias} días`;
}

/**
 * El color sube con la espera: lo que lleva dos semanas sin respuesta no puede
 * verse igual que lo de esta mañana. Rojo sólido es "esto pide decisión ya",
 * el mismo criterio que el panel de dirección.
 */
export function estiloEspera(dias: number): string {
    if (dias >= 14) return 'bg-rose-600 text-white';
    if (dias >= 3)  return 'bg-rose-50 text-rose-700';
    return 'bg-amber-50 text-amber-700';
}

const NOMBRE_BANDEJA: Record<string, string> = {
    NURSING: 'Enfermería',
    ADMINISTRATION: 'Administración',
};

function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Hoy";
    if (d.toDateString() === yesterday.toDateString()) return "Ayer";
    return d.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'short' });
}

function isSameDay(a: string, b: string): boolean {
    return new Date(a).toDateString() === new Date(b).toDateString();
}

export default function FamilyMessagesPanel({ open, onClose, onPendientesChange }: Props) {
    const [conversations, setConversations] = useState<any[]>([]);
    const [selected, setSelected] = useState<any | null>(null);
    /**
     * LA CONVERSACIÓN ABIERTA, LEÍDA SIEMPRE AL DÍA.
     *
     * El intervalo de abajo se crea UNA VEZ, cuando el panel se abre, y captura
     * el `loadConversations` de ese render — donde `selected` vale `null`,
     * porque el panel siempre abre en la lista. Así que el `if (selected)` del
     * refresco era falso para siempre y **la conversación que tienes abierta
     * nunca recibía mensajes nuevos**: había que cerrarla y volver a entrar
     * para ver una respuesta.
     *
     * Es el fallo espejo del que tenía el buzón de enfermería, que en vez de no
     * refrescar re-abría el hilo cerrado. La misma causa —leer estado desde una
     * closure vieja— con dos síntomas opuestos.
     */
    const selectedRef = useRef<any | null>(null);
    useEffect(() => { selectedRef.current = selected; }, [selected]);
    const [reply, setReply] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [isImproving, setIsImproving] = useState(false);
    const [marcando, setMarcando] = useState(false);
    const [errorMarcar, setErrorMarcar] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadConversations = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch('/api/corporate/family-messages');
            const data = await res.json();
            if (data.success) {
                setConversations(data.conversations);
                const pendientes: number = data.conversations.filter((c: any) => c.pendiente).length;
                onPendientesChange(pendientes);
                // Por el ref, no por el estado capturado. Ver arriba.
                const abierta = selectedRef.current;
                if (abierta) {
                    const updated = data.conversations.find((c: any) => c.patientId === abierta.patientId);
                    if (updated) setSelected(updated);
                }
            }
        } catch (e) {
            console.error('[FamilyMessagesPanel] load error:', e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        loadConversations();
        // Abrir el panel = ver los mensajes → limpiar las notificaciones 💬 de
        // la campana de ESTE usuario. Sin esto quedaban vivas para siempre
        // aunque el chat ya estuviera leído. Fuera del interval a propósito:
        // el polling de fondo no debe marcar nada.
        fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link: '/corporate/family-messages' }),
        }).catch(() => {});
        const interval = setInterval(() => loadConversations(true), 12000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (selected) {
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
    }, [selected?.patientId, selected?.messages?.length]);

    /**
     * SELECCIONAR UN HILO YA NO LO MARCA LEÍDO.
     *
     * Aquí se mandaba un PATCH al hacer clic en la conversación, antes de que
     * nadie hubiera bajado a leer nada: eso no medía lectura, medía que algo se
     * había abierto. Como se abría todo, `isRead` quedó en true en los 105
     * mensajes de la base. Desde el 16-sep-2026 el PATCH exige
     * `accion: 'MARCAR_LEIDO'` y este llamador recibiría un 400.
     * Marcar leído es ahora el botón explícito de abajo.
     */
    const handleSelectConversation = (conv: any) => {
        setSelected(conv);
        setReply("");
        setErrorMarcar(null);
    };

    /** Acto explícito: alguien leyó este hilo y lo declara. */
    const handleMarcarLeido = async () => {
        if (!selected || marcando) return;
        setMarcando(true);
        setErrorMarcar(null);
        try {
            const res = await fetch('/api/corporate/family-messages', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId: selected.patientId, accion: 'MARCAR_LEIDO' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                // Un botón que se pulsa y no hace nada es peor que uno que no
                // está: quien lo pulsó se queda creyendo que el hilo se marcó.
                setErrorMarcar(data.error || 'No se pudo marcar como leído. Inténtalo de nuevo.');
                return;
            }
            await loadConversations(true);
        } catch {
            setErrorMarcar('No se pudo marcar como leído: sin conexión con el servidor.');
        } finally {
            setMarcando(false);
        }
    };

    const handleImproveWithZendi = async () => {
        if (!reply.trim() || isImproving) return;
        setIsImproving(true);
        try {
            const res = await fetch('/api/care/zendi/improve-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: reply, context: 'family_message' }),
            });
            const data = await res.json();
            if (data.success && data.improved) {
                setReply(data.improved);
            }
        } catch (e) {
            console.error('[FamilyMessagesPanel] improve error:', e);
        } finally {
            setIsImproving(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reply.trim() || !selected || sending) return;
        setSending(true);
        const textToSend = reply.trim();
        setReply("");
        try {
            await fetch('/api/corporate/family-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId: selected.patientId, content: textToSend })
            });
            await loadConversations(true);
        } finally {
            setSending(false);
        }
    };

    if (!open) return null;

    const totalPendientes = conversations.filter(c => c.pendiente).length;
    const diasSeleccionado = selected?.pendiente ? diasEsperando(selected.esperandoDesde) : 0;

    return (
        <>
            {/* Overlay — solo visible en desktop (en móvil el panel es fullscreen) */}
            <div
                className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm hidden md:block"
                onClick={onClose}
            />

            {/*
              ┌─────────────────────────────────────────────────┐
              │  MÓVIL  (<md):  inset-0 = fullscreen completo   │
              │  DESKTOP (md+): lateral derecho, 420px de ancho │
              └─────────────────────────────────────────────────┘
              min-h-0 en flex-col es crítico para que overflow-y-auto
              funcione correctamente en hijos flex.
            */}
            <div className="
                fixed z-50 bg-white shadow-2xl
                flex flex-col
                inset-0
                md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[420px]
                animate-in slide-in-from-right duration-300
            ">

                {/* ── HEADER ─────────────────────────────────── */}
                <div className="flex items-center justify-between px-4 py-4 md:py-3.5 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
                    {selected ? (
                        <button
                            onClick={() => setSelected(null)}
                            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 md:w-4 md:h-4" />
                            <span className="text-sm">Conversaciones</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-2.5">
                            <MessageSquare className="w-5 h-5 text-teal-600" />
                            <h2 className="font-extrabold text-slate-800 text-base md:text-sm">Mensajes Familiares</h2>
                        </div>
                    )}
                    {/* X más grande en móvil para facilitar el toque */}
                    <button
                        onClick={onClose}
                        className="p-2 md:p-1.5 rounded-xl hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-800"
                    >
                        <X className="w-6 h-6 md:w-5 md:h-5" />
                    </button>
                </div>

                {/* ── VISTA: Lista de conversaciones ─────────── */}
                {!selected && totalPendientes > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border-b border-rose-100 flex-shrink-0">
                        <Clock className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <p className="text-xs font-black text-rose-800">
                            {totalPendientes === 1
                                ? '1 familia espera respuesta'
                                : `${totalPendientes} familias esperan respuesta`}
                        </p>
                    </div>
                )}
                {!selected && (
                    <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-50">
                        {loading ? (
                            <div className="flex justify-center items-center h-32">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400 px-6 py-8">
                                <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                                <p className="text-sm font-semibold text-slate-500 text-center">Sin mensajes de familiares</p>
                                <p className="text-xs text-slate-400 mt-1 text-center leading-relaxed">
                                    Cuando un familiar escriba, aparecerá aquí.
                                </p>
                            </div>
                        ) : (
                            conversations.map(conv => {
                                // La ruta ya los devuelve ordenados: primero lo que le
                                // debemos a una familia, y dentro de eso el que lleva
                                // más esperando. Aquí solo se pinta.
                                const dias = conv.pendiente ? diasEsperando(conv.esperandoDesde) : 0;
                                return (
                                <button
                                    key={conv.patientId}
                                    onClick={() => handleSelectConversation(conv)}
                                    // Target táctil más grande en móvil
                                    className={`w-full text-left px-4 py-4 md:py-3.5 transition-colors hover:bg-slate-50 active:bg-teal-50/60 ${
                                        conv.pendiente ? 'border-l-4 border-rose-500 bg-rose-50/30' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 md:w-11 md:h-11 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 transition-colors ${
                                            conv.pendiente
                                                ? 'bg-rose-500 text-white shadow-md shadow-rose-200'
                                                : conv.unreadCount > 0
                                                    ? 'bg-teal-500 text-white shadow-md shadow-teal-200'
                                                    : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {conv.pendiente
                                                ? conv.mensajesSinResponder
                                                : conv.unreadCount > 0 ? conv.unreadCount : conv.patientName.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <p className={`text-sm truncate ${conv.pendiente || conv.unreadCount > 0 ? 'font-black text-slate-900' : 'font-bold text-slate-600'}`}>
                                                    {conv.patientName}
                                                </p>
                                                <span className="text-[10px] text-slate-400 font-bold ml-2 flex-shrink-0">
                                                    {new Date(conv.lastMessage.createdAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            {conv.roomNumber && (
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hab. {conv.roomNumber}</p>
                                            )}
                                            {/* LO QUE FALTA POR CONTESTAR. El servidor ya lo
                                                calcula; sin esto el trabajo no se ve. */}
                                            {conv.pendiente && (
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-black tabular-nums px-2 py-0.5 rounded-full ${estiloEspera(dias)}`}>
                                                        <Clock className="w-3 h-3" />
                                                        {etiquetaEspera(dias)}
                                                    </span>
                                                    {conv.bandejaPendiente && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                            {NOMBRE_BANDEJA[conv.bandejaPendiente] || conv.bandejaPendiente}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <p className={`text-xs mt-0.5 truncate ${conv.pendiente || conv.unreadCount > 0 ? 'font-semibold text-slate-700' : 'font-medium text-slate-400'}`}>
                                                {conv.lastMessage.senderType === 'STAFF' ? '↩ ' : ''}{conv.lastMessage.content}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                                );
                            })
                        )}
                    </div>
                )}

                {/* ── VISTA: Chat individual ──────────────────── */}
                {selected && (
                    <>
                        {/* Sub-header paciente */}
                        <div className="px-4 py-2.5 bg-white border-b border-slate-50 flex-shrink-0 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-extrabold text-slate-800 text-sm truncate">{selected.patientName}</p>
                                {selected.roomNumber && (
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Habitación {selected.roomNumber}</p>
                                )}
                            </div>
                            {/* Marcar leído ya no ocurre solo por abrir el hilo: hay
                                que declararlo. El botón manda la acción explícita
                                que exige el PATCH y enseña el error si falla. */}
                            {selected.unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleMarcarLeido}
                                    disabled={marcando}
                                    className="flex items-center gap-1 text-[11px] font-bold text-teal-700 border border-teal-200 hover:bg-teal-50 disabled:opacity-50 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
                                >
                                    <Check className="w-3 h-3" />
                                    {marcando ? 'Marcando…' : 'Marcar leído'}
                                </button>
                            )}
                        </div>

                        {errorMarcar && (
                            <div className="px-4 py-2 bg-rose-50 border-b border-rose-100 flex-shrink-0">
                                <p className="text-[11px] font-bold text-rose-700">{errorMarcar}</p>
                            </div>
                        )}

                        {/* Cuánto lleva esperando esta familia, arriba del hilo:
                            quien entra a responder ve primero la deuda. */}
                        {selected.pendiente && (
                            <div className="px-4 py-2 bg-rose-50 border-b border-rose-100 flex-shrink-0 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                                <p className="text-[11px] font-bold text-rose-800">
                                    Sin responder desde el {new Date(selected.esperandoDesde).toLocaleDateString('es-PR', { day: '2-digit', month: 'short' })}
                                    {' · '}
                                    <span className="tabular-nums">{etiquetaEspera(diasSeleccionado)}</span>
                                    {selected.bandejaPendiente && ` · ${NOMBRE_BANDEJA[selected.bandejaPendiente] || selected.bandejaPendiente}`}
                                </p>
                            </div>
                        )}

                        {/*
                          flex-1 min-h-0 → permite que el scroll funcione dentro del flex column.
                          pb-24 md:pb-4  → espacio extra en móvil por si el teclado virtual
                                           no redimensiona el viewport (comportamiento legacy Safari iOS).
                        */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-slate-50/30 pb-24 md:pb-4">
                            {selected.messages.map((msg: any, idx: number) => {
                                const isFamily = msg.senderType === 'FAMILY';
                                const showDateSep = idx === 0 || !isSameDay(selected.messages[idx - 1].createdAt, msg.createdAt);

                                return (
                                    <div key={msg.id}>
                                        {showDateSep && (
                                            <div className="flex items-center gap-3 my-3">
                                                <div className="flex-1 h-px bg-slate-100" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    {formatDateLabel(msg.createdAt)}
                                                </span>
                                                <div className="flex-1 h-px bg-slate-100" />
                                            </div>
                                        )}
                                        <div className={`flex flex-col ${isFamily ? 'items-start' : 'items-end'}`}>
                                            {/* Nombre del sender */}
                                            {msg.senderName && (
                                                <span className={`text-[10px] font-black uppercase tracking-wider mb-1 px-1 ${
                                                    isFamily ? 'text-slate-400' : 'text-teal-600'
                                                }`}>
                                                    {msg.senderName}
                                                </span>
                                            )}
                                            <div className={`max-w-[82%] rounded-3xl p-3.5 shadow-sm ${
                                                isFamily
                                                    ? 'bg-white border border-slate-100 text-slate-800 rounded-bl-sm'
                                                    : 'bg-teal-500 text-white rounded-br-sm'
                                            }`}>
                                                {isFamily && (
                                                    <div className="text-[10px] font-black uppercase tracking-wider text-teal-600 mb-1.5">
                                                        {msg.recipientType === 'NURSING' ? '💊 Para Enfermería' : '🏢 Para Administración'}
                                                    </div>
                                                )}
                                                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                                <span className={`text-[10px] font-bold block mt-1.5 text-right ${isFamily ? 'text-slate-400' : 'text-white/60'}`}>
                                                    {new Date(msg.createdAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                                    {isFamily && !msg.isRead && (
                                                        <span className="ml-2 bg-amber-100 text-amber-600 rounded px-1 font-black">nuevo</span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/*
                          sticky bottom-0 → el input se ancla al fondo del viewport
                          visible cuando aparece el teclado virtual en iOS/Android.
                          flex-shrink-0 → nunca se comprime dentro del flex column.
                        */}
                        <div className="sticky bottom-0 flex-shrink-0 bg-white border-t border-slate-100 p-4 safe-pb">
                            {reply.length > 10 && (
                                <div className="flex justify-end mb-2">
                                    <button
                                        type="button"
                                        onClick={handleImproveWithZendi}
                                        disabled={isImproving}
                                        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 px-2 py-1 rounded border border-teal-200 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isImproving ? (
                                            <>
                                                <span className="animate-spin inline-block w-3 h-3 border border-teal-400 border-t-transparent rounded-full" />
                                                Mejorando...
                                            </>
                                        ) : (
                                            '✨ Zendi'
                                        )}
                                    </button>
                                </div>
                            )}
                            <form onSubmit={handleSend} className="flex gap-3 relative">
                                <input
                                    type="text"
                                    value={reply}
                                    onChange={e => setReply(e.target.value)}
                                    placeholder={`Responder a familia de ${selected.patientName}…`}
                                    className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl py-3.5 md:py-3 pl-4 pr-14 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50 transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                                />
                                <button
                                    type="submit"
                                    disabled={!reply.trim() || sending}
                                    className="absolute right-2 top-2 bottom-2 aspect-square bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-md shadow-teal-200"
                                >
                                    <FaPaperPlane className="text-xs ml-0.5" />
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
