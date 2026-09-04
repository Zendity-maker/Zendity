"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    Activity, Users, DollarSign, CheckCircle, Clock, HeartPulse,
    TrendingUp, BedDouble, Landmark, Sparkles, UserCheck, ArrowUpRight, ArrowDownRight, Scale, PiggyBank,
} from "lucide-react";

/**
 * Partners & Investor Dashboard (v2 — 17-ago-2026).
 *
 * Estructura tipo "dashboard del Director" pero con contenido para socios:
 * resumen ejecutivo arriba, KPIs hero, y secciones de finanzas (devengado vs
 * caja + serie mensual), crecimiento (pipeline CRM agregado) y calidad.
 *
 * REGLA: aquí no entra PHI. Sin nombres de residentes, sin facturas
 * individuales, sin staff con nombre. Solo agregados.
 */

interface VividKPI {
    hqId: string;
    name: string;
    logoUrl?: string | null;
    isOpen: boolean;
    resumen: string[];
    ocupacion: {
        capacity: number;
        ocupadas: number;
        fisicos: number;
        enHospital: number;
        occupancyRate: number;
        camasLibres: number;
        altasMes: number;
        bajasMes: number;
    };
    finanzas: {
        facturadoMes: number;
        cobradoMes: number;
        tasaCobranza: number | null;
        vencidoTotal: number;
        arpu: number;
        mrr: number;
        potencialMensual: number;
        brechaFacturacion: number;
        serie: { mes: string; facturado: number; cobrado: number }[];
    };
    crecimiento: {
        pipeline: Record<string, number>;
        leadsActivos: number;
        ritmoMensualAdmisiones: number;
        mesesAFullOcupacion: number | null;
        funnel: {
            serie: { mes: string; prospects: number; tours: number; evaluations: number; contracts: number; admissions: number; hasData: boolean; source: 'CRM' | 'MANUAL' | 'NONE' }[];
            mesesDesdeCRM: number;
            mesesManuales: number;
            totales: { prospects: number; tours: number; evaluations: number; contracts: number; admissions: number };
            mesesConDatos: number;
            conversionPct: number | null;
            tourRatePct: number | null;
            admisionesMensualPromedio: number | null;
        };
    };
    calidad: {
        facilityHealthScore: number;
        facilityHealthGrade: 'EXCELENTE' | 'BUENO' | 'ALERTA' | 'CRITICO';
        clinicalComplianceRate: number;
    };
    equipo: {
        staffCount: number;
        clinicalCount: number;
        ratioStaffResidente: number;
    };
    rentabilidad: {
        mesesConDatos: number;
        mesesSinDatos: number;
        ingresos: number;
        gastos: number;
        margen: number;
        margenPct: number | null;
        gastoMensualPromedio: number | null;
        serie: {
            mes: string; ingresos: number; gastos: number; margen: number;
            margenPct: number | null; hasExpenseData: boolean;
            porCategoria: { category: string; label: string; amount: number }[];
        }[];
        breakEven: {
            camasNecesarias: number;
            camasSobreEquilibrio: number;
            ocupacionEquilibrioPct: number;
            alcanzable: boolean;
        } | null;
    };
}

const MESES_ES: Record<string, string> = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

const STAGE_LABELS: Record<string, string> = {
    PROSPECT: 'Prospectos',
    TOUR: 'Tour',
    EVALUATION: 'Evaluación',
    CONTRACT: 'Contrato',
    ADMISSION: 'Admitidos',
};

export default function VividInvestorsDashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [kpis, setKpis] = useState<VividKPI[]>([]);
    const [fetchLoading, setFetchLoading] = useState(true);

    const INVESTOR_ROLES = ['INVESTOR', 'ADMIN', 'DIRECTOR', 'SUPER_ADMIN'];

    useEffect(() => {
        if (!loading) {
            if (!user || !INVESTOR_ROLES.includes(user.role as string)) {
                router.push('/unauthorized');
            } else {
                fetch('/api/corporate/investors/kpis')
                    .then(res => res.json())
                    .then(data => { if (data.success) setKpis(data.targets); })
                    .catch(console.error)
                    .finally(() => setFetchLoading(false));
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, loading, router]);

    if (loading || fetchLoading) {
        return (
            <div className="min-h-screen bg-[#101B33] flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-[#8CBBE8]/20 border-t-amber-500 rounded-full animate-spin"></div>
                <p className="mt-4 text-[#8CBBE8]/55 font-bold tracking-widest uppercase text-sm">Preparando Métricas del Grupo...</p>
            </div>
        );
    }

    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

    return (
        <div className="min-h-screen bg-[#101B33] font-sans selection:bg-[#C5E69A] selection:text-[#1C3170]">
            {/* Header */}
            <div className="bg-[#1C3170]/85 backdrop-blur-xl border-b border-[#C5E69A]/25 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-6 flex flex-col md:flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-white/10 p-1">
                            <img src="/logo-vivid.png" alt="Vivid Senior Living Logo" className="max-h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-serif text-[#FAF6EE] tracking-tight uppercase pb-1">Vivid <span className="text-[#C5E69A] font-light">Senior Living</span></h1>
                            <p className="text-[#8CBBE8]/55 font-medium text-xs tracking-[0.2em] uppercase leading-relaxed">Partners & Investor Dashboard</p>
                        </div>
                    </div>
                    {/* Salida. La pagina es de pantalla completa —no lleva la barra
                        lateral— y sin esto quedaba sin forma de volver, como le pasaba
                        al panel de super admin. */}
                    <a
                        href="/corporate"
                        className="mt-4 md:mt-0 md:order-last text-xs font-bold text-[#FAF6EE]/50 hover:text-[#FAF6EE] transition-colors px-3 py-2"
                    >
                        ← Volver a Zéndity
                    </a>
                    <div className="mt-4 md:mt-0 flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-2 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-[#C5E69A] animate-pulse"></div>
                        <span className="text-[#C5E69A] text-xs font-bold uppercase tracking-widest">Datos en Vivo</span>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-6 lg:px-12 py-12 space-y-12">
                {kpis.map((hq) => {
                    const o = hq.ocupacion, f = hq.finanzas, c = hq.crecimiento, q = hq.calidad, e = hq.equipo, p = hq.rentabilidad;
                    const maxSerie = Math.max(...f.serie.map(s => s.facturado), 1);
                    const gradeColor = q.facilityHealthGrade === 'EXCELENTE' ? 'text-[#C5E69A]' : q.facilityHealthGrade === 'BUENO' ? 'text-teal-400' : q.facilityHealthGrade === 'ALERTA' ? 'text-[#C5E69A]' : 'text-rose-400';
                    const maxPipeline = Math.max(...Object.values(c.pipeline), 1);

                    return (
                        <section key={hq.hqId} className="space-y-8">
                            {/* Título de sede */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-3xl font-light text-[#FAF6EE] tracking-tight">{hq.name}</h2>
                                    {hq.isOpen ? (
                                        <span className="px-3 py-1 bg-[#C5E69A]/10 text-[#C5E69A] border border-[#C5E69A]/40/20 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Operativo
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 bg-[#C5E69A]/10 text-[#C5E69A] border border-[#C5E69A]/40/20 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Pre-Apertura
                                        </span>
                                    )}
                                </div>
                                {hq.logoUrl && (
                                    <img src={hq.logoUrl} alt="Logo" className="max-h-10 object-contain hidden sm:block opacity-70" />
                                )}
                            </div>

                            {/* Resumen ejecutivo */}
                            <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-[#C5E69A]/40/20 rounded-3xl p-8">
                                <h3 className="text-sm font-black text-[#C5E69A] uppercase tracking-widest flex items-center gap-2 mb-4">
                                    <Sparkles className="w-4 h-4" /> Resumen Ejecutivo
                                </h3>
                                <ul className="space-y-2.5">
                                    {hq.resumen.map((r, i) => (
                                        <li key={i} className="text-[#FAF6EE]/80 text-[15px] leading-relaxed flex gap-3">
                                            <span className="text-[#C5E69A] font-black shrink-0">·</span>{r}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* KPIs hero */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { label: 'Ocupación', value: `${o.occupancyRate}%`, sub: `${o.ocupadas}/${o.capacity} camas`, icon: BedDouble, tone: 'text-[#C5E69A]' },
                                    { label: 'Ingreso Recurrente', value: fmt(f.mrr), sub: `ARPU ${fmt(f.arpu)}`, icon: DollarSign, tone: 'text-[#C5E69A]' },
                                    { label: 'Cobranza del Mes', value: f.tasaCobranza !== null ? `${f.tasaCobranza}%` : '—', sub: `${fmt(f.cobradoMes)} cobrado`, icon: Landmark, tone: 'text-teal-400' },
                                    { label: 'Salud Operativa', value: `${q.facilityHealthScore}`, sub: q.facilityHealthGrade, icon: HeartPulse, tone: gradeColor },
                                ].map(kpi => (
                                    <div key={kpi.label} className="bg-[#1C3170]/40/50 border border-[#8CBBE8]/20/50 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 text-[#8CBBE8]/55 mb-3">
                                            <kpi.icon className={`w-4 h-4 ${kpi.tone}`} />
                                            <span className="text-[11px] font-black uppercase tracking-widest">{kpi.label}</span>
                                        </div>
                                        <p className="text-3xl font-black text-[#FAF6EE]">{kpi.value}</p>
                                        <p className={`text-xs font-bold mt-1 ${kpi.tone}`}>{kpi.sub}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                                {/* Finanzas */}
                                <div className="xl:col-span-3 bg-[#1C3170]/40/50 border border-[#8CBBE8]/20/50 rounded-3xl p-8 space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-[#FAF6EE] flex items-center gap-2">
                                            <DollarSign className="w-5 h-5 text-[#C5E69A]" /> Finanzas
                                        </h3>
                                        <span className="text-[10px] text-[#8CBBE8]/55 font-bold uppercase tracking-widest">Devengado vs Caja</span>
                                    </div>

                                    {/* Serie mensual */}
                                    <div className="space-y-4">
                                        {f.serie.map(s => {
                                            const [yy, mm] = s.mes.split('-');
                                            return (
                                                <div key={s.mes} className="space-y-1.5">
                                                    <div className="flex justify-between items-baseline text-xs">
                                                        <span className="font-black text-[#8CBBE8]/70 uppercase tracking-wider">{MESES_ES[mm]} {yy}</span>
                                                        <span className="text-[#8CBBE8]/55">
                                                            <span className="text-[#FAF6EE] font-bold">{fmt(s.facturado)}</span> facturado
                                                            <span className="mx-1.5 text-[#1C3170]">·</span>
                                                            <span className="text-[#C5E69A] font-bold">{fmt(s.cobrado)}</span> cobrado
                                                        </span>
                                                    </div>
                                                    <div className="h-3 w-full bg-[#101B33] rounded-full overflow-hidden relative">
                                                        <div className="absolute inset-y-0 left-0 bg-[#C5E69A]/30 rounded-full" style={{ width: `${(s.facturado / maxSerie) * 100}%` }} />
                                                        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-[#C5E69A] rounded-full" style={{ width: `${(s.cobrado / maxSerie) * 100}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Detalle */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-[#8CBBE8]/20/50">
                                        {[
                                            { label: 'Facturado (mes)', value: fmt(f.facturadoMes), tone: 'text-[#FAF6EE]' },
                                            { label: 'Vencido acum.', value: fmt(f.vencidoTotal), tone: f.vencidoTotal > 0 ? 'text-rose-400' : 'text-[#C5E69A]' },
                                            { label: 'Por facturar', value: fmt(f.brechaFacturacion), tone: f.brechaFacturacion > 0 ? 'text-[#C5E69A]' : 'text-[#C5E69A]' },
                                            { label: 'Potencial 100%', value: fmt(f.potencialMensual), tone: 'text-[#FAF6EE]/80' },
                                        ].map(d => (
                                            <div key={d.label} className="pt-4">
                                                <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">{d.label}</p>
                                                <p className={`text-lg font-black mt-0.5 ${d.tone}`}>{d.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Crecimiento */}
                                <div className="xl:col-span-2 bg-[#1C3170]/40/50 border border-[#8CBBE8]/20/50 rounded-3xl p-8 space-y-6">
                                    <h3 className="text-lg font-bold text-[#FAF6EE] flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-[#C5E69A]" /> Crecimiento
                                    </h3>

                                    <div className="space-y-3">
                                        {Object.entries(c.pipeline).map(([stage, count]) => (
                                            <div key={stage} className="flex items-center gap-3">
                                                <span className="text-[11px] text-[#8CBBE8]/55 font-black uppercase tracking-wider w-24 shrink-0">{STAGE_LABELS[stage] || stage}</span>
                                                <div className="flex-1 h-2.5 bg-[#101B33] rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${stage === 'ADMISSION' ? 'bg-gradient-to-r from-emerald-600 to-[#C5E69A]' : 'bg-gradient-to-r from-amber-600 to-amber-400'}`}
                                                        style={{ width: `${(count / maxPipeline) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-[#FAF6EE] font-black text-sm w-6 text-right">{count}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Embudo comercial del mes — carga manual del Director.
                                        El pipeline de arriba es el ESTADO del CRM hoy;
                                        esto es el FLUJO mensual real del negocio. */}
                                    {c.funnel.mesesConDatos > 0 && (
                                        <div className="pt-4 border-t border-[#8CBBE8]/20/50 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">
                                                    Embudo · {c.funnel.mesesConDatos} mes{c.funnel.mesesConDatos !== 1 ? 'es' : ''}
                                                    {c.funnel.mesesDesdeCRM > 0 && (
                                                        <span className="ml-2 text-teal-400/70 normal-case tracking-normal font-bold">
                                                            {c.funnel.mesesManuales > 0
                                                                ? `${c.funnel.mesesDesdeCRM} desde CRM, ${c.funnel.mesesManuales} manual`
                                                                : 'desde CRM'}
                                                        </span>
                                                    )}
                                                </p>
                                                {c.funnel.conversionPct !== null && (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#C5E69A] bg-[#C5E69A]/10 border border-[#C5E69A]/40/20 px-2.5 py-0.5 rounded-full">
                                                        {c.funnel.conversionPct}% conversión
                                                    </span>
                                                )}
                                            </div>
                                            {(() => {
                                                const t = c.funnel.totales;
                                                const steps = [
                                                    { label: 'Prospectos', v: t.prospects },
                                                    { label: 'Tours', v: t.tours },
                                                    { label: 'Evaluaciones', v: t.evaluations },
                                                    { label: 'Contratos', v: t.contracts },
                                                    { label: 'Admisiones', v: t.admissions },
                                                ];
                                                const top = Math.max(...steps.map(s => s.v), 1);
                                                return steps.map((s, i) => (
                                                    <div key={s.label} className="flex items-center gap-3">
                                                        <span className="text-[11px] text-[#8CBBE8]/55 font-black uppercase tracking-wider w-24 shrink-0">{s.label}</span>
                                                        <div className="flex-1 h-2.5 bg-[#101B33] rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${i === steps.length - 1 ? 'bg-gradient-to-r from-emerald-600 to-[#C5E69A]' : 'bg-gradient-to-r from-teal-600 to-teal-400'}`}
                                                                style={{ width: `${(s.v / top) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[#FAF6EE] font-black text-sm w-8 text-right">{s.v}</span>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#8CBBE8]/20/50">
                                        <div>
                                            <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">Camas libres</p>
                                            <p className="text-2xl font-black text-[#FAF6EE] mt-0.5">{o.camasLibres}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">Full ocupación</p>
                                            <p className="text-2xl font-black text-[#FAF6EE] mt-0.5">{c.mesesAFullOcupacion !== null ? `~${c.mesesAFullOcupacion} meses` : '—'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 pt-4 border-t border-[#8CBBE8]/20/50 text-xs">
                                        <span className="flex items-center gap-1.5 text-[#C5E69A] font-bold">
                                            <ArrowUpRight className="w-4 h-4" /> {o.altasMes} admisión{o.altasMes !== 1 ? 'es' : ''} este mes
                                        </span>
                                        <span className="flex items-center gap-1.5 text-[#8CBBE8]/55 font-bold">
                                            <ArrowDownRight className="w-4 h-4" /> {o.bajasMes} egreso{o.bajasMes !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Rentabilidad — Fase 3 */}
                            <div className="bg-[#1C3170]/40/50 border border-[#8CBBE8]/20/50 rounded-3xl p-8 space-y-6">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <h3 className="text-lg font-bold text-[#FAF6EE] flex items-center gap-2">
                                        <PiggyBank className="w-5 h-5 text-[#C5E69A]" /> Rentabilidad Operativa
                                    </h3>
                                    {p.mesesSinDatos > 0 && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[#C5E69A] bg-[#C5E69A]/10 border border-[#C5E69A]/40/20 px-3 py-1 rounded-full">
                                            {p.mesesSinDatos} mes{p.mesesSinDatos !== 1 ? 'es' : ''} sin gastos cargados
                                        </span>
                                    )}
                                </div>

                                {p.mesesConDatos === 0 ? (
                                    <div className="py-10 text-center border-2 border-dashed border-[#8CBBE8]/20 rounded-2xl">
                                        <p className="text-[#8CBBE8]/70 font-bold">Sin datos de gastos operativos</p>
                                        <p className="text-[#8CBBE8]/55 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                                            El margen no puede calcularse hasta que se carguen los gastos del mes.
                                            No mostramos un margen inflado por datos faltantes.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Hero de margen */}
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            {[
                                                { label: 'Ingresos', value: fmt(p.ingresos), tone: 'text-[#FAF6EE]' },
                                                { label: 'Gastos', value: fmt(p.gastos), tone: 'text-rose-400' },
                                                { label: 'Margen', value: fmt(p.margen), tone: p.margen >= 0 ? 'text-[#C5E69A]' : 'text-rose-400' },
                                                { label: 'Margen %', value: p.margenPct !== null ? `${p.margenPct}%` : '—', tone: (p.margenPct ?? 0) >= 0 ? 'text-[#C5E69A]' : 'text-rose-400' },
                                            ].map(k => (
                                                <div key={k.label} className="bg-[#101B33]/50 rounded-2xl p-5 border border-[#8CBBE8]/20/50">
                                                    <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">{k.label}</p>
                                                    <p className={`text-2xl font-black mt-1 ${k.tone}`}>{k.value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Serie mensual ingresos vs gastos */}
                                        <div className="space-y-4">
                                            {p.serie.map(s => {
                                                const [yy, mm] = s.mes.split('-');
                                                const max = Math.max(...p.serie.map(x => Math.max(x.ingresos, x.gastos)), 1);
                                                return (
                                                    <div key={s.mes} className="space-y-1.5">
                                                        <div className="flex justify-between items-baseline text-xs">
                                                            <span className="font-black text-[#8CBBE8]/70 uppercase tracking-wider">{MESES_ES[mm]} {yy}</span>
                                                            {s.hasExpenseData ? (
                                                                <span className="text-[#8CBBE8]/55">
                                                                    <span className="text-[#FAF6EE] font-bold">{fmt(s.ingresos)}</span>
                                                                    <span className="mx-1.5 text-[#1C3170]">−</span>
                                                                    <span className="text-rose-400 font-bold">{fmt(s.gastos)}</span>
                                                                    <span className="mx-1.5 text-[#1C3170]">=</span>
                                                                    <span className={`font-black ${s.margen >= 0 ? 'text-[#C5E69A]' : 'text-rose-400'}`}>
                                                                        {fmt(s.margen)}{s.margenPct !== null ? ` (${s.margenPct}%)` : ''}
                                                                    </span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-[#C5E69A]/70 font-bold text-[11px] uppercase tracking-wider">
                                                                    {fmt(s.ingresos)} facturado · gastos sin cargar
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1 h-3">
                                                            <div className="flex-1 bg-[#101B33] rounded-full overflow-hidden">
                                                                <div className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full" style={{ width: `${(s.ingresos / max) * 100}%` }} />
                                                            </div>
                                                            <div className="flex-1 bg-[#101B33] rounded-full overflow-hidden">
                                                                <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full" style={{ width: `${(s.gastos / max) * 100}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Punto de equilibrio */}
                                        {p.breakEven && (
                                            <div className={`rounded-2xl p-6 border ${p.breakEven.alcanzable ? 'border-[#8CBBE8]/20/50 bg-[#101B33]/50' : 'border-rose-500/30 bg-rose-500/5'}`}>
                                                <h4 className="text-sm font-black text-[#8CBBE8]/55 uppercase tracking-widest flex items-center gap-2 mb-4">
                                                    <Scale className="w-4 h-4 text-[#C5E69A]" /> Punto de Equilibrio
                                                </h4>
                                                {p.breakEven.alcanzable ? (
                                                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                                                        <p className="text-[#FAF6EE]/80 text-[15px]">
                                                            Se necesitan <span className="text-[#FAF6EE] font-black text-xl">{p.breakEven.camasNecesarias}</span> camas
                                                            ocupadas <span className="text-[#8CBBE8]/55">({p.breakEven.ocupacionEquilibrioPct}% de ocupación)</span> para cubrir el costo operativo.
                                                        </p>
                                                        <span className={`text-sm font-black px-3 py-1 rounded-full ${p.breakEven.camasSobreEquilibrio >= 0 ? 'text-[#C5E69A] bg-[#C5E69A]/10 border border-[#C5E69A]/40/20' : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'}`}>
                                                            {p.breakEven.camasSobreEquilibrio >= 0
                                                                ? `${p.breakEven.camasSobreEquilibrio} camas por encima`
                                                                : `${Math.abs(p.breakEven.camasSobreEquilibrio)} camas por debajo`}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <p className="text-rose-300 text-[15px] leading-relaxed">
                                                        El equilibrio exige <span className="font-black">{p.breakEven.camasNecesarias}</span> camas,
                                                        más que las <span className="font-black">{o.capacity}</span> autorizadas. Al ARPU actual de {fmt(f.arpu)},
                                                        el costo operativo no se cubre ni a plena ocupación.
                                                    </p>
                                                )}
                                                {p.gastoMensualPromedio !== null && (
                                                    <p className="text-[#8CBBE8]/55 text-xs mt-3">
                                                        Base: costo operativo promedio de {fmt(p.gastoMensualPromedio)}/mes sobre {p.mesesConDatos} mes{p.mesesConDatos !== 1 ? 'es' : ''} con datos.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Desglose del mes más reciente con datos */}
                                        {(() => {
                                            const ultimo = [...p.serie].reverse().find(s => s.hasExpenseData);
                                            if (!ultimo || ultimo.porCategoria.length === 0) return null;
                                            const [yy, mm] = ultimo.mes.split('-');
                                            const maxCat = Math.max(...ultimo.porCategoria.map(c2 => c2.amount), 1);
                                            return (
                                                <div className="pt-2 border-t border-[#8CBBE8]/20/50">
                                                    <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest mb-4">
                                                        Estructura de costos — {MESES_ES[mm]} {yy}
                                                    </p>
                                                    <div className="space-y-2.5">
                                                        {ultimo.porCategoria.map(cat => (
                                                            <div key={cat.category} className="flex items-center gap-3">
                                                                <span className="text-[11px] text-[#8CBBE8]/70 font-bold w-36 shrink-0 truncate">{cat.label}</span>
                                                                <div className="flex-1 h-2.5 bg-[#101B33] rounded-full overflow-hidden">
                                                                    <div className="h-full bg-gradient-to-r from-slate-500 to-slate-400 rounded-full" style={{ width: `${(cat.amount / maxCat) * 100}%` }} />
                                                                </div>
                                                                <span className="text-[#FAF6EE] font-bold text-xs w-20 text-right">{fmt(cat.amount)}</span>
                                                                <span className="text-[#8CBBE8]/55 font-bold text-[10px] w-10 text-right">
                                                                    {Math.round((cat.amount / ultimo.gastos) * 100)}%
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>

                            {/* Calidad + Equipo */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-[#1C3170]/40/50 border border-[#8CBBE8]/20/50 rounded-2xl p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-[#8CBBE8]/55 font-black uppercase tracking-widest flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-blue-400" /> Compliance Clínico
                                        </p>
                                        <p className="text-[#8CBBE8]/55 text-xs mt-1">Promedio de {e.clinicalCount} clínicos</p>
                                    </div>
                                    <p className="text-3xl font-black text-[#FAF6EE]">{q.clinicalComplianceRate}<span className="text-[#8CBBE8]/45 text-lg">/100</span></p>
                                </div>
                                <div className="bg-[#1C3170]/40/50 border border-[#8CBBE8]/20/50 rounded-2xl p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-[#8CBBE8]/55 font-black uppercase tracking-widest flex items-center gap-2">
                                            <Users className="w-4 h-4 text-teal-400" /> Equipo
                                        </p>
                                        <p className="text-[#8CBBE8]/55 text-xs mt-1">Staff activo total</p>
                                    </div>
                                    <p className="text-3xl font-black text-[#FAF6EE]">{e.staffCount}</p>
                                </div>
                                <div className="bg-[#1C3170]/40/50 border border-[#8CBBE8]/20/50 rounded-2xl p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-[#8CBBE8]/55 font-black uppercase tracking-widest flex items-center gap-2">
                                            <UserCheck className="w-4 h-4 text-[#C5E69A]" /> Ratio Staff/Residente
                                        </p>
                                        <p className="text-[#8CBBE8]/55 text-xs mt-1">Dotación por cama ocupada</p>
                                    </div>
                                    <p className="text-3xl font-black text-[#FAF6EE]">{e.ratioStaffResidente}</p>
                                </div>
                            </div>
                        </section>
                    );
                })}

                {kpis.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed border-[#8CBBE8]/20 rounded-3xl">
                        <p className="text-[#8CBBE8]/55 font-bold text-lg">No hay sedes activas para mostrar.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
