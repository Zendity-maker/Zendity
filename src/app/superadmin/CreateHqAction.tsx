"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateHqAction() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [hqName, setHqName] = useState("");
    const [directorName, setDirectorName] = useState("");
    const [directorEmail, setDirectorEmail] = useState("");
    const [ownerPhone, setOwnerPhone] = useState("");
    const [taxId, setTaxId] = useState("");
    const [billingAddress, setBillingAddress] = useState("");
    const [directorPinCode, setDirectorPinCode] = useState("");
    const [licenseMonths, setLicenseMonths] = useState("12");
    const [saasMonthlyFee, setSaasMonthlyFee] = useState("500");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/superadmin/hq/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hqName,
                    directorName,
                    directorEmail,
                    ownerPhone,
                    taxId,
                    billingAddress,
                    directorPinCode,
                    licenseMonths: parseInt(licenseMonths),
                    saasMonthlyFee: parseFloat(saasMonthlyFee)
                })
            });

            const data = await res.json();
            if (data.success) {
                setIsOpen(false);
                // Reset form
                setHqName(""); setDirectorName(""); setDirectorEmail("");
                setOwnerPhone(""); setTaxId(""); setBillingAddress("");
                setDirectorPinCode(""); setLicenseMonths("12"); setSaasMonthlyFee("500");
                router.refresh();
            } else {
                setError(data.error || "Error al crear el Asilo B2B.");
            }
        } catch (err) {
            setError("Error de conexión al portal Super Admin.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-black rounded-xl shadow-[0_0_15px_rgba(20,184,166,0.3)] transition-all flex items-center gap-2"
            >
                <span className="text-xl leading-none">+</span> Añadir Asilo Nuevo
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm shadow-2xl">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative">
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 bg-slate-800/20">
                            <h2 className="text-2xl font-black text-white">🏭 Onboarding B2B (Nuevo Cliente)</h2>
                            <p className="text-slate-400 text-sm mt-1">
                                Creará la Base de Datos aislada, la Suscripción y el Acceso Director en 3 segundos.
                            </p>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="p-8 pb-10">
                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-bold text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Col 1 */}
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre de Institución</label>
                                            <input
                                                type="text"
                                                required
                                                value={hqName}
                                                onChange={e => setHqName(e.target.value)}
                                                className="w-full bg-slate-950/50 border-2 border-slate-800 focus:border-teal-500 rounded-xl p-3 text-white outline-none"
                                                placeholder="Ej. Hogar Las Violetas"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nombre del Director (Owner)</label>
                                            <input
                                                type="text"
                                                required
                                                value={directorName}
                                                onChange={e => setDirectorName(e.target.value)}
                                                className="w-full bg-slate-950/50 border-2 border-slate-800 focus:border-teal-500 rounded-xl p-3 text-white outline-none"
                                                placeholder="Ej. Juan Pérez"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email del Director</label>
                                            <input
                                                type="email"
                                                required
                                                value={directorEmail}
                                                onChange={e => setDirectorEmail(e.target.value)}
                                                className="w-full bg-slate-950/50 border-2 border-slate-800 focus:border-teal-500 rounded-xl p-3 text-white outline-none"
                                                placeholder="juan@lasvioletas.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Teléfono Institucional</label>
                                            <input
                                                type="tel"
                                                required
                                                value={ownerPhone}
                                                onChange={e => setOwnerPhone(e.target.value)}
                                                className="w-full bg-slate-950/50 border-2 border-slate-800 focus:border-teal-500 rounded-xl p-3 text-white outline-none"
                                                placeholder="(787) 555-0100"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Dirección de Facturación</label>
                                            <textarea
                                                required
                                                value={billingAddress}
                                                onChange={e => setBillingAddress(e.target.value)}
                                                className="w-full bg-slate-950/50 border-2 border-slate-800 focus:border-teal-500 rounded-xl p-3 text-white outline-none h-20 resize-none opacity-80"
                                                placeholder="Calle Principal #123, San Juan, PR 00901"
                                            />
                                        </div>
                                    </div>

                                    {/* Col 2 */}
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tax ID / EIN</label>
                                            <input
                                                type="text"
                                                value={taxId}
                                                onChange={e => setTaxId(e.target.value)}
                                                className="w-full bg-slate-950/50 border-2 border-slate-800 focus:border-teal-500 rounded-xl p-3 text-white outline-none font-mono"
                                                placeholder="XX-XXXXXXX"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">PIN Clínico Raíz</label>
                                            <input
                                                type="text"
                                                required
                                                value={directorPinCode}
                                                onChange={e => setDirectorPinCode(e.target.value)}
                                                className="w-full bg-slate-950/50 border-2 border-slate-800 focus:border-teal-500 rounded-xl p-3 text-white outline-none font-mono tracking-widest text-lg"
                                                placeholder="1234"
                                                maxLength={6}
                                            />
                                        </div>
                                        <div className="p-4 rounded-xl bg-teal-900/10 border border-teal-500/20">
                                            <label className="block text-xs font-bold text-teal-500 uppercase tracking-widest mb-2">Plazo de Licencia (Meses)</label>
                                            <select
                                                value={licenseMonths}
                                                onChange={e => setLicenseMonths(e.target.value)}
                                                className="w-full bg-slate-950/80 border-2 border-teal-900/50 focus:border-teal-500 rounded-xl p-3 text-white outline-none font-bold"
                                            >
                                                <option value="1">1 Mes (Piloto)</option>
                                                <option value="6">6 Meses</option>
                                                <option value="12">12 Meses (Estándar)</option>
                                                <option value="24">24 Meses</option>
                                            </select>
                                        </div>
                                        <div className="p-4 rounded-xl bg-teal-900/10 border border-teal-500/20">
                                            <label className="block text-xs font-bold text-teal-500 uppercase tracking-widest mb-2">Fee Mensual Zendity (SaaS) $</label>
                                            <input
                                                type="number"
                                                required
                                                value={saasMonthlyFee}
                                                onChange={e => setSaasMonthlyFee(e.target.value)}
                                                className="w-full bg-slate-950/80 border-2 border-teal-900/50 focus:border-teal-500 rounded-xl p-3 text-white outline-none font-bold text-lg"
                                                placeholder="500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px w-full bg-slate-800 my-4"></div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-black text-lg rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all flex items-center justify-center gap-3"
                                >
                                    {loading ? 'Inicializando Ecosistema...' : '🚀 Lanzar Nuevo Asilo B2B'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
