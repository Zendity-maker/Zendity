"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [pinCode, setPinCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Branding States
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [hqName, setHqName] = useState<string>("Zendity Network");

    useEffect(() => {
        // Fetch public branding config before login
        fetch('/api/public/hq/branding')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.hq) {
                    if (data.hq.logoUrl) setLogoUrl(data.hq.logoUrl);
                    if (data.hq.name) setHqName(data.hq.name);
                }
            })
            .catch(err => console.error("Error loading branding:", err));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await signIn("credentials", {
                redirect: false,
                email,
                pinCode,
            });

            if (res?.error) {
                setError(res.error);
                setLoading(false);
            } else {
                router.refresh(); // El AuthContext detectará el login y redirigirá según el Rol
            }
        } catch (error) {
            setError("Error de conexión con el Servidor ZENDITY.");
            setLoading(false);
        }
    };



    return (
        <div className="w-full flex items-center justify-center min-h-screen bg-gradient-to-br from-teal-900 via-slate-900 to-black p-4 fixed inset-0 z-50">
            {/* Decorative Blur */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="relative w-full max-w-lg bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-10 shadow-2xl">

                {/* Logo Dinámico */}
                {logoUrl ? (
                    <div className="mx-auto h-32 flex items-center justify-center mb-8">
                        <img src={logoUrl} alt={hqName} className="max-h-full object-contain filter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
                    </div>
                ) : (
                    <div className="mx-auto h-32 flex items-center justify-center mb-8">
                        <img src="/zendity_logo.png" alt="Zendity" className="max-h-full object-contain filter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
                    </div>
                )}

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">{hqName}</h1>
                    <p className="text-teal-100/70 text-sm">Powered by Zendity OS</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-bold text-sm text-center animate-in fade-in zoom-in-95">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Identificación (Email)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ej. admin@vividcupey.com o hija@vividcupey.com"
                            className="w-full bg-slate-900/50 border-2 border-slate-700/50 text-white rounded-xl p-4 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder:text-slate-600"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">PIN Clínico / Familiar</label>
                        <input
                            type="password"
                            value={pinCode}
                            onChange={(e) => setPinCode(e.target.value)}
                            placeholder="****"
                            className="w-full bg-slate-900/50 border-2 border-slate-700/50 text-white rounded-xl p-4 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder:text-slate-600 tracking-[0.5em] text-center font-black text-xl"
                            maxLength={6}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 mt-4 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-black rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.2)] hover:shadow-[0_0_30px_rgba(20,184,166,0.4)] transition-all active:scale-95"
                    >
                        {loading ? 'Verificando Credenciales...' : 'Iniciar Turno'}
                    </button>
                </form>


            </div>
        </div>
    );
}
