"use client";

/**
 * /family/messages — Propuesta C · Humanista Suave
 *
 * Conversación con tabs de destinatario, burbujas suaves y compose fijo abajo.
 */

import { useState, useEffect, useRef } from "react";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { IconMensajes } from "@/components/icons/ZendityIcons";

type RecipientType = "ADMINISTRATION" | "NURSING";

// ── Helpers de tiempo ──
function humanTime(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    const hour = d.getHours();

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
    const [recipientType, setRecipientType] = useState<RecipientType>("ADMINISTRATION");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadMessages = () => {
        fetch("/api/family/messages")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setMessages(data.messages);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        loadMessages();
        const interval = setInterval(loadMessages, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, recipientType]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;
        setSending(true);

        const optimisticMsg = {
            id: Date.now().toString(),
            content: newMessage.trim(),
            senderType: "FAMILY",
            recipientType,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        const textToSend = newMessage.trim();
        setNewMessage("");

        try {
            await fetch("/api/family/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: textToSend, recipientType }),
            });
        } finally {
            setSending(false);
            loadMessages();
        }
    };

    const recipientLabel =
        recipientType === "ADMINISTRATION" ? "Administración" : "Enfermería";

    // Filtrar por destinatario activo
    const filteredMessages = messages.filter((m: any) => {
        // Si no tiene recipientType definido, asumir ADMINISTRATION
        const r = m.recipientType || "ADMINISTRATION";
        return r === recipientType;
    });

    return (
        <div className="bg-[#FAFAF8] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen flex flex-col">
            {/* ═══ HEADER ═════════════════════════════════════════════ */}
            <header className="bg-white border-b border-stone-100 px-4 py-5 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <IconMensajes size={24} className="text-teal-700" />
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

            {/* ═══ TABS DESTINATARIO ══════════════════════════════════ */}
            <div className="max-w-2xl mx-auto w-full px-4 pt-4">
                <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                    Destinatario
                </p>
                <div className="flex gap-2 mb-4">
                    {(["ADMINISTRATION", "NURSING"] as RecipientType[]).map((r) => {
                        const isActive = recipientType === r;
                        const label = r === "ADMINISTRATION" ? "Administración" : "Enfermería";
                        return (
                            <button
                                key={r}
                                onClick={() => setRecipientType(r)}
                                className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors ${
                                    isActive
                                        ? "bg-teal-50 text-teal-700 border-teal-100"
                                        : "bg-white text-slate-500 border-slate-200 hover:text-slate-700"
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ═══ CONVERSACIÓN ═══════════════════════════════════════ */}
            <section className="flex-1 max-w-2xl mx-auto w-full px-4 pb-32">
                {loading && filteredMessages.length === 0 ? (
                    <div className="min-h-[40vh] flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" strokeWidth={1.5} />
                    </div>
                ) : filteredMessages.length === 0 ? (
                    <div className="text-center py-20">
                        <MessageCircle
                            className="w-12 h-12 text-slate-200 mx-auto mb-4"
                            strokeWidth={1.5}
                        />
                        <p className="text-sm text-slate-400 italic mb-1">
                            Aún no hay mensajes con {recipientLabel}
                        </p>
                        <p className="text-xs text-slate-400">
                            Escribe el primero para iniciar la conversación
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 pt-2">
                        {filteredMessages.map((msg: any, idx: number) => {
                            const isFamily = msg.senderType === "FAMILY";
                            const showDateSeparator =
                                idx === 0 ||
                                !isSameDay(filteredMessages[idx - 1].createdAt, msg.createdAt);
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
                                            <div className="bg-teal-600 rounded-2xl rounded-tr-sm px-4 py-2.5">
                                                <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
                                                    {msg.content}
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-1 pr-1">
                                                {humanTime(msg.createdAt)}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-start max-w-[80%] self-start">
                                            {senderName && (
                                                <span className="text-xs text-slate-400 mb-1 pl-1">
                                                    {senderName}
                                                </span>
                                            )}
                                            <div className="bg-teal-50 rounded-2xl rounded-tl-sm px-4 py-2.5">
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
                            placeholder={`Escribe a ${recipientLabel}…`}
                            rows={1}
                            className="flex-1 bg-stone-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 resize-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 focus:outline-none transition-all"
                            style={{ maxHeight: "120px" }}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || sending}
                            className="w-11 h-11 rounded-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0"
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
