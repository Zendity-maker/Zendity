"use client";

import { useState, useEffect, useRef } from "react";
import { FaPaperPlane, FaUserFriends, FaComments } from "react-icons/fa";

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

export default function CorporateFamilyMessages() {
    const [conversations, setConversations] = useState<any[]>([]);
    const [selected, setSelected] = useState<any | null>(null);
    const [reply, setReply] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadConversations = async () => {
        try {
            const res = await fetch('/api/corporate/family-messages');
            const data = await res.json();
            if (data.success) {
                setConversations(data.conversations);
                // Actualizar la conversación seleccionada si está abierta
                if (selected) {
                    const updated = data.conversations.find((c: any) => c.patientId === selected.patientId);
                    if (updated) setSelected(updated);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConversations();
        const interval = setInterval(loadConversations, 12000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [selected]);

    const handleSelectConversation = (conv: any) => {
        setSelected(conv);
        setReply("");
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
            await loadConversations();
        } finally {
            setSending(false);
        }
    };

    const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">💬 Mensajes Familiares</h1>
                    <p className="text-slate-500 mt-1 font-medium">Comunicación directa con los familiares de los residentes</p>
                </div>
                {totalUnread > 0 && (
                    <div className="bg-rose-500 text-white px-4 py-2 rounded-2xl font-black text-sm shadow-md shadow-rose-200">
                        {totalUnread} sin leer
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh]">
                {/* Lista de conversaciones */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/80">
                        <h3 className="font-extrabold text-slate-700 text-sm uppercase tracking-widest">Bandejas activas</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                        {loading ? (
                            <div className="flex justify-center items-center h-32">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-slate-400 p-6">
                                <FaUserFriends className="text-3xl mb-2 opacity-30" />
                                <p className="text-xs text-center font-medium">No hay mensajes de familiares todavía.</p>
                            </div>
                        ) : (
                            conversations.map(conv => (
                                <button
                                    key={conv.patientId}
                                    onClick={() => handleSelectConversation(conv)}
                                    className={`w-full text-left p-4 transition-all hover:bg-slate-50 ${
                                        selected?.patientId === conv.patientId ? 'bg-teal-50 border-l-4 border-teal-500' : ''
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 ${
                                            conv.unreadCount > 0 ? 'bg-teal-500' : 'bg-slate-200'
                                        }`}>
                                            {conv.unreadCount > 0 ? conv.unreadCount : conv.patientName.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className={`text-sm font-black truncate ${conv.unreadCount > 0 ? 'text-slate-900' : 'text-slate-600'}`}>
                                                    {conv.patientName}
                                                </p>
                                                <span className="text-[10px] text-slate-400 font-bold ml-2 flex-shrink-0">
                                                    {new Date(conv.lastMessage.createdAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            {conv.roomNumber && (
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hab. {conv.roomNumber}</p>
                                            )}
                                            <p className="text-xs text-slate-500 mt-0.5 truncate font-medium">
                                                {conv.lastMessage.senderType === 'STAFF' ? '↩ Tú: ' : ''}{conv.lastMessage.content}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Panel de chat */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                            <FaComments className="text-5xl mb-4 opacity-20" />
                            <p className="text-lg font-bold text-slate-500">Selecciona una conversación</p>
                            <p className="text-sm mt-2 text-center max-w-xs">Elige un residente de la lista para ver y responder los mensajes de su familia.</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat header */}
                            <div className="p-4 sm:p-5 border-b border-slate-50 bg-slate-50/80 flex items-center gap-4 flex-shrink-0">
                                <div className="w-10 h-10 rounded-2xl bg-teal-500 text-white flex items-center justify-center font-black text-sm">
                                    {selected.patientName.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-slate-800">{selected.patientName}</h3>
                                    {selected.roomNumber && (
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Habitación {selected.roomNumber}</p>
                                    )}
                                </div>
                            </div>

                            {/* Mensajes */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/30">
                                {selected.messages.map((msg: any, idx: number) => {
                                    const isFamily = msg.senderType === 'FAMILY';
                                    const showDateSeparator = idx === 0 || !isSameDay(selected.messages[idx - 1].createdAt, msg.createdAt);

                                    return (
                                        <div key={msg.id}>
                                            {showDateSeparator && (
                                                <div className="flex items-center gap-3 my-4">
                                                    <div className="flex-1 h-px bg-slate-100"></div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                                                        {formatDateLabel(msg.createdAt)}
                                                    </span>
                                                    <div className="flex-1 h-px bg-slate-100"></div>
                                                </div>
                                            )}
                                            <div className={`flex ${isFamily ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`max-w-[80%] rounded-3xl p-4 shadow-sm ${
                                                    isFamily
                                                        ? 'bg-white border border-slate-100 text-slate-800 rounded-bl-sm'
                                                        : 'bg-teal-500 text-white rounded-br-sm'
                                                }`}>
                                                    {isFamily && (
                                                        <div className="text-[10px] font-black uppercase tracking-wider text-teal-600 mb-2">
                                                            {msg.recipientType === 'NURSING' ? '💊 Para Enfermería' : '🏢 Para Administración'}
                                                        </div>
                                                    )}
                                                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                                    <span className={`text-[10px] font-bold block mt-2 text-right uppercase tracking-wider ${
                                                        isFamily ? 'text-slate-400' : 'text-white/60'
                                                    }`}>
                                                        {new Date(msg.createdAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                                        {isFamily && !msg.isRead && (
                                                            <span className="ml-2 bg-amber-100 text-amber-600 rounded px-1">nuevo</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input reply */}
                            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex-shrink-0">
                                <form onSubmit={handleSend} className="flex gap-3 relative">
                                    <input
                                        type="text"
                                        value={reply}
                                        onChange={(e) => setReply(e.target.value)}
                                        placeholder={`Responder a la familia de ${selected.patientName}…`}
                                        className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-5 pr-14 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50 transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!reply.trim() || sending}
                                        className="absolute right-2 top-2 bottom-2 aspect-square bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-md shadow-teal-200"
                                    >
                                        <FaPaperPlane className="text-sm ml-0.5" />
                                    </button>
                                </form>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
