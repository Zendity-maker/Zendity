"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
}

interface SizedBox {
    id: string;
    name: string;
}

export default function SaaSInvoiceClient() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [hqs, setHqs] = useState<SizedBox[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal State
    const [selectedHqId, setSelectedHqId] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [items, setItems] = useState<InvoiceItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
    const [taxRate, setTaxRate] = useState<number>(0);
    const [notes, setNotes] = useState("");

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/superadmin/billing");
            const data = await res.json();
            if (data.success) {
                setInvoices(data.invoices);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHqs = async () => {
        try {
            // Reusing a corporate endpoint or we just make a simple fetch to superadmin/hq list if needed
            // Actually, for simplicity we can just fetch all HQs from an existing endpoint like /api/public/hq/branding ?
            // Better to use another small fetch or hardcode a combo. Wait, we need the real list. Let's create a quick API for standard HQ listing if not exists, 
            // but we can just use `/api/superadmin/hq/list` or since we are SuperAdmin we can make a query. Let's just create a quick endpoint inside the modal if needed, or pass it via props.
            // Oh, we are in a client component. Let's just create a simple `GET /api/superadmin/hqs` inside.
            const res = await fetch("/api/superadmin/hqs");
            const data = await res.json();
            if (data.success) {
                setHqs(data.hqs);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchInvoices();
        fetchHqs();
    }, []);

    const handleAddItem = () => {
        setItems([...items, { description: "", quantity: 1, unitPrice: 0 }]);
    };

    const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload = {
                headquartersId: selectedHqId,
                dueDate,
                items,
                taxRate,
                notes
            };
            const res = await fetch("/api/superadmin/billing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setIsModalOpen(false);
                setSelectedHqId("");
                setDueDate("");
                setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
                setNotes("");
                fetchInvoices();
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            console.error(error);
            alert("Connection error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePay = async (id: string) => {
        if (!confirm("¿Marcar esta factura SaaS como PAGADA? Esta acción no se puede deshacer.")) return;

        try {
            const res = await fetch(`/api/superadmin/billing/${id}/pay`, { method: "PATCH" });
            const data = await res.json();
            if (data.success) {
                fetchInvoices(); // Refresh the table
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) {
        return <div className="text-center p-12 text-teal-400 animate-pulse font-bold">Cargando Facturaciones B2B...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
                <div>
                    <h2 className="text-xl font-bold text-white">Historial de Recibos de Software</h2>
                    <p className="text-sm text-slate-500 mt-1">SaaS Revenue Tracker - Facturación enviada a clientes Asilos.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-black px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(20,184,166,0.2)] active:scale-95 flex items-center gap-2"
                >
                    <span>+ Emitir Nueva Factura B2B</span>
                </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/50 text-xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800">
                                <th className="p-4 pl-6">ID Factura / Cliente</th>
                                <th className="p-4 hidden md:table-cell">Emisión / Vencimiento</th>
                                <th className="p-4">Cargo Total</th>
                                <th className="p-4 text-center">Estatus</th>
                                <th className="p-4 pr-6 text-right">Acciones de Pago</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="p-4 pl-6">
                                        <div className="font-bold text-white text-base">{inv.headquarters?.name || 'Asilo Borrado'}</div>
                                        <div className="text-xs font-mono mt-1 text-slate-500 bg-slate-800/50 inline-block px-2 py-0.5 rounded border border-slate-700/50">
                                            {inv.invoiceNumber}
                                        </div>
                                    </td>
                                    <td className="p-4 hidden md:table-cell">
                                        <div className="text-sm text-slate-300">Emisión: {format(new Date(inv.issueDate), "dd MMM yyyy", { locale: es })}</div>
                                        <div className="text-xs text-slate-500 mt-1">Expira: <span className="text-amber-400/80">{format(new Date(inv.dueDate), "dd MMM yyyy", { locale: es })}</span></div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-black text-emerald-400 text-lg">
                                            ${inv.totalAmount.toFixed(2)}
                                        </div>
                                        <div className="text-xs text-slate-600 font-medium">Sub: ${inv.subtotal.toFixed(2)}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {inv.status === 'PAID' ? (
                                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                Saldado B2B
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-xs font-bold shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                Cobro Pendiente
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        {inv.status !== 'PAID' && (
                                            <button
                                                onClick={() => handlePay(inv.id)}
                                                className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-500 rounded-lg text-sm font-bold transition-all border border-emerald-500/20"
                                            >
                                                Registrar Pago Remoto
                                            </button>
                                        )}
                                        {inv.status === 'PAID' && (
                                            <div className="text-xs text-slate-500 font-medium bg-slate-800/50 inline-block px-3 py-1.5 rounded-lg border border-slate-700">
                                                Cobrado el {inv.paidAt ? format(new Date(inv.paidAt), "dd/MMM/yy") : 'N/A'}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {invoices.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-500">No hay facturas emitidas por uso de plataforma aún.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invoicing Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
                            <div>
                                <h3 className="text-xl font-bold text-white">Emitir Facturacion SaaS</h3>
                                <p className="text-xs text-slate-400 mt-1">Cobra el fee mensual de licencia B2B a un cliente (Asilo).</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 w-8 h-8 flex items-center justify-center rounded-full"></button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                            <form id="saas-invoice-form" onSubmit={handleCreateInvoice} className="space-y-6">

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cliente B2B (Asilo)</label>
                                        <select
                                            value={selectedHqId}
                                            onChange={(e) => setSelectedHqId(e.target.value)}
                                            required
                                            className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 outline-none focus:border-teal-500 transition-colors"
                                        >
                                            <option value="">Seleccione Asilo...</option>
                                            {hqs.map(hq => (
                                                <option key={hq.id} value={hq.id}>{hq.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fecha Límite Pago</label>
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            required
                                            className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 outline-none focus:border-teal-500 transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                        <h4 className="text-sm font-bold text-slate-300">Líneas de Facturación</h4>
                                        <button type="button" onClick={handleAddItem} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-teal-400 font-bold transition-colors">
                                            + Añadir Cargo
                                        </button>
                                    </div>

                                    {items.map((item, index) => (
                                        <div key={index} className="flex flex-col md:flex-row gap-3">
                                            <div className="flex-1">
                                                <input required type="text" placeholder="Ej. Licencia Mensual Zendity OS Base (Ene 2026)" value={item.description} onChange={(e) => handleItemChange(index, "description", e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-2.5 outline-none focus:border-teal-500" />
                                            </div>
                                            <div className="w-24">
                                                <input required type="number" min="1" step="1" placeholder="Cant." value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-2.5 outline-none focus:border-teal-500 text-center" />
                                            </div>
                                            <div className="w-32 relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                                                <input required type="number" min="0" step="0.01" placeholder="Precio" value={item.unitPrice} onChange={(e) => handleItemChange(index, "unitPrice", Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-white text-sm pl-7 rounded-lg p-2.5 outline-none focus:border-teal-500" />
                                            </div>
                                            {items.length > 1 && (
                                                <button type="button" onClick={() => handleRemoveItem(index)} className="w-10 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors border border-red-500/20">
                                                    
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tasa Impuestos (%)</label>
                                        <input
                                            type="number" step="0.01" min="0" placeholder="Ej. 11.5 para IVU"
                                            value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))}
                                            className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 outline-none focus:border-teal-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Estimado</label>
                                        <div className="w-full bg-slate-900 border border-slate-800 text-teal-400 rounded-xl p-3 font-black text-xl flex items-center justify-between">
                                            <span>Monto Final:</span>
                                            <span>
                                                ${(items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0) * (1 + (taxRate / 100))).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Términos y Notas (Opcional)</label>
                                    <textarea
                                        rows={2} placeholder="Ej. El cargo incluye 30 usuarios B2B adicionales."
                                        value={notes} onChange={(e) => setNotes(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 outline-none focus:border-teal-500 transition-colors"
                                    />
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-slate-800 bg-slate-900/80 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 font-bold transition-colors">Cancelar</button>
                            <button type="submit" form="saas-invoice-form" disabled={isSubmitting} className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-black px-8 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_15px_rgba(20,184,166,0.2)]">
                                {isSubmitting ? "Autenticando..." : "Timbrar y Emitir Factura B2B"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
