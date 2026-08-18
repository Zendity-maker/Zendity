"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Landmark, Save, Calendar, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Carga mensual de gastos operativos — Fase 3 del dashboard de socios.
 *
 * Diseño deliberadamente mínimo: ~5 números una vez al mes. No es
 * contabilidad, es el denominador del margen que ven los inversores.
 */

interface ExpenseRow {
    category: string;
    label: string;
    amount: number;
    notes: string | null;
    updatedAt: string | null;
}

const ALLOWED = ['DIRECTOR', 'ADMIN'];

function currentMonth(): string {
    const n = new Date();
    return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Últimos 12 meses hasta el actual, más reciente primero. */
function monthOptions(): { value: string; label: string }[] {
    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const out: { value: string; label: string }[] = [];
    const n = new Date();
    let y = n.getUTCFullYear(), m = n.getUTCMonth();
    for (let i = 0; i < 12; i++) {
        out.push({ value: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MESES[m]} ${y}` });
        m--; if (m < 0) { m = 11; y--; }
    }
    return out;
}

export default function ExpensesPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [month, setMonth] = useState(currentMonth());
    const [rows, setRows] = useState<ExpenseRow[]>([]);
    const [fetching, setFetching] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && (!user || !ALLOWED.includes(user.role as string))) {
            router.push('/unauthorized');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (!user || !ALLOWED.includes(user.role as string)) return;
        setFetching(true);
        setSaved(false);
        fetch(`/api/corporate/expenses?month=${month}`)
            .then(r => r.json())
            .then(d => { if (d.success) setRows(d.expenses); })
            .catch(() => setError('No se pudieron cargar los gastos'))
            .finally(() => setFetching(false));
    }, [month, user]);

    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const setAmount = (category: string, value: string) => {
        setSaved(false);
        const amount = value === '' ? 0 : parseFloat(value);
        setRows(prev => prev.map(r => r.category === category ? { ...r, amount: Number.isFinite(amount) ? amount : 0 } : r));
    };

    const handleSave = async () => {
        setSaving(true); setError(null);
        try {
            const res = await fetch('/api/corporate/expenses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month, expenses: rows.map(r => ({ category: r.category, amount: r.amount, notes: r.notes })) }),
            });
            const data = await res.json();
            if (data.success) { setSaved(true); } else { setError(data.error || 'Error guardando'); }
        } catch {
            setError('Error de red al guardar');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !user) return null;

    return (
        <div className="p-6 lg:p-10 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-[#1F2D3A] tracking-tight flex items-center gap-3">
                    <Landmark className="w-7 h-7 text-teal-600" /> Gastos Operativos
                </h1>
                <p className="text-slate-500 mt-2 text-sm font-medium">
                    Carga mensual para el cálculo de margen. Estos números alimentan la sección de
                    rentabilidad del dashboard de socios — sin ellos, el margen no se puede calcular.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Mes</label>
                    <select
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className="ml-auto px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        {monthOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>

                {fetching ? (
                    <div className="p-12 text-center text-slate-400 font-bold text-sm">Cargando…</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {rows.map(row => (
                            <div key={row.category} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                                <label htmlFor={`exp-${row.category}`} className="flex-1 text-sm font-bold text-slate-700">
                                    {row.label}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                                    <input
                                        id={`exp-${row.category}`}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={row.amount || ''}
                                        onChange={e => setAmount(row.category, e.target.value)}
                                        placeholder="0.00"
                                        className="w-40 pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-right text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                            </div>
                        ))}

                        <div className="px-6 py-5 bg-slate-50 flex items-center justify-between">
                            <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Total del mes</span>
                            <span className="text-2xl font-black text-[#1F2D3A]">
                                ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-4 flex items-center gap-2 text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </div>
            )}

            <div className="mt-6 flex items-center gap-4">
                <button
                    onClick={handleSave}
                    disabled={saving || fetching}
                    className={`bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm px-6 py-3 shadow-md transition-all flex items-center gap-2 ${saving || fetching ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar gastos del mes'}
                </button>
                {saved && (
                    <span className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" /> Guardado — el margen ya refleja estos números
                    </span>
                )}
            </div>

            <p className="mt-6 text-xs text-slate-400 leading-relaxed">
                Dejar una categoría en $0 la excluye del mes. Un mes sin ningún gasto cargado se
                reporta a los socios como &ldquo;sin datos&rdquo;, nunca como 100% de margen.
            </p>
        </div>
    );
}
