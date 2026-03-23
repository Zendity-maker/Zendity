"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BuildingOfficeIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface CreateSedeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreateSedeModal({ isOpen, onClose }: CreateSedeModalProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        capacity: '50',
        licenseExpiry: '',
        ownerName: '',
        ownerEmail: '',
        ownerPhone: '',
        subscriptionPlan: 'PRO'
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/zendity-admin/sedes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create Sede');
            }

            // Success
            onClose();
            router.refresh(); // Refresh the God-mode dashboard
        } catch (error) {
            console.error("Error creating sede:", error);
            alert("Hubo un error al crear la sede. Verifica los permisos de fundador.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 text-slate-300">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                            <BuildingOfficeIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Onboarding de Nueva Sede</h2>
                            <p className="text-xs text-slate-500">Zendity B2B Control Panel</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 1. Datos de la Facilidad */}
                        <div className="space-y-4 md:col-span-2">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 border-b border-slate-800 pb-2">Información del Hogar</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre Oficial (Facilidad)</label>
                                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Ej. Vivid Senior Living Cupey" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">Capacidad Máxima (Camas)</label>
                                    <input required type="number" min="1" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors" />
                                </div>
                            </div>
                        </div>

                        {/* 2. Licencia y Dueño */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 border-b border-slate-800 pb-2">Cliente / Dueño B2B</h3>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre del Titular</label>
                                <input type="text" value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Nombre completo" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Email (Zendity Admin)</label>
                                <input type="email" value={formData.ownerEmail} onChange={e => setFormData({...formData, ownerEmail: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="oficina@hogar.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Teléfono Facturación</label>
                                <input type="tel" value={formData.ownerPhone} onChange={e => setFormData({...formData, ownerPhone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors" />
                            </div>
                        </div>

                        {/* 3. Suscripción y Compliance */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 border-b border-slate-800 pb-2">Facturación SaaS</h3>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Nivel de Licencia Zendity</label>
                                <select value={formData.subscriptionPlan} onChange={e => setFormData({...formData, subscriptionPlan: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none">
                                    <option value="LITE">LITE ($299/mes) - Solo eMAR Core</option>
                                    <option value="PRO">PRO ($599/mes) - Operations & Academy</option>
                                    <option value="ENTERPRISE">ENTERPRISE ($999/mes) - CRM + Voz + Family App</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Vencimiento Licencia Dept. Familia</label>
                                <input required type="date" value={formData.licenseExpiry} onChange={e => setFormData({...formData, licenseExpiry: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors [color-scheme:dark]" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-800 flex items-center justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                            {loading ? 'Inicializando Servidores...' : 'Lanzar Nueva Sede'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
