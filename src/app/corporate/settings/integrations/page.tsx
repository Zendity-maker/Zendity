"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function SettingsIntegrationsPage() {
    const { user } = useAuth();
    const activeHqId = user?.headquartersId || user?.hqId;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Integrations State
    const [vapiKey, setVapiKey] = useState('');
    const [twilioKey, setTwilioKey] = useState('');
    const [sendgridKey, setSendgridKey] = useState('');
    const [docusignKey, setDocusignKey] = useState('');

    // White Label State
    const [phone, setPhone] = useState('');
    const [logoUrl, setLogoUrl] = useState('');

    useEffect(() => {
        if (!activeHqId) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/corporate/settings/integrations?headquartersId=${activeHqId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.integrations) {
                        setVapiKey(data.integrations.vapiApiKey || '');
                        setTwilioKey(data.integrations.twilioApiKey || '');
                        setSendgridKey(data.integrations.sendgridApiKey || '');
                        setDocusignKey(data.integrations.docusignApiKey || '');
                    }
                    if (data.whiteLabel) {
                        setPhone(data.whiteLabel.phone || '');
                        setLogoUrl(data.whiteLabel.logoUrl || '');
                    }
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [activeHqId]);

    const handleSave = async () => {
        if (!activeHqId) return;
        setIsSaving(true);
        try {
            const payload = {
                headquartersId: activeHqId,
                integrations: {
                    vapiApiKey: vapiKey,
                    twilioApiKey: twilioKey,
                    sendgridApiKey: sendgridKey,
                    docusignApiKey: docusignKey
                },
                whiteLabel: {
                    phone,
                    logoUrl
                }
            };

            const res = await fetch(`/api/corporate/settings/integrations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Configuraciones guardadas exitosamente.");
            } else {
                alert("Hubo un error al guardar la configuración.");
            }
        } catch (error) {
            console.error("Save error:", error);
            alert("Fallo de red al intentar guardar.");
        } finally {
            setIsSaving(false);
        }
    };

    if (user?.role !== 'ADMIN') {
        return <div className="p-8 text-center text-rose-500 font-bold">Acceso Denegado. Solo Administradores pueden ajustar credenciales API.</div>;
    }

    if (isLoading) {
        return <div className="p-10 text-center animate-pulse text-slate-500">Cargando Bóveda de Integraciones...</div>;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Zendity Integrations & CRM Settings</h1>
                <p className="text-slate-500 mt-2">Configura tu Identidad Visual (White-Label) y deposita tus API Keys maestras para activar tu Recepcionista Inteligente de Voz.</p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
                    <span className="text-2xl"></span> Perfil de Sede (White-Label)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Teléfono Público (Para SMS / Voz)</label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="+1 (787) 555-0000"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">URL del Logo (Opcional)</label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="https://misitio.com/logo.png"
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
                    <span className="text-2xl"></span> API Keys de Automatización
                </h2>
                <div className="space-y-5">

                    {/* VAPI */}
                    <div className="flex gap-4 items-start border-b border-slate-100 pb-5">
                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center font-black text-indigo-600 shrink-0">V</div>
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-800 mb-1">Vapi / Bland AI (Telefonía Inteligente)</label>
                            <p className="text-xs text-slate-500 mb-3">Motor neuronal para recibir y emitir llamadas a los prospectos del CRM.</p>
                            <input
                                type="password"
                                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                placeholder="sk_vapi_..."
                                value={vapiKey}
                                onChange={(e) => setVapiKey(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* TWILIO */}
                    <div className="flex gap-4 items-start border-b border-slate-100 pb-5">
                        <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center font-black text-rose-600 shrink-0">T</div>
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-800 mb-1">Twilio (SMS & WhatsApp)</label>
                            <p className="text-xs text-slate-500 mb-3">Automatiza notificaciones tras cada llamada agendada.</p>
                            <input
                                type="password"
                                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                placeholder="AC_twilio_..."
                                value={twilioKey}
                                onChange={(e) => setTwilioKey(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* DOCUSIGN */}
                    <div className="flex gap-4 items-start border-b border-slate-100 pb-5">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center font-black text-blue-600 shrink-0">D</div>
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-800 mb-1">DocuSign (Firmas Legales de Ingreso)</label>
                            <p className="text-xs text-slate-500 mb-3">Requerimiento obligatorio para mover a un Prospecto de "Contrato" a "Residente Parcial".</p>
                            <input
                                type="password"
                                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                placeholder="eyJhbGciOi..."
                                value={docusignKey}
                                onChange={(e) => setDocusignKey(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* SENDGRID */}
                    <div className="flex gap-4 items-start">
                        <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center font-black text-sky-600 shrink-0">S</div>
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-800 mb-1">SendGrid (Email Marketing)</label>
                            <p className="text-xs text-slate-500 mb-3">Envío de catálogos B2C y seguimiento tras Tours Guiados.</p>
                            <input
                                type="password"
                                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                placeholder="SG.sendgrid_..."
                                value={sendgridKey}
                                onChange={(e) => setSendgridKey(e.target.value)}
                            />
                        </div>
                    </div>

                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    {isSaving ? "Cifrando y Guardando..." : "Guardar Integraciones en Vault"}
                </button>
            </div>
        </div>
    );
}
