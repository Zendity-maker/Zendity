'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function DateFilter() {
    const router = useRouter();
    const params = useSearchParams();
    const [from, setFrom] = useState(params.get('from') || '');
    const [to, setTo] = useState(params.get('to') || '');

    const apply = () => {
        const q = new URLSearchParams();
        if (from) q.set('from', from);
        if (to) q.set('to', to);
        router.push(`/reception/visits?${q.toString()}`);
    };

    const clear = () => {
        setFrom('');
        setTo('');
        router.push('/reception/visits');
    };

    return (
        <div className="no-print flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
                <label className="text-slate-400 text-xs">Desde</label>
                <input
                    type="date"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                    className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:border-teal-500 outline-none"
                />
            </div>
            <div className="flex items-center gap-2">
                <label className="text-slate-400 text-xs">Hasta</label>
                <input
                    type="date"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:border-teal-500 outline-none"
                />
            </div>
            <button
                onClick={apply}
                className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition-all"
            >
                Filtrar
            </button>
            {(from || to) && (
                <button
                    onClick={clear}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                >
                    Limpiar
                </button>
            )}
        </div>
    );
}
