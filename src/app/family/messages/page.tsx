"use client";

/**
 * /family/messages — Editorial Calm
 *
 * Conversación tipo correspondencia. Serif para metadatos, sans para el cuerpo.
 * Sin cards. Burbujas suaves sobre stone-50. Mucho whitespace.
 */

import { useState, useEffect, useRef } from "react";
import { Send, MessageCircle } from "lucide-react";

type RecipientType = "ADMINISTRATION" | "NURSING";

// ── Tiempo humano (copiado de /family/page.tsx) ──
function humanTime(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    const hour = d.getHours();

    if (diffMin < 5) return "justo ahora";
    if (diffMin < 60) return `hace ${diffMin} minutos`;

    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    if (sameDay) {
        if (hour < 12) return "esta mañana";
        if (hour < 18) return "esta tarde";
        return "esta noche";
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getDate() === yesterday.getDate();
    if (isYesterday) {
        if (hour < 12) return "ayer en la mañana";
        if (hour < 18) return "ayer en la tarde";
        return "anoche";
    }

    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return d.toLocaleDateString("es-PR", { weekday: "long" });
    return d.toLocaleDateString("es-PR", { day: "numeric", month: "long" });
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

export default function FamilyMessagesEditorial() {
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
    }, [messages]);

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

    return (
        <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">
            <div className="max-w-2xl mx-auto px-6 sm:px-10 py-12 pb-40">

                {/* ═══ MASTHEAD ═══════════════════════════════════════════ */}
                <header className="text-center mb-12">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-medium mb-4">
                        Correspondencia
                    </p>
                    <h1
                        className="font-serif text-stone-900 leading-[1.05] tracking-tight mb-4"
                        style={{
                            fontSize: "clamp(2.5rem, 8vw, 4rem)",
                            fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                        }}
                    >
                        Mensajes
                    </h1>
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <span className="block w-12 h-px bg-stone-300" />
                        <span className="text-stone-300 text-xs">◆</span>
                        <span className="block w-12 h-px bg-stone-300" />
                    </div>
                    <p className="font-serif italic text-stone-400 text-base">
                        Conversación con el equipo de cuidado
                    </p>
                </header>

                {/* ═══ SELECTOR DE DESTINATARIO ═══════════════════════════ */}
                <div className="flex items-center justify-center gap-8 mb-14">
                    {(["ADMINISTRATION", "NURSING"] as RecipientType[]).map((r) => {
                        const isActive = recipientType === r;
                        const label = r === "ADMINISTRATION" ? "Administración" : "Enfermería";
                        return (
                            <button
                                key={r}
                                onClick={() => setRecipientType(r)}
                                className={`relative pb-2 font-serif text-base tracking-tight transition-colors ${
                                    isActive
                                        ? "text-teal-700 italic"
                                        : "text-stone-400 hover:text-stone-600"
                                }`}
                                style={isActive ? { fontVariationSettings: "'opsz' 24, 'SOFT' 50" } : undefined}
                            >
                                {label}
                                {isActive && (
                                    <span className="absolute left-0 right-0 -bottom-0.5 h-px bg-teal-600" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ═══ CHAT ═══════════════════════════════════════════════ */}
                <section className="space-y-6">
                    {loading && messages.length === 0 ? (
                        <div className="min-h-[40vh] flex items-center justify-center">
                            <span className="font-serif italic text-stone-300 text-lg">cargando…</span>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="flex justify-center mb-8">
                                <MessageCircle
                                    className="w-16 h-16 text-stone-300"
                                    strokeWidth={1}
                                />
                            </div>
                            <p
                                className="font-serif italic text-stone-500 leading-relaxed mb-3"
                                style={{
                                    fontSize: "1.625rem",
                                    fontVariationSettings: "'opsz' 24, 'SOFT' 50",
                                }}
                            >
                                Aún no hay mensajes
                            </p>
                            <p className="font-serif italic text-stone-400 text-sm max-w-xs mx-auto leading-relaxed">
                                Escribe lo primero a Carmen, Yeray<br />
                                o cualquier miembro del equipo.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg: any, idx: number) => {
                            const isFamily = msg.senderType === "FAMILY";
                            const showDateSeparator =
                                idx === 0 || !isSameDay(messages[idx - 1].createdAt, msg.createdAt);

                            return (
                                <div key={msg.id}>
                                    {showDateSeparator && (
                                        <div className="flex items-center justify-center py-6">
                                            <span className="text-[10px] uppercase tracking-[0.3em] text-stone-400">
                                                {dayLabel(msg.createdAt)}
                                            </span>
                                        </div>
                                    )}

                                    <div className={`flex flex-col ${isFamily ? "items-end" : "items-start"}`}>
                                        {!isFamily && msg.senderName && (
                                            <span className="text-[11px] italic font-serif text-stone-400 mb-1.5 px-2">
                                                {msg.senderName}
                                                {msg.recipientType && (
                                                    <>
                                                        <span className="mx-1.5 text-stone-300">·</span>
                                                        <span>
                                                            {msg.recipientType === "NURSING" ? "Enfermería" : "Administración"}
                                                        </span>
                                                    </>
                                                )}
                                            </span>
                                        )}

                                        <div
                                            className={`max-w-[85%] sm:max-w-[75%] px-5 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
                                                isFamily
                                                    ? "bg-teal-600 text-white"
                                                    : "bg-stone-100 text-stone-800"
                                            }`}
                                            style={{ borderRadius: "18px" }}
                                        >
                                            {msg.imageBase64 && (
                                                <img
                                                    src={msg.imageBase64}
                                                    alt="Imagen adjunta"
                                                    className="rounded-xl mb-3 max-w-full object-cover"
                                                    style={{ maxHeight: "220px" }}
                                                />
                                            )}
                                            <p className="font-sans text-[15px] leading-relaxed whitespace-pre-wrap">
                                                {msg.content}
                                            </p>
                                        </div>

                                        <span
                                            className={`text-[11px] italic font-serif text-stone-400 mt-1.5 px-2 ${
                                                isFamily ? "text-right" : "text-left"
                                            }`}
                                        >
                                            {humanTime(msg.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </section>
            </div>

            {/* ═══ COMPOSE BAR — sticky bottom ═══════════════════════════ */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-stone-100 z-20">
                <div className="max-w-2xl mx-auto px-6 sm:px-10 py-4">
                    <form onSubmit={handleSend} className="flex items-end gap-3">
                        <div className="flex-1">
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
                                className="w-full resize-none bg-white rounded-2xl ring-1 ring-stone-200 focus:ring-2 focus:ring-teal-600 focus:outline-none px-4 py-3 font-sans text-[15px] text-stone-800 placeholder:text-stone-400 placeholder:italic placeholder:font-serif leading-relaxed transition-all"
                                style={{ maxHeight: "120px" }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || sending}
                            className="w-11 h-11 flex items-center justify-center rounded-full bg-teal-600 hover:bg-teal-700 disabled:bg-stone-200 disabled:cursor-not-allowed text-white transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.06)] flex-shrink-0"
                            aria-label="Enviar"
                        >
                            <Send className="w-4 h-4" strokeWidth={2} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
