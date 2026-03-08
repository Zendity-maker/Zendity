"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function ReferralPortalPage() {
    const params = useParams();
    const hqId = params.hqId as string;

    const [hqName, setHqName] = useState("Vivid Cupey HQ"); // Por defecto
    const [hqLogo, setHqLogo] = useState<string | null>(null);

    const [formData, setFormData] = useState({ firstName: "", lastName: "", phone: "", email: "", notes: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        // En una app real, buscaríamos el logo y nombre de la sede en `/api/public/hq/${hqId}`
        // Para este mockup, confiaremos en un nombre default y cargaremos metadata si existe.
    }, [hqId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/corporate/crm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "CREATE",
                    headquartersId: hqId,
                    ...formData,
                    notes: `REFERIDO HOSPITALARIO: ${formData.notes}`
                })
            });

            if (res.ok) {
                setIsSuccess(true);
            } else {
                alert("Ocurrió un error de conexión al enviar el referido.");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
                <div className="bg-white max-w-md w-full p-10 rounded-3xl shadow-xl text-center border border-slate-100">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                        ✓
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Referido Exitoso</h2>
                    <p className="text-slate-500 mb-8">El prospecto ha sido enviado directamente al CRM de Zendity. El equipo de Admisiones de {hqName} se pondrá en contacto a la brevedad.</p>
                    <button
                        onClick={() => { setIsSuccess(false); setFormData({ firstName: "", lastName: "", phone: "", email: "", notes: "" }); }}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold w-full py-3 rounded-2xl transition"
                    >
                        Enviar Otro Referido
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
            {/* Left Panel: Cover & HQ Info */}
            <div className="md:w-1/3 bg-indigo-900 text-white p-12 flex flex-col items-start justify-center relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-800 rounded-full blur-3xl opacity-50 -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-700 rounded-full blur-3xl opacity-50 -ml-20 -mb-20"></div>

                <div className="relative z-10 w-full">
                    {hqLogo ? (
                        <img src={hqLogo} alt="Logo Sede" className="h-16 mb-8 rounded-xl object-contain bg-white/10 p-2" />
                    ) : (
                        <div className="h-16 w-16 mb-8 rounded-2xl bg-indigo-500 flex items-center justify-center text-2xl font-black shadow-lg">Z</div>
                    )}

                    <h1 className="text-4xl font-black tracking-tight mb-4">Portal Médico de Referidos</h1>
                    <p className="text-indigo-200 text-lg leading-relaxed font-light">
                        Estás refiriendo un residente al pipeline de ingresos de <strong className="text-white font-bold">{hqName}</strong>. Completa este formulario seguro para iniciar la transferencia de cuidado (Transitions of Care).
                    </p>

                    <div className="mt-12 p-6 bg-indigo-800/50 rounded-2xl border border-indigo-700 backdrop-blur-md">
                        <p className="font-bold text-sm text-indigo-200 uppercase tracking-widest mb-1">Tecnología Soportada por</p>
                        <p className="font-black text-xl flex items-center gap-2">
                            <span>Zendity CRM</span>
                            <span className="bg-indigo-500 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Secure</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Panel: Form */}
            <div className="md:w-2/3 flex items-center justify-center p-6 md:p-12 h-screen overflow-y-auto">
                <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-slate-100">
                    <h2 className="text-2xl font-black text-slate-800 mb-6">Información del Prospecto</h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre del Residente</label>
                                <input required type="text" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition" placeholder="Ej. Doña María" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Apellidos</label>
                                <input required type="text" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition" placeholder="Pérez" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Teléfono Familiar (Opcional)</label>
                                <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition" placeholder="(787) 555-5555" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Familiar (Opcional)</label>
                                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition" placeholder="familia@correo.com" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas Médicas y Condición de Egreso</label>
                            <textarea
                                required
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition h-32 resize-none"
                                placeholder="Indique la razón clínica por la que el Trabajador Social refiere a este residente a nuestras facilidades. Ej: Alta de hospitalización por fractura de cadera, requiere asistencia diaria..."
                            />
                        </div>

                        <hr className="border-slate-100" />

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black w-full py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all flex justify-center items-center gap-2 text-lg active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                "Enviar Solicitud a Admisiones"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
