"use client";

/**
 * /family/messages — Propuesta C · Humanista Suave
 *
 * UNA sola conversación en orden cronológico: lo que escribe la familia, lo que
 * responde el hogar y los avisos automáticos, mezclados.
 *
 * Antes estaba partida en dos pestañas por destinatario ("Administración" y
 * "Enfermería"). Medido el 16-sep-2026: las dos pestañas partían en dos los 5
 * hilos que hay, así que la familia tenía que adivinar en cuál estaba la
 * respuesta. Y la de Enfermería nunca fue un canal propio: los 21 mensajes del
 * hogar en ese lado salieron todos del flujo de Zendi —el update que Zendi
 * redacta y una persona aprueba en `care/zendi/nursing-updates`— y no de nadie
 * escribiendo ahí; la familia contestó 5 veces a ciegas.
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { IconMensajes } from "@/components/icons/ZendityIcons";

// ── Helpers de tiempo ──
function humanTime(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);

    if (diffMin < 5) return "justo ahora";
    if (diffMin < 60) return `hace ${diffMin} min`;

    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    if (sameDay) {
        return d.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getDate() === yesterday.getDate();
    if (isYesterday) {
        return `ayer ${d.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}`;
    }

    return d.toLocaleDateString("es-PR", { day: "numeric", month: "short" });
}

function isSameDay(a: string, b: string): boolean {
    return new Date(a).toDateString() === new Date(b).toDateString();
}

function dayLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Hoy";
    if (d.toDateString() === yesterday.toDateString()) return "Ayer";
    return d.toLocaleDateString("es-PR", { weekday: "long", day: "numeric", month: "long" });
}

export default function FamilyMessagesPage() {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    // Ids ya enviados al PATCH — para no repetir la llamada en cada poll.
    const vistosRef = useRef<Set<string>>(new Set());
    const router = useRouter();

    /**
     * Marcar visto es un acto de ESTA pantalla, no del listado: sólo se manda
     * cuando la pestaña está delante de la persona y el mensaje está pintado.
     * Antes lo hacía el propio GET, y con el poll de 10s "leído" acababa
     * significando "la pestaña quedó abierta".
     */
    const marcarVistos = (msgs: any[]) => {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

        const ids = msgs
            .filter((m: any) => m.senderType !== "FAMILY" && m.isRead === false && !vistosRef.current.has(m.id))
            .map((m: any) => m.id);
        if (ids.length === 0) return;

        ids.forEach((id: string) => vistosRef.current.add(id));
        fetch("/api/family/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageIds: ids }),
        }).then(() => {
            // El badge lo pinta el layout, que es un server component: sin esto
            // el número sigue encendido mientras la persona lee lo que ya vio, y
            // sólo se apagaría al navegar a otra pantalla y volver.
            router.refresh();
        }).catch(() => {
            // Si falló, que el próximo poll lo reintente.
            ids.forEach((id: string) => vistosRef.current.delete(id));
        });
    };

    const loadMessages = () => {
        fetch("/api/family/messages")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setMessages(data.messages);
                    marcarVistos(data.messages);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        loadMessages();
        // Sin pestaña delante no hay nada que refrescar ni nadie que lea.
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") loadMessages();
        }, 10000);
        const alVolver = () => {
            if (document.visibilityState === "visible") loadMessages();
        };
        document.addEventListener("visibilitychange", alVolver);
        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", alVolver);
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;
        setSending(true);
        setErrorEnvio(null);

        const idOptimista = `optimista-${Date.now()}`;
        const optimisticMsg = {
            id: idOptimista,
            content: newMessage.trim(),
            senderType: "FAMILY",
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        const textToSend = newMessage.trim();
        setNewMessage("");

        try {
            const res = await fetch("/api/family/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: textToSend }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) throw new Error(data?.error || "");
            loadMessages();
        } catch (err: any) {
            // Un envío que falla NO puede desaparecer en silencio. Antes el POST
            // se hacía sin mirar la respuesta: si la sesión había caducado o la
            // cuenta no estaba vinculada, la burbuja aparecía, el poll de 10s se
            // la llevaba, y la familia se quedaba creyendo que el hogar tenía su
            // mensaje. Se retira la burbuja, se devuelve el texto al cuadro para
            // que no haya que reescribirlo, y se dice qué pasó.
            setMessages((prev) => prev.filter((m: any) => m.id !== idOptimista));
            setNewMessage(textToSend);
            setErrorEnvio(
                err?.message || "No se pudo enviar. Revisa tu conexión e inténtalo otra vez."
            );
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-[#FAFAF8] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen flex flex-col">
            {/* ═══ HEADER ═════════════════════════════════════════════ */}
            <header className="bg-white border-b border-stone-100 px-4 py-5 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <IconMensajes size={24} className="text-brand" />
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-slate-800 leading-tight">
                            Mensajes
                        </h1>
                        <span className="text-xs text-slate-400">
                            Comunicación con el equipo
                        </span>
                    </div>
                </div>
            </header>

            {/* ═══ CONVERSACIÓN ═══════════════════════════════════════ */}
            <section className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-32">
                {loading && messages.length === 0 ? (
                    <div className="min-h-[40vh] flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" strokeWidth={1.5} />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-20">
                        <MessageCircle
                            className="w-12 h-12 text-slate-200 mx-auto mb-4"
                            strokeWidth={1.5}
                        />
                        <p className="text-sm text-slate-400 italic mb-1">
                            Aún no hay mensajes
                        </p>
                        <p className="text-xs text-slate-400">
                            Escribe el primero para iniciar la conversación
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 pt-2">
                        {messages.map((msg: any, idx: number) => {
                            const isFamily = msg.senderType === "FAMILY";
                            const isSystem = msg.senderType === "SYSTEM";
                            const showDateSeparator =
                                idx === 0 ||
                                !isSameDay(messages[idx - 1].createdAt, msg.createdAt);
                            const senderName = msg.sender?.name || msg.senderName;

                            return (
                                <div key={msg.id} className="flex flex-col">
                                    {showDateSeparator && (
                                        <div className="flex items-center gap-3 my-3">
                                            <span className="flex-1 h-px bg-slate-100" />
                                            <span className="text-xs text-slate-400 capitalize">
                                                {dayLabel(msg.createdAt)}
                                            </span>
                                            <span className="flex-1 h-px bg-slate-100" />
                                        </div>
                                    )}

                                    {isFamily ? (
                                        <div className="flex flex-col items-end max-w-[80%] self-end">
                                            <div className="bg-brand rounded-2xl rounded-tr-sm px-4 py-2.5">
                                                <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
                                                    {msg.content}
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-1 pr-1">
                                                {humanTime(msg.createdAt)}
                                            </span>
                                        </div>
                                    ) : isSystem ? (
                                        /* Aviso automático (cita, concierge, Zendi): no es una
                                           persona respondiendo, y no debe leerse como tal. */
                                        <div className="self-center max-w-[92%] w-full">
                                            <div className="bg-white border border-stone-200 rounded-2xl px-4 py-3">
                                                <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-1">
                                                    {senderName || "Aviso automático"}
                                                </p>
                                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                    {msg.content}
                                                </p>
                                                <span className="text-[10px] text-slate-400 mt-1 block">
                                                    {humanTime(msg.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-start max-w-[80%] self-start">
                                            {senderName && (
                                                <span className="text-xs text-slate-400 mb-1 pl-1">
                                                    {senderName}
                                                </span>
                                            )}
                                            <div className="bg-brand/10 rounded-2xl rounded-tl-sm px-4 py-2.5">
                                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                    {msg.content}
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-1 pl-1">
                                                {humanTime(msg.createdAt)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </section>

            {/* ═══ COMPOSE BAR — fixed bottom ═════════════════════════ */}
            <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-stone-100 z-20">
                <div className="max-w-2xl mx-auto px-4 py-3">
                    {errorEnvio && (
                        <p
                            role="alert"
                            className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 mb-2"
                        >
                            {errorEnvio}
                        </p>
                    )}
                    <form onSubmit={handleSend} className="flex gap-2 items-end">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e as any);
                                }
                            }}
                            placeholder="Escribe un mensaje al equipo…"
                            rows={1}
                            className="flex-1 bg-stone-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 resize-none focus:ring-2 focus:ring-brand-secondary-500/30 focus:border-brand-secondary focus:outline-none transition-all"
                            style={{ maxHeight: "120px" }}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || sending}
                            className="w-11 h-11 rounded-full bg-brand hover:bg-brand disabled:bg-slate-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0"
                            aria-label="Enviar"
                        >
                            {sending ? (
                                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                            ) : (
                                <Send className="w-4 h-4" strokeWidth={2} />
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
