"use client";

import { useState, useEffect, useRef } from "react";
import { FaPaperPlane, FaUserNurse } from "react-icons/fa";

export default function FamilyMessages() {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadMessages = () => {
        fetch('/api/family/messages')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setMessages(data.messages);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        loadMessages();
        const interval = setInterval(loadMessages, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const optimisticMsg = {
            id: Date.now().toString(),
            content: newMessage,
            senderType: 'FAMILY',
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage("");

        await fetch('/api/family/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: optimisticMsg.content })
        });
        loadMessages();
    };

    return (
        <div className="flex flex-col h-[65vh] sm:h-[70vh] bg-white rounded-3xl shadow-md shadow-slate-100/50 border border-slate-100/60 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-6 flex items-center gap-4 z-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-200">
                    <FaUserNurse className="text-xl" />
                </div>
                <div>
                    <h2 className="font-bold text-slate-800 text-lg leading-tight">Estación de Enfermería</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Zendity Family Link™</p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
                {loading && messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <FaUserNurse className="text-4xl mb-4 opacity-20" />
                        <p className="text-sm font-medium">Bandeja de mensajes segura.</p>
                        <p className="text-xs mt-1 text-center max-w-xs">Escríbele a la estación de enfermería de su clínica. Te responderán por este mismo medio oficial.</p>
                    </div>
                ) : (
                    messages.map((msg: any) => {
                        const isFamily = msg.senderType === 'FAMILY';
                        return (
                            <div key={msg.id} className={`flex ${isFamily ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                                <div className={`max-w-[85%] sm:max-w-[70%] rounded-3xl p-4 shadow-sm relative ${isFamily
                                        ? 'bg-rose-500 text-white rounded-br-sm'
                                        : 'bg-white border border-slate-100 text-slate-800 rounded-bl-sm'
                                    }`}>
                                    {!isFamily && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] uppercase font-black tracking-wider text-rose-500">Enfermería Zendity</span>
                                        </div>
                                    )}
                                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                    <span className={`text-[10px] font-bold block mt-2 text-right uppercase tracking-wider ${isFamily ? 'text-rose-200' : 'text-slate-400'}`}>
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 sm:p-6 border-t border-slate-100 bg-white">
                <form onSubmit={handleSend} className="flex gap-3 relative">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 sm:py-4 pl-5 pr-14 focus:outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 transition-all text-sm font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="absolute right-2 top-2 bottom-2 aspect-square bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:hover:bg-rose-500 text-white rounded-xl flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-rose-200"
                    >
                        <FaPaperPlane className="text-sm ml-1" />
                    </button>
                </form>
            </div>
        </div>
    );
}
