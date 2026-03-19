"use client";

import { useState } from "react";
import Link from 'next/link';

export default function HRCommsPage() {
    const [subject, setSubject] = useState("");
    const [htmlBody, setHtmlBody] = useState("");
    const [selectedRoles, setSelectedRoles] = useState<string[]>(['ALL']);
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const ALL_ROLES = [
        { id: "ALL", label: "Toda la Plantilla (Todos los Empleados)", icon: "🌍" },
        { id: "NURSE", label: "Solo Enfermeras (LPN/RN)", icon: "🩺" },
        { id: "CAREGIVER", label: "Solo Cuidadoras", icon: "👩‍⚕️" },
        { id: "KITCHEN", label: "Solo Cocina y Dietas", icon: "🍳" },
        { id: "MAINTENANCE", label: "Solo Mantenimiento", icon: "🔧" }
    ];

    const handleRoleToggle = (roleId: string) => {
        if (roleId === 'ALL') {
            setSelectedRoles(['ALL']);
            return;
        }

        let newRoles = selectedRoles.filter(r => r !== 'ALL');
        if (newRoles.includes(roleId)) {
            newRoles = newRoles.filter(r => r !== roleId);
        } else {
            newRoles.push(roleId);
        }

        if (newRoles.length === 0) newRoles = ['ALL'];
        setSelectedRoles(newRoles);
    };

    const handleSendBroadcast = async () => {
        if (!subject.trim() || !htmlBody.trim()) {
            setErrorMsg("Asunto y Mensaje son requeridos.");
            return;
        }

        setSubmitting(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            const res = await fetch("/api/corporate/hr/comms/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject, html: htmlBody, targetRoles: selectedRoles })
            });

            const data = await res.json();
            if (data.success) {
                setSuccessMsg(`✅ ¡Éxito! El Comunicado Oficial fue enviado a ${data.count} empleados de forma segura.`);
                setSubject("");
                setHtmlBody("");
                setSelectedRoles(['ALL']);
            } else {
                setErrorMsg(data.error || "Fallo en el servidor al enviar correos.");
            }
        } catch (error) {
            console.error(error);
            setErrorMsg("Error de conexión. Intente de nuevo.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none scale-150 transform translate-x-10 -translate-y-10">
                    <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                </div>
                
                <Link href="/corporate/hr" className="inline-flex items-center text-teal-400 hover:text-teal-300 font-bold mb-6 transition-colors text-sm">
                    ← Volver al Directorio HR
                </Link>
                
                <h1 className="text-4xl font-black tracking-tight mb-2">Comunicaciones RRHH</h1>
                <p className="text-slate-400 text-lg font-medium max-w-2xl">
                    Despacha comunicados oficiales (Memorándums) a toda la plantilla de empleados institucionales o hacia roles específicos con un solo botón.
                </p>
            </div>

            {errorMsg && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl shadow-sm animate-in fade-in">
                    <p className="text-rose-800 font-bold flex items-center gap-2">⚠️ {errorMsg}</p>
                </div>
            )}
            {successMsg && (
                <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-xl shadow-sm animate-in fade-in">
                    <p className="text-emerald-800 font-bold flex items-center gap-2">{successMsg}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Left Panel: Filter & Setup */}
                <div className="md:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                            <span>🎯</span> Destinatarios
                        </h2>
                        <div className="space-y-3">
                            {ALL_ROLES.map(role => (
                                <button 
                                    key={role.id}
                                    onClick={() => handleRoleToggle(role.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left font-bold transition-all ${
                                        selectedRoles.includes(role.id) 
                                        ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-sm' 
                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                                    }`}
                                >
                                    <span className="text-xl">{role.icon}</span>
                                    {role.label}
                                    {selectedRoles.includes(role.id) && <span className="ml-auto text-teal-600">✓</span>}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-4 font-medium">Zendity ocultará automáticamente las direcciones a través del sistema blindado BCC.</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                         <h2 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                            <span>🛡️</span> White-Label Security
                        </h2>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Los comunicados serán procesados integrando automáticamente el escudo oficial y nombre de facturación de esta sede para validación visual de los empleados.
                        </p>
                    </div>
                </div>

                {/* Right Panel: Composition Body */}
                <div className="md:col-span-8">
                    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
                        <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                            <span>✍️</span> Redactar Memorándum Oficial
                        </h2>
                        
                        <div className="space-y-6 flex-1 flex flex-col">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Asunto del Comunicado (Subject)</label>
                                <input 
                                    type="text" 
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    placeholder="Ej: Nuevos turnos de vacaciones, Importante: Uso de uniformes, etc."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none font-bold text-slate-800"
                                />
                            </div>

                            <div className="flex-1 flex flex-col">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Cuerpo del Mensaje</label>
                                <textarea 
                                    value={htmlBody}
                                    onChange={e => setHtmlBody(e.target.value)}
                                    placeholder="Escribe el comunicado aquí. Zendity inyectará la firma y diseño estético en torno a este texto de manera automática..."
                                    className="w-full h-64 p-4 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none resize-none font-medium text-slate-700"
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                            <button 
                                onClick={handleSendBroadcast}
                                disabled={submitting}
                                className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-3 text-lg"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Procesando Despacho...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🚀</span>
                                        <span>Despachar Broadcast Oficial</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
