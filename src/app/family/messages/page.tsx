"use client";

import { useState, useEffect, useRef } from "react";
import { FaPaperPlane, FaUserNurse, FaBuilding } from "react-icons/fa";

type RecipientType = "ADMINISTRATION" | "NURSING";

const RECIPIENTS: { value: RecipientType; label: string; icon: string; color: string }[] = [
    { value: "ADMINISTRATION", label: "Administración", icon: "🏢", color: "teal" },
    { value: "NURSING",        label: "Enfermería",     icon: "💊", color: "rose" }
];

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

export default function FamilyMessages() {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [recipientType, setRecipientType] = useState<RecipientType>("ADMINISTRATION");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadMessages = () => {
        fetch('/api/family/messages')
            .then(res => res.json())
            .then(data => {
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
            senderType: 'FAMILY',
            recipientType,
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);
        const textToSend = newMessage.trim();
        setNewMessage("");

        try {
            await fetch('/api/family/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: textToSend, recipientType })
            });
        } finally {
            setSending(false);
            loadMessages();
        }
    };

    const currentRecipient = RECIPIENTS.find(r => r.value === recipientType)!;
    const isTeal = recipientType === "ADMINISTRATION";

    return (
        <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[780px] bg-white rounded-3xl shadow-md shadow-slate-100/50 border border-slate-100/60 overflow-hidden animate-in fade-in zoom-in-95 duration-500">

            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-5 flex items-center gap-4 z-10 flex-shrink-0">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md text-xl transition-all duration-300 ${
                    isTeal ? 'bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-200' : 'bg-gradient-to-br from-rose-400 to-pink-500 shadow-rose-200'
                }`}>
                    {isTeal ? <FaBuilding /> : <FaUserNurse />}
                </div>
                <div className="flex-1">
                    <h2 className="font-bold text-slate-800 text-lg leading-tight">
                        {currentRecipient.icon} {currentRecipient.label}
                    </h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Zendity Family Link</p>
                </div>
            </div>

            {/* Recipient Selector */}
            <div className="bg-white border-b border-slate-100 p-3 flex-shrink-0">
                <div className="flex gap-2 bg-slate-50 rounded-2xl p-1">
                    {RECIPIENTS.map(r => (
                        <button
                            key={r.value}
                            onClick={() => setRecipientType(r.value)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                                recipientType === r.value
                                    ? r.value === 'ADMINISTRATION'
                                        ? 'bg-teal-500 text-white shadow-md shadow-teal-200'
                                        : 'bg-rose-500 text-white shadow-md shadow-rose-200'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <span>{r.icon}</span>
                            <span>{r.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/50">
                {loading && messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                        <div className="text-5xl mb-4 opacity-30">💬</div>
                        <p className="text-sm font-semibold text-slate-500">Bandeja de mensajes segura</p>
                        <p className="text-xs mt-2 text-center max-w-xs leading-relaxed">
                            Escríbele a {currentRecipient.label} de su clínica. Te responderán por este mismo medio oficial.
                        </p>
                    </div>
                ) : (
                    messages.map((msg: any, idx: number) => {
                        const isFamily = msg.senderType === 'FAMILY';
                        const showDateSeparator = idx === 0 || !isSameDay(messages[idx - 1].createdAt, msg.createdAt);

                        return (
                            <div key={msg.id}>
                                {/* Date Separator */}
                                {showDateSeparator && (
                                    <div className="flex items-center gap-3 my-4">
                                        <div className="flex-1 h-px bg-slate-100"></div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                                            {formatDateLabel(msg.createdAt)}
                                        </span>
                                        <div className="flex-1 h-px bg-slate-100"></div>
                                    </div>
                                )}

                                <div className={`flex flex-col ${isFamily ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-1`}>
                                    {/* Nombre del sender sobre el bubble */}
                                    {!isFamily && msg.senderName && (
                                        <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 mb-1 px-1">
                                            {msg.senderName}
                                        </span>
                                    )}
                                    <div className={`max-w-[85%] sm:max-w-[70%] rounded-3xl p-4 shadow-sm relative ${
                                        isFamily
                                            ? msg.recipientType === 'NURSING'
                                                ? 'bg-rose-500 text-white rounded-br-sm'
                                                : 'bg-teal-500 text-white rounded-br-sm'
                                            : 'bg-white border border-slate-100 text-slate-800 rounded-bl-sm'
                                    }`}>
                                        {!isFamily && (
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] uppercase font-black tracking-wider text-teal-600">
                                                    {msg.recipientType === 'NURSING' ? '💊 Enfermería' : '🏢 Administración'}
                                                </span>
                                            </div>
                                        )}
                                        {/* Imagen adjunta (broadcast) */}
                                        {msg.imageBase64 && (
                                            <img
                                                src={msg.imageBase64}
                                                alt="Imagen adjunta"
                                                className="rounded-2xl mb-3 max-w-full object-cover"
                                                style={{ maxHeight: '220px' }}
                                            />
                                        )}
                                        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                        <span className={`text-[10px] font-bold block mt-2 text-right uppercase tracking-wider ${
                                            isFamily ? 'text-white/60' : 'text-slate-400'
                                        }`}>
                                            {new Date(msg.createdAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex-shrink-0">
                <form onSubmit={handleSend} className="flex gap-3 relative">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={`Escríbele a ${currentRecipient.label}…`}
                        className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 sm:py-4 pl-5 pr-14 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50 transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className={`absolute right-2 top-2 bottom-2 aspect-square disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-md ${
                            isTeal
                                ? 'bg-teal-500 hover:bg-teal-600 shadow-teal-200'
                                : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'
                        }`}
                    >
                        <FaPaperPlane className="text-sm ml-0.5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
