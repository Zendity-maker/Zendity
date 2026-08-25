"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizarCodigo } from '@/lib/certificado';

/**
 * Pantalla pública para verificar un certificado de Zéndity Academy.
 * Sin sesión: es el punto del asunto — quien verifica viene de fuera.
 */
export default function VerificarPage() {
    const [codigo, setCodigo] = useState('');
    const router = useRouter();

    const buscar = (e: React.FormEvent) => {
        e.preventDefault();
        const c = normalizarCodigo(codigo);
        if (c) router.push(`/verificar/${encodeURIComponent(c)}`);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <p className="text-xs font-black tracking-[0.2em] text-teal-700 uppercase mb-2">Zéndity Academy</p>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Verificar certificado</h1>
                    <p className="text-slate-500 mt-3 leading-relaxed">
                        Escribe el código que aparece en el certificado para comprobar
                        que es auténtico.
                    </p>
                </div>

                <form onSubmit={buscar} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                        Código del certificado
                    </label>
                    <input
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                        placeholder="ZEN-2026-K7F3M2"
                        autoFocus
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-lg text-slate-800 tracking-wider text-center uppercase focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                        type="submit"
                        className="w-full mt-4 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl transition-colors"
                    >
                        Verificar
                    </button>
                </form>

                <p className="text-center text-xs text-slate-400 mt-6 leading-relaxed">
                    Solo se puede consultar con el código exacto.<br />
                    No hay búsqueda por nombre.
                </p>
            </div>
        </div>
    );
}
