"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [pinCode, setPinCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

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

    // Funciones de Demo Inmediata (Llenado Rápido)
    const fillDemo = (tipo: 'admin' | 'enfermera' | 'cuidador' | 'familiar' | 'terapista' | 'estilista') => {
        if (tipo === 'admin') { setEmail("admin@vividcupey.com"); setPinCode("1234"); }
        if (tipo === 'enfermera') { setEmail("enfermera@vividcupey.com"); setPinCode("1111"); }
        if (tipo === 'cuidador') { setEmail("cuidador@vividcupey.com"); setPinCode("2222"); }
        if (tipo === 'familiar') { setEmail("hija@vividcupey.com"); setPinCode("889900"); }
        if (tipo === 'terapista') { setEmail("terapista@vividcupey.com"); setPinCode("3333"); }
        if (tipo === 'estilista') { setEmail("belleza@vividcupey.com"); setPinCode("4444"); }
    }

    return (
        <div className="w-full flex items-center justify-center min-h-screen bg-gradient-to-br from-teal-900 via-slate-900 to-black p-4 fixed inset-0 z-50">
            {/* Decorative Blur */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="relative w-full max-w-lg bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-10 shadow-2xl">

                {/* Logo */}
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-black text-3xl shadow-[0_0_30px_rgba(20,184,166,0.5)] mb-6">
                    Z
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Acceso a Zendity</h1>
                    <p className="text-teal-100/70 text-sm">Clúster: Vivid Senior Living Cupey</p>
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

                {/* Accesos Rápidos para DEMO */}
                <div className="mt-8 pt-6 border-t border-white/10">
                    <p className="text-xs text-white/30 font-bold uppercase tracking-widest mb-3 text-center">Auto-relleno Demo</p>
                    <div className="pt-6 border-t border-white/10 mt-6 grid grid-cols-2 lg:grid-cols-3 gap-2">
                        <button type="button" onClick={() => fillDemo('admin')} className="text-xs font-bold py-2 bg-white/5 hover:bg-white/10 text-teal-300 rounded-lg transition-colors border border-white/5">
                            Auto-Fill Admin
                        </button>
                        <button type="button" onClick={() => fillDemo('enfermera')} className="text-xs font-bold py-2 bg-white/5 hover:bg-white/10 text-teal-300 rounded-lg transition-colors border border-white/5">
                            Auto-Fill Enfermera
                        </button>
                        <button type="button" onClick={() => fillDemo('cuidador')} className="text-xs font-bold py-2 bg-white/5 hover:bg-white/10 text-teal-300 rounded-lg transition-colors border border-white/5">
                            Auto-Fill Cuidador
                        </button>
                        <button type="button" onClick={() => fillDemo('familiar')} className="text-xs font-bold py-2 bg-white/5 hover:bg-white/10 text-pink-300 rounded-lg transition-colors border border-white/5">
                            Auto-Fill Familiar
                        </button>
                        <button type="button" onClick={() => fillDemo('terapista')} className="text-xs font-bold py-2 bg-white/5 hover:bg-white/10 text-indigo-300 rounded-lg transition-colors border border-white/5">
                            Auto-Fill Terapista
                        </button>
                        <button type="button" onClick={() => fillDemo('estilista')} className="text-xs font-bold py-2 bg-white/5 hover:bg-white/10 text-fuchsia-300 rounded-lg transition-colors border border-white/5">
                            Auto-Fill Estilista
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
