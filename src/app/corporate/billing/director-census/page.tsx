"use client";

/**
 * Censo Financiero del Director — vista imprimible.
 *
 * Patrón: HTML + window.print() (idéntico a PAI corporate print).
 * Acceso: SOLO DIRECTOR — el endpoint /api/corporate/billing/director-census
 * gatea estrictamente. La UI valida también del lado cliente para no mostrar
 * shell vacío (defensa-en-profundidad).
 *
 * Auto-print al cargar: el browser abre el diálogo de impresión apenas se
 * pinta la data. Botón "Imprimir de nuevo" disponible.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Printer, ArrowLeft } from "lucide-react";

interface Resident {
    id: string;
    name: string;
    roomNumber: string | null;
    status: string;
    monthlyFee: number;
    createdAt: string;
}

interface CensusData {
    hq: {
        name: string;
        logoUrl: string | null;
        phone: string | null;
        billingAddress: string | null;
        brandName: string | null;
        brandPrimary: string | null;
    };
    residents: Resident[];
    summary: {
        totalCount: number;
        countWithFee: number;
        countWithoutFee: number;
        totalMonthly: number;
        averageMonthly: number;
        estimatedAnnual: number;
    };
    generatedAt: string;
}

// Casos especiales — residentes con régimen no estándar que conviene anotar
// en la tabla impresa para que el Director recuerde el contexto.
const SPECIAL_NOTES: Record<string, string> = {
    'a6308ad7-242a-4ac2-93d8-56fde83a3b06': '$900 + $1,050 multi-cuenta',
    '1cdac219-06a7-4e32-96d2-1991f1da2c9d': 'Sin asignar todavía',
};

const fmtUSD = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtDateShort = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-PR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const fmtDateLong = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-PR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
};

export default function DirectorCensusPrint() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<CensusData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Gate cliente: solo DIRECTOR puede ver esta pantalla. Si no, redirige.
    // El endpoint backend ya hace el rechazo real (401/403); esto evita el
    // flash de shell vacío para roles no autorizados.
    useEffect(() => {
        if (loading) return;
        if (!user) { router.replace('/login'); return; }
        if ((user as any).role !== 'DIRECTOR') {
            router.replace('/corporate/billing');
            return;
        }
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, loading]);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/corporate/billing/director-census');
            if (!res.ok) {
                const msg = res.status === 401 || res.status === 403
                    ? 'No tienes permiso para ver este censo (solo DIRECTOR).'
                    : `Error ${res.status} al cargar el censo.`;
                setError(msg);
                return;
            }
            const json = await res.json();
            if (!json.success) { setError(json.error ?? 'Error desconocido.'); return; }
            setData(json);
            // Auto-print una vez pintado
            setTimeout(() => window.print(), 600);
        } catch (e: any) {
            setError(e?.message ?? 'Error de red.');
        }
    };

    if (loading || (!data && !error)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white p-8">
                <div className="max-w-md text-center">
                    <p className="text-rose-700 font-bold text-lg mb-4">{error}</p>
                    <button onClick={() => router.replace('/corporate/billing')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-bold">
                        <ArrowLeft className="w-4 h-4" /> Volver a Facturación
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    // Status display: "En piso" o "Hospital"
    const statusLabel = (s: string) => s === 'TEMPORARY_LEAVE' ? 'Hospital' : 'En piso';

    return (
        <div className="min-h-screen bg-white text-slate-900">
            {/* Botones — ocultos en impresión */}
            <div className="print:hidden bg-slate-100 border-b border-slate-300 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                <button onClick={() => router.replace('/corporate/billing')}
                    className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900">
                    <ArrowLeft className="w-4 h-4" /> Volver a Facturación
                </button>
                <button onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-sm shadow-md">
                    <Printer className="w-4 h-4" /> Imprimir
                </button>
            </div>

            {/* Documento imprimible — A4, márgenes, fuente legible */}
            <div className="max-w-[8.5in] mx-auto px-12 py-10 print:px-8 print:py-6">
                {/* Membrete */}
                <header className="border-b-2 border-slate-900 pb-4 mb-6">
                    <div className="flex items-start justify-between gap-6">
                        <div className="flex items-center gap-4">
                            {data.hq.logoUrl ? (
                                <img src={data.hq.logoUrl} alt={data.hq.name} className="h-16 object-contain" />
                            ) : (
                                <div className="text-3xl font-black tracking-tight">
                                    {data.hq.brandName || data.hq.name}
                                </div>
                            )}
                            <div>
                                <h1 className="text-2xl font-black tracking-tight">
                                    {data.hq.brandName || data.hq.name}
                                </h1>
                                {data.hq.billingAddress && (
                                    <p className="text-xs text-slate-600 mt-1">{data.hq.billingAddress}</p>
                                )}
                                {data.hq.phone && (
                                    <p className="text-xs text-slate-600">Tel: {data.hq.phone}</p>
                                )}
                            </div>
                        </div>
                        <div className="text-right text-xs">
                            <p className="font-black text-rose-700 uppercase tracking-widest mb-1">CONFIDENCIAL</p>
                            <p className="text-slate-600">Uso interno del Director</p>
                            <p className="text-slate-500 mt-2">{fmtDateLong(data.generatedAt)}</p>
                        </div>
                    </div>
                </header>

                {/* Título */}
                <div className="text-center mb-6">
                    <h2 className="text-xl font-black tracking-tight">Censo Financiero del Director</h2>
                    <p className="text-sm text-slate-600 mt-1">
                        Residentes activos y hospitalizados con su mensualidad facturable
                    </p>
                </div>

                {/* Tabla */}
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b-2 border-slate-900 text-left">
                            <th className="py-2 pr-2 font-black w-8">#</th>
                            <th className="py-2 pr-2 font-black">Residente</th>
                            <th className="py-2 pr-2 font-black">Hab.</th>
                            <th className="py-2 pr-2 font-black">Estado</th>
                            <th className="py-2 pr-2 font-black">Fecha admisión <span className="text-[10px] font-normal text-slate-500">(en sistema)</span></th>
                            <th className="py-2 pl-2 font-black text-right">Mensualidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.residents.map((r, i) => {
                            const note = SPECIAL_NOTES[r.id];
                            return (
                                <tr key={r.id} className="border-b border-slate-200 align-top">
                                    <td className="py-1.5 pr-2 text-slate-500 tabular-nums">{i + 1}</td>
                                    <td className="py-1.5 pr-2 font-bold">
                                        {r.name.trim()}
                                        {note && (
                                            <span className="block text-[11px] font-normal text-slate-600 italic">↳ {note}</span>
                                        )}
                                    </td>
                                    <td className="py-1.5 pr-2 tabular-nums">{r.roomNumber ?? '—'}</td>
                                    <td className="py-1.5 pr-2">{statusLabel(r.status)}</td>
                                    <td className="py-1.5 pr-2 tabular-nums">{fmtDateShort(r.createdAt)}</td>
                                    <td className="py-1.5 pl-2 text-right tabular-nums font-bold">
                                        {r.monthlyFee > 0 ? fmtUSD(r.monthlyFee) : <span className="text-slate-400 font-normal">—</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-slate-900 font-black">
                            <td colSpan={5} className="py-3 pr-2 text-right uppercase tracking-wider text-xs">Total mensual</td>
                            <td className="py-3 pl-2 text-right tabular-nums text-lg">{fmtUSD(data.summary.totalMonthly)}</td>
                        </tr>
                        <tr className="text-xs text-slate-600">
                            <td colSpan={5} className="py-1 pr-2 text-right">Total anual proyectado</td>
                            <td className="py-1 pl-2 text-right tabular-nums">{fmtUSD(data.summary.estimatedAnnual)}</td>
                        </tr>
                        <tr className="text-xs text-slate-600">
                            <td colSpan={5} className="py-1 pr-2 text-right">Promedio por residente (con tarifa)</td>
                            <td className="py-1 pl-2 text-right tabular-nums">{fmtUSD(data.summary.averageMonthly)}</td>
                        </tr>
                        <tr className="text-xs text-slate-600">
                            <td colSpan={5} className="py-1 pr-2 text-right">Residentes en el censo</td>
                            <td className="py-1 pl-2 text-right tabular-nums">
                                {data.summary.totalCount} ({data.summary.countWithFee} con tarifa, {data.summary.countWithoutFee} sin asignar)
                            </td>
                        </tr>
                    </tfoot>
                </table>

                {/* Pie */}
                <footer className="mt-12 pt-4 border-t border-slate-300 text-[10px] text-slate-500">
                    <p>
                        Documento generado por Zéndity para uso interno del Director de {data.hq.brandName || data.hq.name}.
                        Contiene información financiera y de salud (PHI) — su impresión queda registrada en el audit log
                        del sistema bajo HIPAA Audit Controls (45 CFR §164.312(b)).
                    </p>
                    <p className="mt-1">Generado: {fmtDateLong(data.generatedAt)}</p>
                </footer>
            </div>

            {/* Print styles — A4, sin colores, margenes razonables */}
            <style jsx global>{`
                @media print {
                    @page { size: letter; margin: 0.6in; }
                    body { background: white !important; }
                    .print\\:hidden { display: none !important; }
                    .print\\:px-8 { padding-left: 0 !important; padding-right: 0 !important; }
                    .print\\:py-6 { padding-top: 0 !important; padding-bottom: 0 !important; }
                }
            `}</style>
        </div>
    );
}
