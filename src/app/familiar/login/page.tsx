"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function FamilyLoginPage() {
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
                email,
                pinCode,
                redirect: false,
            });

            if (res?.error) {
                setError(res.error);
                setLoading(false);
            } else {
                router.push("/familiar/dashboard");
                router.refresh();
            }
        } catch (err) {
            setError("Ocurrió un error inesperado al conectar.");
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen bg-[#FFF9F2] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Elementos Decorativos Cálidos */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-orange-100 opacity-50 blur-3xl mix-blend-multiply"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-rose-100 opacity-50 blur-3xl mix-blend-multiply"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="flex justify-center mb-6">
                    <div className="h-20 w-20 bg-gradient-to-br from-orange-400 to-rose-400 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-500/30 transform rotate-3 hover:rotate-6 transition-transform">
                        <span className="text-4xl text-white">❤️</span>
                    </div>
                </div>
                <h2 className="mt-2 text-center text-4xl font-extrabold text-slate-800 tracking-tight">
                    Portal Familiar
                </h2>
                <p className="mt-3 text-center text-lg text-slate-500 font-medium">
                    Conectando con quienes más amas.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="bg-white py-10 px-6 shadow-2xl rounded-[2rem] border border-orange-50 sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-bold text-slate-700">
                                Correo Registrado
                            </label>
                            <div className="mt-2">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-4 py-4 border border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900 font-medium sm:text-lg transition-all"
                                    placeholder="ejemplo@correo.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="pinCode" className="block text-sm font-bold text-slate-700">
                                Passcode Numérico (PIN Generado por el Hogar)
                            </label>
                            <div className="mt-2">
                                <input
                                    id="pinCode"
                                    name="pinCode"
                                    type="password"
                                    required
                                    value={pinCode}
                                    onChange={(e) => setPinCode(e.target.value)}
                                    className="appearance-none block w-full px-4 py-4 border border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900 font-bold tracking-[0.2em] sm:text-xl text-center transition-all bg-slate-50"
                                    placeholder="••••••"
                                    maxLength={6}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl bg-red-50 p-4 border border-red-100 animate-in fade-in zoom-in-95">
                                <div className="flex items-center">
                                    <span className="text-red-500 mr-2">⚠️</span>
                                    <h3 className="text-sm font-semibold text-red-800">{error}</h3>
                                </div>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-lg text-lg font-bold text-white transition-all transform active:scale-95 ${loading ? 'bg-orange-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 shadow-orange-500/30 hover:shadow-orange-500/50'}`}
                            >
                                {loading ? 'Conectando...' : 'Ver a mi familiar'}
                            </button>
                        </div>
                    </form>


                </div>
                {/* Branding footer */}
                <p className="mt-8 text-center text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    POWERED BY ZENDITY B2C ENGINE
                </p>
            </div>
        </div>
    );
}
