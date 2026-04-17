"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { MessageSquare, Megaphone, X, Send, Users as UsersIcon, Loader2 } from "lucide-react";

interface StaffUser {
    id: string;
    name: string;
    role: string;
    image: string | null;
    photoUrl: string | null;
}

interface StaffMessage {
    id: string;
    headquartersId: string;
    senderId: string;
    content: string;
    type: 'DIRECT' | 'BROADCAST';
    recipientId: string | null;
    isRead: boolean;
    createdAt: string;
    sender: StaffUser;
}

const BROADCAST_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days}d`;
};

interface StaffChatProps {
    open: boolean;
    onClose: () => void;
    onUnreadChange?: (count: number) => void;
}

export default function StaffChat({ open, onClose, onUnreadChange }: StaffChatProps) {
    const { user } = useAuth();
    const [tab, setTab] = useState<'DIRECT' | 'BROADCAST'>('DIRECT');
    const [messages, setMessages] = useState<StaffMessage[]>([]);
    const [users, setUsers] = useState<StaffUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [content, setContent] = useState('');
    const [recipientId, setRecipientId] = useState<string>('');
    const [broadcastMode, setBroadcastMode] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const canBroadcast = !!user && BROADCAST_ROLES.includes((user as any).role);

    const fetchMessages = useCallback(async () => {
        try {
            const res = await fetch('/api/care/staff-messages');
            const data = await res.json();
            if (data.success) {
                setMessages(data.messages);
                onUnreadChange?.(data.unreadCount || 0);
            }
        } catch (e) {
            console.error('[StaffChat] fetch messages', e);
        } finally {
            setLoading(false);
        }
    }, [onUnreadChange]);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch('/api/care/staff-messages/users');
            const data = await res.json();
            if (data.success) setUsers(data.users);
        } catch (e) {
            console.error('[StaffChat] fetch users', e);
        }
    }, []);

    // Initial load + polling 15s
    useEffect(() => {
        fetchMessages();
        fetchUsers();
        const iv = setInterval(fetchMessages, 15000);
        return () => clearInterval(iv);
    }, [fetchMessages, fetchUsers]);

    // Mark unread as read when opening the panel + switching tabs
    useEffect(() => {
        if (!open || !user) return;
        const unread = messages.filter(m => {
            if (m.isRead) return false;
            if (m.senderId === (user as any).id) return false;
            if (tab === 'DIRECT') return m.type === 'DIRECT' && m.recipientId === (user as any).id;
            return m.type === 'BROADCAST';
        }).map(m => m.id);
        if (unread.length === 0) return;
        fetch('/api/care/staff-messages', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageIds: unread }),
        }).then(() => {
            setMessages(prev => prev.map(m => unread.includes(m.id) ? { ...m, isRead: true } : m));
            onUnreadChange?.(messages.filter(m => !m.isRead && !unread.includes(m.id) && m.senderId !== (user as any).id).length);
        }).catch(() => { });
    }, [open, tab, messages, user, onUnreadChange]);

    const handleSend = async () => {
        const trimmed = content.trim();
        if (!trimmed) return;
        if (!broadcastMode && !recipientId) {
            alert('Selecciona un destinatario o activa el modo anuncio.');
            return;
        }
        setSending(true);
        try {
            const res = await fetch('/api/care/staff-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: trimmed,
                    recipientId: broadcastMode ? null : recipientId,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setContent('');
                await fetchMessages();
            } else {
                alert('Error: ' + (data.error || 'No se pudo enviar'));
            }
        } catch (e) {
            alert('Error de conexión enviando mensaje');
        } finally {
            setSending(false);
        }
    };

    const directs = messages.filter(m => m.type === 'DIRECT');
    const broadcasts = messages.filter(m => m.type === 'BROADCAST');

    // Agrupar directos por contraparte (sender o recipient cuando es propio)
    const grouped: Record<string, StaffMessage[]> = {};
    const currentUserId = (user as any)?.id;
    for (const m of directs) {
        const otherId = m.senderId === currentUserId ? (m.recipientId || '?') : m.senderId;
        if (!grouped[otherId]) grouped[otherId] = [];
        grouped[otherId].push(m);
    }

    return (
        <>
            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Panel */}
            <aside
                className={`fixed top-0 right-0 bottom-0 w-full sm:w-[380px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
                aria-hidden={!open}
            >
                {/* Header */}
                <div className="bg-slate-900 text-white px-4 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-black text-sm">Chat interno</h2>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Staff ↔ Staff</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 flex-shrink-0">
                    <button
                        onClick={() => setTab('DIRECT')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${tab === 'DIRECT' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <MessageSquare className="w-4 h-4" /> Mensajes
                        {directs.filter(m => !m.isRead && m.recipientId === currentUserId).length > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center">
                                {directs.filter(m => !m.isRead && m.recipientId === currentUserId).length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setTab('BROADCAST')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${tab === 'BROADCAST' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Megaphone className="w-4 h-4" /> Anuncios
                        {broadcasts.filter(m => !m.isRead && m.senderId !== currentUserId).length > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center">
                                {broadcasts.filter(m => !m.isRead && m.senderId !== currentUserId).length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Message List */}
                <div className="flex-1 overflow-y-auto bg-slate-50 px-3 py-3 space-y-2">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                        </div>
                    ) : tab === 'DIRECT' ? (
                        Object.keys(grouped).length === 0 ? (
                            <EmptyState icon={<MessageSquare className="w-10 h-10 text-slate-300" />} text="No tienes mensajes directos." />
                        ) : (
                            Object.entries(grouped).map(([otherId, group]) => {
                                const otherName = group[0].senderId === currentUserId
                                    ? users.find(u => u.id === otherId)?.name || 'Destinatario'
                                    : group[0].sender.name;
                                const otherRole = group[0].senderId === currentUserId
                                    ? users.find(u => u.id === otherId)?.role || ''
                                    : group[0].sender.role;
                                return (
                                    <div key={otherId} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                                            <div className="w-8 h-8 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-black">
                                                {otherName.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{otherName}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{otherRole}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {group.slice().reverse().map(m => (
                                                <div key={m.id} className={`flex ${m.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.senderId === currentUserId ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                                                        <p className="font-medium leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                                                        <p className={`text-[9px] mt-1 font-medium ${m.senderId === currentUserId ? 'text-teal-100' : 'text-slate-400'}`}>
                                                            {timeAgo(m.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )
                    ) : broadcasts.length === 0 ? (
                        <EmptyState icon={<Megaphone className="w-10 h-10 text-slate-300" />} text="No hay anuncios recientes." />
                    ) : (
                        broadcasts.map(m => (
                            <div key={m.id} className="bg-white rounded-xl border border-amber-200 border-l-4 border-l-amber-500 p-3 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-[10px] font-black">
                                        {m.sender.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-800 truncate">{m.sender.name}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">{m.sender.role} · {timeAgo(m.createdAt)}</p>
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Anuncio</span>
                                </div>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                            </div>
                        ))
                    )}
                </div>

                {/* Composer */}
                <div className="border-t border-slate-200 p-3 bg-white flex-shrink-0 space-y-2">
                    {canBroadcast && (
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={broadcastMode}
                                onChange={e => setBroadcastMode(e.target.checked)}
                                className="accent-amber-500 w-4 h-4"
                            />
                            <Megaphone className="w-3.5 h-3.5 text-amber-600" />
                            Enviar como anuncio a toda la sede
                        </label>
                    )}
                    {!broadcastMode && (
                        <select
                            value={recipientId}
                            onChange={e => setRecipientId(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 font-medium text-slate-700 focus:outline-none focus:border-teal-400"
                        >
                            <option value="">Selecciona destinatario...</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
                            ))}
                        </select>
                    )}
                    <div className="flex gap-2 items-end">
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            rows={2}
                            placeholder={broadcastMode ? 'Escribe un anuncio...' : 'Escribe un mensaje...'}
                            className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 resize-none"
                        />
                        <button
                            onClick={handleSend}
                            disabled={sending || !content.trim()}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 shrink-0 ${broadcastMode ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}`}
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            {icon}
            <p className="text-sm font-bold text-slate-400 mt-3">{text}</p>
        </div>
    );
}
