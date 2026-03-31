"use client";

import { useState, useEffect } from "react";
import { Mail, Send, X, AlertCircle, CheckCircle2, Megaphone } from "lucide-react";
import ZendiAssist from "@/components/ZendiAssist";

type FamilyMemberBase = {
    id: string;
    name: string;
    email: string;
};

interface SendFamilyEmailModalProps {
    familyMembers?: FamilyMemberBase[]; // If provided, locks to INDIVIDUAL mode
    defaultMode?: 'INDIVIDUAL' | 'BROADCAST';
    TriggerComponent?: React.ReactNode;
}

export default function SendFamilyEmailModal({ familyMembers, defaultMode = 'BROADCAST', TriggerComponent }: SendFamilyEmailModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isPolishing, setIsPolishing] = useState(false);

    // Determines if it's forced individual or global broadcast
    const [sendMode, setSendMode] = useState<'INDIVIDUAL' | 'BROADCAST'>(defaultMode);

    // Configuración del correo
    const [targetFamilyId, setTargetFamilyId] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");

    // Status visual
    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

    // Initial setup when modal opens
    useEffect(() => {
        if (isOpen) {
            setSendMode(defaultMode);
            setStatus(null);
            if (familyMembers && familyMembers.length === 1) {
                setTargetFamilyId(familyMembers[0].id);
            } else {
                setTargetFamilyId("");
            }
        }
    }, [isOpen, defaultMode, familyMembers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!subject || !message) {
            setStatus({ type: 'error', msg: "El asunto y el mensaje son obligatorios." });
            return;
        }

        if (sendMode === 'INDIVIDUAL' && !targetFamilyId) {
            setStatus({ type: 'error', msg: "Selecciona el familiar destinatario." });
            return;
        }

        setIsSending(true);
        setStatus(null);

        try {
            const endpoint = sendMode === 'BROADCAST'
                ? '/api/corporate/family/comms/send-broadcast'
                : '/api/corporate/family/comms/send';

            const payload = sendMode === 'BROADCAST'
                ? { subject, html: message }
                : { familyMemberId: targetFamilyId, subject, html: message };

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                setStatus({ type: 'success', msg: data.message || "Comunicación B2C despachada correctamente." });
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
            setStatus({ type: 'error', msg: "Error conectando con el hub de comunicaciones familiares." });
        } finally {
            setIsSending(false);
        }
    };

    const handleZendiPolish = async () => {
        if (!message.trim()) {
            setStatus({ type: 'error', msg: "Escribe al menos un borrador para que Zendi AI pueda pulirlo." });
            return;
        }
        setIsPolishing(true);
        setStatus(null);
        
        try {
            const res = await fetch("/api/ai/shadow", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "CORPORATE_COMMS_POLISH", rawText: message })
            });
            const data = await res.json();
            if (data.success && data.formattedText) {
                setMessage(data.formattedText);
                setStatus({ type: 'success', msg: " Zendi AI ha perfeccionado tu comunicado al formato corporativo y empático." });
            } else {
                setStatus({ type: 'error', msg: "El asistente inteligente no pudo procesar este borrador." });
            }
        } catch (e) {
            setStatus({ type: 'error', msg: "Error de red al conectar con Zendi AI." });
        } finally {
            setIsPolishing(false);
        }
    };

    return (
        <>
            {/* Custom Trigger OR Default Button */}
            <>
                {/* Custom Trigger OR Default Button */}
                {TriggerComponent ? (
                    <div onClick={() => setIsOpen(true)} className="cursor-pointer inline-block">
                        {TriggerComponent}
                    </div>
                ) : (
                    <button type="button" onClick={() => setIsOpen(true)} className="flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-teal-300">
                        {defaultMode === 'BROADCAST' ? <Megaphone className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                        <span className="hidden sm:inline">{defaultMode === 'BROADCAST' ? 'Anuncio Global' : 'Contactar Familiar'}</span>
                    </button>
                )}
            </>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
                        {/* Header */}
                        <div className="bg-teal-600 px-6 py-6 flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-400 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none"></div>
                            <div className="relative z-10 flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner border border-white/10">
                                    {sendMode === 'BROADCAST' ? <Megaphone className="w-6 h-6 text-white" /> : <Mail className="w-6 h-6 text-white" />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-wide">
                                        {sendMode === 'BROADCAST' ? 'Comunicado Global Familiar' : 'Mensaje Directo al Familiar'}
                                    </h2>
                                    <p className="text-teal-100 text-xs font-medium uppercase tracking-widest mt-0.5">Zendity B2C Communications</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-teal-100 hover:text-white transition-colors relative z-10 p-2 bg-white/10 rounded-full hover:bg-white/20"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="p-6 md:p-8">

                            {status && (
                                <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${status.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                    {status.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
                                    <p className="font-semibold text-sm">{status.msg}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">

                                {sendMode === 'INDIVIDUAL' && familyMembers && (
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Destinatario Autorizado</label>
                                        <select
                                            value={targetFamilyId}
                                            onChange={(e) => setTargetFamilyId(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-bold text-slate-800"
                                            required
                                        >
                                            <option value="">-- Seleccionar Familiar --</option>
                                            {familyMembers.filter(f => f.email).map((fam) => (
                                                <option key={fam.id} value={fam.id}>{fam.name} ({fam.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Asunto del Correo (Subject)</label>
                                    <input
                                        type="text"
                                        placeholder={sendMode === 'BROADCAST' ? 'Ej: Invitación a evento Día de las Madres' : 'Ej: Actualización Administrativa y Cobros'}
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all font-bold text-slate-900 shadow-sm"
                                        required
                                    />
                                </div>

                                <div className={`border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 transition-all shadow-sm ${isPolishing ? 'border-teal-400 bg-teal-50/30' : 'border-slate-300'}`}>
                                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-between gap-2">
                                        <span>Cuerpo del Mensaje (White-Labeled)</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleZendiPolish}
                                                disabled={isPolishing || message.trim().length === 0}
                                                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white px-2 py-0.5 rounded text-[9px] shadow-sm disabled:opacity-50 transition-all flex items-center gap-1"
                                            >
                                                {isPolishing ? 'Pulimentando...' : ' Zendi Polish'}
                                            </button>
                                            <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-[9px]">Branded Template</span>
                                        </div>
                                    </div>
                                    <ZendiAssist
                                        value={message}
                                        onChange={setMessage}
                                        type="FAMILY_MESSAGE"
                                        context="mensaje corporativo a familiar de residente"
                                        placeholder={sendMode === 'BROADCAST' ? 'Estimadas familias de nuestra comunidad...\n\nLes escribimos para invitarles a...' : 'Estimado familiar del residente...\n\nPor la presente le informamos que...'}
                                        rows={6}
                                    />
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium"> El logo de la Sede y los datos corporativos se adjuntarán automáticamente al envío.</p>

                                <div className="pt-4 flex justify-end gap-3 mt-8 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSending}
                                        className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20 transition-all hover:-translate-y-0.5 active:scale-95 ${isSending ? 'opacity-70 cursor-wait' : ''}`}
                                    >
                                        {isSending ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Despachando...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-5 h-5 -ml-1" /> {sendMode === 'BROADCAST' ? 'Emitir Comunicado Masivo' : 'Enviar Mensaje Directo'}
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
