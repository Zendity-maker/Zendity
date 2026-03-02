"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FamilyMessage {
    id: string;
    content: string;
    senderType: "FAMILY" | "STAFF";
    createdAt: string;
}

export default function FamilyMessagesPage() {
    const { user } = useAuth();
    const { status } = useSession();
    const router = useRouter();
    const [messages, setMessages] = useState<FamilyMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/familiar/login");
        } else if (status === "authenticated" && user?.role === "FAMILY") {
            fetchMessages();
        } else if (status === "authenticated" && user?.role !== "FAMILY") {
            router.push("/");
        }
    }, [status, user]);

    useEffect(() => {
        // Scroll al fondo cuando llegan mensajes nuevos
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const fetchMessages = async () => {
        try {
            const res = await fetch("/api/family/messages");
            const json = await res.json();
            if (json.success) {
                setMessages(json.messages);
            }
        } catch (e) {
            console.error("Error al cargar mensajes:", e);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            const res = await fetch("/api/family/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newMessage }),
            });
            const json = await res.json();

            if (json.success) {
                setMessages(prev => [...prev, json.message]);
                setNewMessage("");
            }
        } catch (e) {
            console.error("Error al enviar el mensaje:", e);
        } finally {
            setSending(false);
        }
    };

    if (loading || status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FFF9F2]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-[#FFF9F2] flex flex-col font-sans max-w-lg mx-auto shadow-2xl relative">
            {/* Cabecera / Navbar */}
            <div className="bg-white px-4 py-4 shadow-sm flex items-center gap-4 sticky top-0 z-50 rounded-b-3xl">
                <Link href="/familiar/dashboard" className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
                    ←
                </Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center shadow-md">
                        <span className="text-white text-lg">👩‍⚕️</span>
                    </div>
                    <div>
                        <h1 className="text-md font-black text-slate-800 leading-tight">Equipo de Cuidado</h1>
                        <p className="text-[10px] text-teal-600 font-bold uppercase tracking-wider">Vivid Senior Living</p>
                    </div>
                </div>
            </div>

            {/* Area de Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Mensaje Informativo Inicial */}
                <div className="flex justify-center mb-6">
                    <span className="text-xs bg-orange-100 text-orange-800 font-semibold px-4 py-1.5 rounded-full border border-orange-200 text-center shadow-sm">
                        Los mensajes son leídos por la enfermera a cargo del turno. Enviaremos alertas críticas directamente a tu teléfono.
                    </span>
                </div>

                {messages.length === 0 ? (
                    <div className="text-center text-slate-400 font-medium mt-10 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm animate-in fade-in">
                        <p className="text-4xl mb-3">👋</p>
                        <p>Aún no hay mensajes. Envía un saludo o pregunta sobre tu ser querido al equipo de piso.</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isFamily = msg.senderType === "FAMILY";
                        const isStaff = msg.senderType === "STAFF";

                        return (
                            <div key={msg.id} className={`flex ${isFamily ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                                <div className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm relative ${isFamily
                                    ? 'bg-gradient-to-br from-orange-500 to-rose-500 text-white rounded-br-none'
                                    : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none shadow-md shadow-slate-200/50'
                                    }`}>
                                    {isStaff && <div className="text-[10px] font-black uppercase text-teal-600 mb-1 tracking-wider">Centro de Enfermería</div>}
                                    <p className="text-[15px] leading-relaxed font-medium">{msg.content}</p>
                                    <div className={`text-[10px] mt-2 font-semibold text-right ${isFamily ? 'text-orange-100' : 'text-slate-400'}`}>
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Barra de Escritura */}
            <div className="bg-white p-4 pb-6 border-t border-slate-100 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3 text-[15px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all shadow-inner"
                        disabled={sending}
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${!newMessage.trim() || sending
                            ? 'bg-slate-200 text-slate-400'
                            : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30'
                            }`}
                    >
                        {sending ? '...' : <span className="text-xl">↑</span>}
                    </button>
                </form>
            </div>
        </div>
    );
}
