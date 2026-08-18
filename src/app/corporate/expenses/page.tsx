"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useActiveHq } from "@/contexts/ActiveHqContext";
import { useRouter } from "next/navigation";
import { Landmark, Save, Calendar, CheckCircle2, AlertTriangle, TrendingUp, Building2 } from "lucide-react";

/**
 * Cierre Mensual — gastos operativos + embudo comercial.
 *
 * Los dos datos que el sistema NO puede capturar solo y que el dashboard de
 * socios necesita: costos (no hay nómina ni cuentas por pagar) y flujo
 * comercial (el CRM individual no se está usando). Van juntos en una sola
 * página a propósito: es UNA visita al mes, no dos lugares que recordar.
 *
 * Multi-sede: respeta el selector de sede activa. Con Mayagüez, el Director
 * elige la sede arriba y carga sus números sin confundirlos con Cupey.
 */

interface ExpenseRow { category: string; label: string; amount: number; notes: string | null; }
interface GrowthState { prospects: number; tours: number; evaluations: number; contracts: number; admissions: number; }

const ALLOWED = ['DIRECTOR', 'ADMIN'];

const GROWTH_FIELDS: { key: keyof GrowthState; label: string; hint: string }[] = [
    { key: 'prospects', label: 'Prospectos', hint: 'Contactos nuevos del mes' },
    { key: 'tours', label: 'Tours', hint: 'Visitas a la facilidad' },
    { key: 'evaluations', label: 'Evaluaciones', hint: 'Evaluación clínica o financiera' },
    { key: 'contracts', label: 'Contratos', hint: 'Contratos firmados' },
    { key: 'admissions', label: 'Admisiones', hint: 'Ingresos efectivos' },
];

const EMPTY_GROWTH: GrowthState = { prospects: 0, tours: 0, evaluations: 0, contracts: 0, admissions: 0 };

function currentMonth(): string {
    const n = new Date();
    return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
}

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

export default function MonthlyClosePage() {
    const { user, loading } = useAuth();
    const { activeHqId, activeHqName, isMultiHqRole } = useActiveHq();
    const router = useRouter();

    const [tab, setTab] = useState<'GASTOS' | 'CRECIMIENTO'>('GASTOS');
    const [month, setMonth] = useState(currentMonth());
    const [rows, setRows] = useState<ExpenseRow[]>([]);
    const [growth, setGrowth] = useState<GrowthState>(EMPTY_GROWTH);
    const [fetching, setFetching] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 'ALL' no es una sede concreta: no se puede cargar contra ella.
    const hqParam = activeHqId && activeHqId !== 'ALL' ? activeHqId : null;

    useEffect(() => {
        if (!loading && (!user || !ALLOWED.includes(user.role as string))) {
            router.push('/unauthorized');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (!user || !ALLOWED.includes(user.role as string)) return;
        setFetching(true);
        setSaved(false);
        setError(null);
        const q = `month=${month}${hqParam ? `&hqId=${hqParam}` : ''}`;
        Promise.all([
            fetch(`/api/corporate/expenses?${q}`).then(r => r.json()),
            fetch(`/api/corporate/growth?${q}`).then(r => r.json()),
        ])
            .then(([exp, gro]) => {
                if (exp.success) setRows(exp.expenses);
                if (gro.success) setGrowth({
                    prospects: gro.snapshot.prospects, tours: gro.snapshot.tours,
                    evaluations: gro.snapshot.evaluations, contracts: gro.snapshot.contracts,
                    admissions: gro.snapshot.admissions,
                });
            })
            .catch(() => setError('No se pudieron cargar los datos del mes'))
            .finally(() => setFetching(false));
    }, [month, user, hqParam]);

    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const handleSave = async () => {
        setSaving(true); setError(null);
        try {
            const endpoint = tab === 'GASTOS' ? '/api/corporate/expenses' : '/api/corporate/growth';
            const body = tab === 'GASTOS'
                ? { month, hqId: hqParam, expenses: rows.map(r => ({ category: r.category, amount: r.amount })) }
                : { month, hqId: hqParam, ...growth };
            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) setSaved(true); else setError(data.error || 'Error guardando');
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
                    <Landmark className="w-7 h-7 text-teal-600" /> Cierre Mensual
                </h1>
                <p className="text-slate-500 mt-2 text-sm font-medium leading-relaxed">
                    Los dos datos que el sistema no puede capturar solo: costos operativos y flujo
                    comercial. Alimentan las secciones de rentabilidad y crecimiento del dashboard de socios.
                </p>
                {isMultiHqRole && (
                    <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg">
                        <Building2 className="w-3.5 h-3.5" />
                        Cargando para: <span className="text-teal-700">{activeHqName}</span>
                    </div>
                )}
            </div>

            {!hqParam && isMultiHqRole ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-amber-900">Selecciona una sede específica</p>
                        <p className="text-amber-800 text-sm mt-1">
                            Estos datos se cargan por sede. Cambia el selector de arriba
                            (&ldquo;Sede Activa&rdquo;) de <strong>Todas las sedes</strong> a la sede
                            cuyos números vas a cargar.
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Tabs */}
                    <div className="flex gap-2 mb-4">
                        {([
                            { id: 'GASTOS', label: 'Gastos Operativos', icon: Landmark },
                            { id: 'CRECIMIENTO', label: 'Embudo Comercial', icon: TrendingUp },
                        ] as const).map(t => (
                            <button
                                key={t.id}
                                onClick={() => { setTab(t.id); setSaved(false); }}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-300'}`}
                            >
                                <t.icon className="w-4 h-4" /> {t.label}
                            </button>
                        ))}
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
                        ) : tab === 'GASTOS' ? (
                            <div className="divide-y divide-slate-100">
                                {rows.map(row => (
                                    <div key={row.category} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                                        <label htmlFor={`exp-${row.category}`} className="flex-1 text-sm font-bold text-slate-700">{row.label}</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                                            <input
                                                id={`exp-${row.category}`}
                                                type="number" min="0" step="0.01"
                                                value={row.amount || ''}
                                                onChange={e => {
                                                    setSaved(false);
                                                    const v = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                    setRows(prev => prev.map(r => r.category === row.category ? { ...r, amount: Number.isFinite(v) ? v : 0 } : r));
                                                }}
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
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {GROWTH_FIELDS.map(f => (
                                    <div key={f.key} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                                        <label htmlFor={`gr-${f.key}`} className="flex-1">
                                            <span className="text-sm font-bold text-slate-700 block">{f.label}</span>
                                            <span className="text-xs text-slate-400">{f.hint}</span>
                                        </label>
                                        <input
                                            id={`gr-${f.key}`}
                                            type="number" min="0" step="1"
                                            value={growth[f.key] || ''}
                                            onChange={e => {
                                                setSaved(false);
                                                const v = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                                setGrowth(prev => ({ ...prev, [f.key]: Number.isFinite(v) ? v : 0 }));
                                            }}
                                            placeholder="0"
                                            className="w-28 px-3 py-2 bg-white border border-slate-200 rounded-lg text-right text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        />
                                    </div>
                                ))}
                                <div className="px-6 py-5 bg-slate-50 flex items-center justify-between">
                                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Conversión</span>
                                    <span className="text-2xl font-black text-[#1F2D3A]">
                                        {growth.prospects > 0
                                            ? `${Math.round((growth.admissions / growth.prospects) * 100)}%`
                                            : '—'}
                                        <span className="text-sm font-bold text-slate-400 ml-2">
                                            {growth.admissions} de {growth.prospects} prospectos
                                        </span>
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

                    <div className="mt-6 flex items-center gap-4 flex-wrap">
                        <button
                            onClick={handleSave}
                            disabled={saving || fetching}
                            className={`bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm px-6 py-3 shadow-md transition-all flex items-center gap-2 ${saving || fetching ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando…' : `Guardar ${tab === 'GASTOS' ? 'gastos' : 'embudo'} del mes`}
                        </button>
                        {saved && (
                            <span className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                                <CheckCircle2 className="w-4 h-4" /> Guardado — el dashboard de socios ya lo refleja
                            </span>
                        )}
                    </div>

                    <p className="mt-6 text-xs text-slate-400 leading-relaxed">
                        Cada pestaña se guarda por separado. Un mes sin datos se reporta a los socios
                        como &ldquo;sin cargar&rdquo;, nunca como cero real — para no mostrar una caída
                        comercial o un margen del 100% que en realidad es un olvido.
                    </p>
                </>
            )}
        </div>
    );
}
