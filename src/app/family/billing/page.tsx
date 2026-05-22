"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Clock, AlertCircle, Lock, Download, Receipt } from "lucide-react";

// ── Tiempo humano ──
function humanTime(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 5) return "justo ahora";
    if (diffMin < 60) return `hace ${diffMin} minutos`;
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

function Diamond() {
    return (
        <div className="flex justify-center py-12">
            <span className="text-stone-300 text-base tracking-[1em]">◆ ◆ ◆</span>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-6 text-center">
            {children}
        </p>
    );
}

function StatusLine({ status }: { status: string }) {
    const map: Record<string, { label: string; icon: any; color: string }> = {
        PAID:    { label: "Pagada",    icon: CheckCircle2, color: "text-teal-700" },
        PENDING: { label: "Pendiente", icon: Clock,         color: "text-stone-500" },
        OVERDUE: { label: "Vencida",   icon: AlertCircle,   color: "text-stone-700" },
    };
    const s = map[status] ?? { label: status, icon: Clock, color: "text-stone-500" };
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] font-medium ${s.color} font-sans`}>
            <Icon className="w-3 h-3" strokeWidth={1.5} />
            {s.label}
        </span>
    );
}

export default function FamilyBilling() {
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

    if (loading) {
        return (
            <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen flex items-center justify-center">
                <span className="font-serif italic text-stone-300 text-lg">cargando…</span>
            </div>
        );
    }

    const pendingInvoices = invoices.filter(i => i.status !== 'PAID');
    const paidInvoices    = invoices.filter(i => i.status === 'PAID');

    return (
        <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">
            <div className="max-w-2xl mx-auto px-6 sm:px-10 py-16 sm:py-24">

                {/* ═══ MASTHEAD ═══════════════════════════════════════════ */}
                <header className="text-center mb-12">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-medium mb-2">
                        Estado de cuenta
                    </p>
                    {resident && (
                        <p className="font-serif italic text-stone-400 text-sm mb-10">
                            {resident.name}
                            {resident.roomNumber && (
                                <>
                                    <span className="mx-2 text-stone-300">·</span>
                                    Habitación {resident.roomNumber}
                                </>
                            )}
                        </p>
                    )}
                    <h1
                        className="font-serif text-stone-900 leading-[1.05] tracking-tight"
                        style={{
                            fontSize: "clamp(2.5rem, 8vw, 4rem)",
                            fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                        }}
                    >
                        Facturación
                    </h1>
                    <div className="flex items-center justify-center gap-3 mt-6">
                        <span className="block w-12 h-px bg-stone-300" />
                        <span className="text-stone-300 text-xs">◆</span>
                        <span className="block w-12 h-px bg-stone-300" />
                    </div>
                </header>

                {invoices.length === 0 ? (
                    <div className="text-center py-20">
                        <Receipt className="w-12 h-12 text-stone-300 mx-auto mb-6" strokeWidth={1.25} />
                        <p
                            className="font-serif italic text-stone-500 leading-relaxed"
                            style={{ fontSize: "1.25rem" }}
                        >
                            Balance al día.<br />
                            No hay facturas registradas.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* ═══ Facturas pendientes ═══════════════════════ */}
                        {pendingInvoices.length > 0 && (
                            <>
                                <Diamond />
                                <section>
                                    <SectionLabel>
                                        {pendingInvoices.length === 1 ? "Factura pendiente" : `${pendingInvoices.length} facturas pendientes`}
                                    </SectionLabel>

                                    <div className="space-y-12">
                                        {pendingInvoices.map((inv) => (
                                            <article key={inv.id} className="max-w-lg mx-auto">

                                                {/* Heading: número + status */}
                                                <div className="flex items-baseline justify-between mb-4">
                                                    <span className="font-serif italic text-stone-400 text-sm">
                                                        Factura {inv.invoiceNumber}
                                                    </span>
                                                    <StatusLine status={inv.status} />
                                                </div>

                                                {/* Total — el dato protagonista */}
                                                <p
                                                    className="font-serif text-stone-900 leading-none tracking-tight mb-2"
                                                    style={{
                                                        fontSize: "3.5rem",
                                                        fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                                                    }}
                                                >
                                                    {formatCurrency(inv.totalAmount)}
                                                </p>
                                                <p className="font-serif italic text-stone-500 text-sm mb-8">
                                                    Vence el {fechaCorta(inv.dueDate)}
                                                </p>

                                                {/* Items desglosados */}
                                                {inv.items && inv.items.length > 0 && (
                                                    <dl className="font-serif mb-8">
                                                        {inv.items.map((item: any) => (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-baseline justify-between py-3 border-b border-stone-200 last:border-b-0"
                                                            >
                                                                <dt className="text-sm text-stone-600 italic flex-1 pr-4">
                                                                    {item.description}
                                                                    {item.quantity > 1 && (
                                                                        <span className="text-stone-400 not-italic"> · {item.quantity}</span>
                                                                    )}
                                                                </dt>
                                                                <dd className="text-stone-900 text-base tracking-tight tabular-nums">
                                                                    {formatCurrency(item.totalPrice)}
                                                                </dd>
                                                            </div>
                                                        ))}
                                                    </dl>
                                                )}

                                                {/* CTA pagar */}
                                                <button className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-full transition-colors flex items-center justify-center gap-2 font-sans font-medium text-sm tracking-wide">
                                                    <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                    Pagar de forma segura
                                                </button>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            </>
                        )}

                        {/* ═══ Historial pagado ═══════════════════════════ */}
                        {paidInvoices.length > 0 && (
                            <>
                                <Diamond />
                                <section>
                                    <SectionLabel>Historial</SectionLabel>

                                    <div className="max-w-lg mx-auto">
                                        {paidInvoices.map((inv) => (
                                            <div
                                                key={inv.id}
                                                className="group flex items-baseline justify-between py-5 border-b border-stone-200 last:border-b-0 hover:bg-stone-100/50 -mx-4 px-4 transition-colors"
                                            >
                                                <div className="flex-1">
                                                    <p className="font-serif text-stone-900 text-lg tracking-tight">
                                                        {formatCurrency(inv.totalAmount)}
                                                    </p>
                                                    <p className="text-xs text-stone-400 italic font-serif">
                                                        {inv.invoiceNumber} · Pagada {inv.paidAt ? humanTime(inv.paidAt) : "previamente"}
                                                    </p>
                                                </div>
                                                <button
                                                    title="Descargar recibo"
                                                    className="text-stone-400 hover:text-teal-700 transition-colors p-2"
                                                >
                                                    <Download className="w-4 h-4" strokeWidth={1.5} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </>
                        )}
                    </>
                )}

                {/* ═══ COLOFÓN ═══════════════════════════════════════════ */}
                <footer className="text-center mt-20 sm:mt-28 pb-8">
                    <p className="text-stone-300 text-xs tracking-[0.5em] mb-3">◆ ◆ ◆</p>
                    <p className="font-serif italic text-stone-400 text-xs leading-relaxed flex items-center justify-center gap-1.5">
                        <Lock className="w-3 h-3" strokeWidth={1.5} />
                        Pagos seguros por Zéndity
                    </p>
                </footer>

            </div>
        </div>
    );
}
