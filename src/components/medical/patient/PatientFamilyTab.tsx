"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { UserPlus, Mail, Trash2, Send, X, Loader2, UserCircle } from "lucide-react";

interface FamilyMember {
    id: string;
    name: string;
    email: string;
    accessLevel: string;
    isRegistered: boolean;
    inviteExpiry: string | null;
}

interface Toast {
    msg: string;
    type: "ok" | "err";
}

export default function PatientFamilyTab({ patientId }: { patientId: string }) {
    const { user } = useAuth();
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<Toast | null>(null);

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", accessLevel: "Full" });
    const [sending, setSending] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    // Per-row actions
    const [resendingId, setResendingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const canDelete = user && ["DIRECTOR", "ADMIN"].includes((user as any).role);

    useEffect(() => {
        fetchMembers();
    }, [patientId]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/corporate/family?patientId=${patientId}`);
            const data = await res.json();
            if (data.success) setMembers(data.familyMembers);
        } catch (e) {
            console.error("[Family] fetch", e);
        } finally {
            setLoading(false);
        }
    };

    const openModal = () => {
        setForm({ name: "", email: "", accessLevel: "Full" });
        setModalError(null);
        setModalOpen(true);
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalError(null);
        setSending(true);
        try {
            const res = await fetch("/api/corporate/family/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId,
                    name: form.name.trim(),
                    email: form.email.trim().toLowerCase(),
                    accessLevel: form.accessLevel,
                }),
            });
            const data = await res.json();
            if (res.ok && (data.success || data.message)) {
                setToast({ msg: `Invitación enviada a ${form.email.trim()}`, type: "ok" });
                setModalOpen(false);
                fetchMembers();
            } else {
                setModalError(data.error || "Error enviando invitación");
            }
        } catch (err) {
            setModalError("Error de conexión");
        } finally {
            setSending(false);
        }
    };

    const handleResend = async (m: FamilyMember) => {
        setResendingId(m.id);
        try {
            const res = await fetch("/api/corporate/family/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ familyMemberId: m.id }),
            });
            const data = await res.json();
            if (res.ok && (data.success || data.message)) {
                setToast({ msg: `Invitación reenviada a ${m.email}`, type: "ok" });
                fetchMembers();
            } else {
                setToast({ msg: data.error || "Error reenviando", type: "err" });
            }
        } catch {
            setToast({ msg: "Error de conexión", type: "err" });
        } finally {
            setResendingId(null);
        }
    };

    const handleDelete = async (m: FamilyMember) => {
        if (!confirm(`¿Eliminar el acceso de ${m.name}?\nEsta acción no se puede deshacer.`)) return;
        setDeletingId(m.id);
        try {
            const res = await fetch(`/api/corporate/family/${m.id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: `${m.name} eliminado`, type: "ok" });
                setMembers(prev => prev.filter(x => x.id !== m.id));
            } else {
                setToast({ msg: data.error || "Error eliminando", type: "err" });
            }
        } catch {
            setToast({ msg: "Error de conexión", type: "err" });
        } finally {
            setDeletingId(null);
        }
    };

    const accessLabel = (level: string) => level === "Read-Only" ? "Solo lectura" : "Acceso completo";

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b border-slate-100 pb-5">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <UserCircle className="w-6 h-6 text-teal-600" />
                        Portal Familiar
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                        Familiares con acceso al expediente de este residente vía portal web.
                    </p>
                </div>
                <button
                    onClick={openModal}
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors"
                >
                    <UserPlus className="w-4 h-4" /> Invitar familiar
                </button>
            </div>

            {/* Lista */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                </div>
            ) : members.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                        <UserPlus className="w-7 h-7 text-slate-300" />
                    </div>
                    <p className="text-lg font-bold text-slate-600 mb-1">Sin familiares asignados</p>
                    <p className="text-sm text-slate-400 font-medium">
                        Invita a un familiar para darle acceso al portal.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {members.map(m => (
                        <div
                            key={m.id}
                            className={`border rounded-xl p-4 transition-all ${m.isRegistered ? "bg-white border-slate-200" : "bg-amber-50/30 border-amber-200"}`}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                {/* Avatar */}
                                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${m.isRegistered ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"}`}>
                                    {m.name.substring(0, 2).toUpperCase()}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h3 className="font-bold text-slate-800 truncate">{m.name}</h3>
                                        {m.isRegistered ? (
                                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                                                Activo
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                                Invitación pendiente
                                            </span>
                                        )}
                                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                            {accessLabel(m.accessLevel)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                        <Mail className="w-3 h-3" /> {m.email}
                                    </div>
                                </div>

                                {/* Actions */}
                                {!m.isRegistered && (
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleResend(m)}
                                            disabled={resendingId === m.id}
                                            className="flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {resendingId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                            Reenviar
                                        </button>
                                        {canDelete && (
                                            <button
                                                onClick={() => handleDelete(m)}
                                                disabled={deletingId === m.id}
                                                className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {deletingId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                                Eliminar
                                            </button>
                                        )}
                                    </div>
                                )}
                                {m.isRegistered && canDelete && (
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleDelete(m)}
                                            disabled={deletingId === m.id}
                                            className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {deletingId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                            Revocar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800">Invitar familiar</h3>
                                    <p className="text-xs text-slate-500 font-medium">Enlace válido por 7 días</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleInvite} className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                    Nombre del familiar
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="María Pérez"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="maria@email.com"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                    Nivel de acceso
                                </label>
                                <select
                                    value={form.accessLevel}
                                    onChange={e => setForm(f => ({ ...f, accessLevel: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                                >
                                    <option value="Full">Acceso completo</option>
                                    <option value="Read-Only">Solo lectura</option>
                                </select>
                                <p className="text-[11px] text-slate-400 font-medium mt-1.5 leading-relaxed">
                                    {form.accessLevel === "Full"
                                        ? "Puede ver expediente completo, mensajearse con el equipo y registrar visitas."
                                        : "Solo puede ver información del expediente. No puede enviar mensajes."}
                                </p>
                            </div>

                            {modalError && (
                                <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs font-bold text-rose-700">
                                    {modalError}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={sending || !form.name.trim() || !form.email.trim()}
                                    className="flex-1 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    {sending ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                                    ) : (
                                        <>Enviar invitación</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl border font-bold text-sm animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === "ok" ? "bg-emerald-600 text-white border-emerald-700" : "bg-rose-600 text-white border-rose-700"}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
