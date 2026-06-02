"use client";

/**
 * /family/billing — Humanista Suave (Propuesta C)
 *
 * Facturación. Cards blancas con borde suave, fondo cálido neutro,
 * acento brand. Pagos honestos: procesados por la facilidad.
 */

import { useState, useEffect } from "react";
import { CheckCircle2, Clock, AlertCircle, Download } from "lucide-react";
import { IconFacturacion } from "@/components/icons/ZendityIcons";

// ── Tiempo humano ──────────────────────────────────────────────────────
function humanTime(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 5) return "justo ahora";
    if (diffMin < 60) return `hace ${diffMin} min`;
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    if (sameDay) return "hoy";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getDate() === yesterday.getDate();
    if (isYesterday) return "ayer";
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return d.toLocaleDateString("es-PR", { weekday: "long" });
    return d.toLocaleDateString("es-PR", { day: "numeric", month: "long" });
}

function fechaCorta(date: string | Date): string {
    return new Date(date).toLocaleDateString("es-PR", { day: "numeric", month: "long", year: "numeric" });
}

// ── Status badge ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string; Icon: any }> = {
        PAID:    { label: "Pagada",    cls: "bg-brand/10 text-brand",  Icon: CheckCircle2 },
        PENDING: { label: "Pendiente", cls: "bg-amber-50 text-amber-700", Icon: Clock },
        OVERDUE: { label: "Vencida",   cls: "bg-red-50 text-red-600",     Icon: AlertCircle },
    };
    const s = map[status] ?? map.PENDING;
    const Icon = s.Icon;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-0.5 ${s.cls}`}>
            <Icon className="w-3 h-3" strokeWidth={1.5} />
            {s.label}
        </span>
    );
}

export default function FamilyBillingPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [resident, setResident] = useState<{ name: string; roomNumber?: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/family/billing')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setInvoices(data.invoices);
                    setResident(data.resident ?? null);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

    const pendingInvoices = invoices.filter(i => i.status !== 'PAID');
    const paidInvoices    = invoices.filter(i => i.status === 'PAID');

    return (
        <div className="bg-[#FAFAF8] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">

            {/* ═══ HEADER ═══ */}
            <div className="bg-white border-b border-stone-100 px-4 py-5">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                        <IconFacturacion size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-slate-800 leading-tight">
                            Facturación
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {resident?.name || "Estado de cuenta"}
                        </p>
                    </div>
                </div>
            </div>

            {/* ═══ BODY ═══ */}
            <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-28">

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="flex gap-1.5">
                            <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                            <div className="w-2 h-2 bg-brand rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                            <div className="w-2 h-2 bg-brand rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                        </div>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                        <CheckCircle2 className="w-12 h-12 text-slate-200 mx-auto mb-3" strokeWidth={1.25} />
                        <p className="text-sm text-slate-500 font-medium">Balance al día</p>
                        <p className="text-xs text-slate-400 mt-1">No hay facturas registradas.</p>
                    </div>
                ) : (
                    <>
                        {/* Facturas pendientes */}
                        {pendingInvoices.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                                    {pendingInvoices.length === 1 ? "Pendiente" : `${pendingInvoices.length} pendientes`}
                                </p>
                                <div className="space-y-3">
                                    {pendingInvoices.map(inv => (
                                        <div key={inv.id} className="bg-white rounded-2xl border border-slate-100 p-5">

                                            {/* Heading: número + status */}
                                            <div className="flex items-baseline justify-between mb-3">
                                                <span className="text-xs text-slate-400 font-medium">
                                                    Factura {inv.invoiceNumber}
                                                </span>
                                                <StatusBadge status={inv.status} />
                                            </div>

                                            {/* Total hero */}
                                            <p className="text-3xl font-bold text-slate-800 tabular-nums mb-1">
                                                {formatCurrency(inv.totalAmount)}
                                            </p>
                                            <p className="text-xs text-slate-400 mb-5">
                                                Vence el {fechaCorta(inv.dueDate)}
                                            </p>

                                            {/* Items */}
                                            {inv.items && inv.items.length > 0 && (
                                                <div className="border-t border-slate-100 -mx-5 px-5 pt-4 mb-4">
                                                    <ul className="space-y-2">
                                                        {inv.items.map((item: any) => (
                                                            <li key={item.id} className="flex items-baseline justify-between text-sm">
                                                                <span className="text-slate-600 flex-1 pr-4">
                                                                    {item.description}
                                                                    {item.quantity > 1 && (
                                                                        <span className="text-slate-400"> · {item.quantity}</span>
                                                                    )}
                                                                </span>
                                                                <span className="text-slate-800 font-medium tabular-nums">
                                                                    {formatCurrency(item.totalPrice)}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Pago honesto */}
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                                                <p className="text-sm font-semibold text-slate-600 mb-1">
                                                    Pagos procesados por tu facilidad
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    Para realizar un pago contacta al director.
                                                </p>
                                                <a
                                                    href="/family/messages"
                                                    className="inline-block mt-3 text-xs font-semibold text-brand border border-brand/25 rounded-full px-4 py-1.5 hover:bg-brand/10 transition-colors"
                                                >
                                                    Enviar mensaje al director →
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Historial */}
                        {paidInvoices.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                                    Historial
                                </p>
                                <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
                                    {paidInvoices.map(inv => (
                                        <div key={inv.id} className="flex items-baseline justify-between p-4">
                                            <div className="flex-1">
                                                <p className="text-base font-semibold text-slate-800 tabular-nums">
                                                    {formatCurrency(inv.totalAmount)}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {inv.invoiceNumber} · Pagada {inv.paidAt ? humanTime(inv.paidAt) : "previamente"}
                                                </p>
                                            </div>
                                            <a
                                                href={`/api/family/billing/${inv.id}/receipt-pdf`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Descargar recibo PDF"
                                                className="text-brand hover:text-brand/80 hover:bg-brand/5 p-2 rounded-lg transition-colors"
                                            >
                                                <Download className="w-4 h-4" strokeWidth={1.5} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
