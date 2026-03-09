"use client";

import { useState } from "react";
import { Mail, Send, X, AlertCircle, CheckCircle2 } from "lucide-react";

export default function SendEmailModal({ employees }: { employees: any[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Configuración del correo
    const [sendMode, setSendMode] = useState<'INDIVIDUAL' | 'BROADCAST'>('INDIVIDUAL');
    const [targetEmployeeId, setTargetEmployeeId] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");

    // Status visual
    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!subject || !message) {
            setStatus({ type: 'error', msg: "El asunto y el mensaje son obligatorios." });
            return;
        }

        if (sendMode === 'INDIVIDUAL' && !targetEmployeeId) {
            setStatus({ type: 'error', msg: "Selecciona el colaborador destinatario." });
            return;
        }

        setIsSending(true);
        setStatus(null);

        try {
            const endpoint = sendMode === 'BROADCAST' ? '/api/hr/comms/send-broadcast' : '/api/hr/comms/send';

            const payload = sendMode === 'BROADCAST'
                ? { subject, html: message }
                : { employeeId: targetEmployeeId, subject, html: message };

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                setStatus({ type: 'success', msg: "Comunicación despachada correctamente a través de Zendity HR." });
                setTimeout(() => {
                    setIsOpen(false);
                    setSubject("");
                    setMessage("");
                    setStatus(null);
                }, 2500);
            } else {
                setStatus({ type: 'error', msg: data.error || "Fallo integrando el despacho de correo." });
            }
        } catch (error) {
            setStatus({ type: 'error', msg: "Error conectando con el hub de comunicaciones." });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-indigo-300"
            >
                <Mail className="w-5 h-5" />
                <span className="hidden sm:inline">Despachar Email</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="bg-indigo-600 px-6 py-5 flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                            <div className="relative z-10 flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                                    <Send className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Zendity Corporate Comms</h2>
                                    <p className="text-indigo-200 text-xs">Comunicación Oficial Interna</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-indigo-200 hover:text-white transition-colors relative z-10 p-1 bg-white/5 rounded-full hover:bg-white/20"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="p-6 md:p-8">

                            {status && (
                                <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${status.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                    {status.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
                                    <p className="font-semibold text-sm">{status.msg}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">

                                <div className="bg-slate-50 p-1.5 flex rounded-xl border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setSendMode('INDIVIDUAL')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${sendMode === 'INDIVIDUAL' ? 'bg-white shadow-sm border border-slate-200/60 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Aviso Individual
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSendMode('BROADCAST')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${sendMode === 'BROADCAST' ? 'bg-white shadow-sm border border-slate-200/60 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        <UsersIcon className="w-4 h-4" /> Broadcast General
                                    </button>
                                </div>

                                {sendMode === 'INDIVIDUAL' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Destinatario Clínico / RRHH</label>
                                        <select
                                            value={targetEmployeeId}
                                            onChange={(e) => setTargetEmployeeId(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-800"
                                            required
                                        >
                                            <option value="">-- Seleccionar Colaborador --</option>
                                            {employees.map((emp) => (
                                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.role}) - {emp.email}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Asunto Central (Subject)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Cambio de Políticas o Asignación de Turno"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-900"
                                        required
                                    />
                                </div>

                                <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 flex items-center gap-2">
                                        Cuerpo del Email Corporativo (HTML/Markdown support)
                                    </div>
                                    <textarea
                                        placeholder={`Hola colaborador...\n\nPor este medio Zendity HR informa que...`}
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="w-full px-4 py-3 h-48 bg-white outline-none font-medium text-slate-800 placeholder:text-slate-400 resize-none custom-scrollbar"
                                        required
                                    />
                                </div>

                                <div className="pt-2 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                        Descartar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSending}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all active:scale-95 ${isSending ? 'opacity-70 cursor-wait' : ''}`}
                                    >
                                        {isSending ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Despachando E-Mail...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-5 h-5" /> Enviar Comunicación
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>

                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function UsersIcon(props: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    )
}
