"use client";

import { useEffect, useState } from "react";
import { FaFileInvoiceDollar, FaCheckCircle, FaExclamationCircle, FaUser, FaCalendarAlt, FaCheck, FaBuilding } from "react-icons/fa";

export default function BillingAdminPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [summary, setSummary] = useState({ totalPending: 0, totalPaid: 0 });
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    const loadBilling = () => {
        fetch('/api/corporate/billing')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setInvoices(data.invoices);
                    setSummary({ totalPending: data.totalPending, totalPaid: data.totalPaid });
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        loadBilling();
    }, []);

    const markAsPaid = async (invoiceId: string) => {
        if (!confirm("¿Confirmas que se recibió el depósito o pago por este comprobante?")) return;
        setProcessing(invoiceId);

        try {
            const res = await fetch('/api/corporate/billing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId, action: 'mark_paid' })
            });
            const data = await res.json();

            if (data.success) {
                // Actualizamos estado local rápido en vez de recargar si queremos
                loadBilling();
            } else {
                alert(data.error);
            }
        } catch (e) {
            alert("Error de conexión");
        }
        setProcessing(null);
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <FaFileInvoiceDollar className="text-teal-500" /> Zendity Pay B2B
                </h1>
                <p className="text-slate-500 mt-1 font-medium">Motor de Facturación Institucional y Cobros</p>
            </div>

            {/* Gerencial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-amber-500">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <FaExclamationCircle className="text-amber-500" /> Cuentas por Cobrar (Pendiente)
                    </p>
                    <h2 className="text-4xl font-black text-amber-600">${summary.totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-emerald-500">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <FaCheckCircle className="text-emerald-500" /> Cobrado (Recaudado)
                    </p>
                    <h2 className="text-4xl font-black text-emerald-600">${summary.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
                </div>
            </div>

            {/* Invoices List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Facturas Corporativas (Invoices)</h3>
                    {/* Botón para MVP de Generar Nueva (Aquí en un flujo completo abriría modal) */}
                    <button className="bg-slate-200 text-slate-600 hover:bg-slate-300 font-bold py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-2">
                        <FaBuilding /> Configurar Ciclo
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                                <th className="p-4 border-b border-slate-100">Factura #</th>
                                <th className="p-4 border-b border-slate-100">Residente</th>
                                <th className="p-4 border-b border-slate-100">F. Emisión</th>
                                <th className="p-4 border-b border-slate-100">Estado</th>
                                <th className="p-4 border-b border-slate-100">Total</th>
                                <th className="p-4 border-b border-slate-100 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {invoices.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-slate-400 italic">No hay historial de facturación.</td>
                                </tr>
                            )}
                            {invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-700">{inv.invoiceNumber}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 font-medium text-slate-800">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs"><FaUser /></div>
                                            {inv.patient.name}
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <FaCalendarAlt className="text-slate-400" /> {new Date(inv.issueDate).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {inv.status === 'PAID' ? (
                                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1 w-max">
                                                <FaCheckCircle /> Pagado
                                            </span>
                                        ) : (
                                            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1 w-max">
                                                <FaExclamationCircle /> Pendiente
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 font-black text-slate-800">
                                        ${inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-right">
                                        {inv.status === 'PENDING' && (
                                            <button
                                                onClick={() => markAsPaid(inv.id)}
                                                disabled={processing === inv.id}
                                                className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors shadow-sm disabled:opacity-50"
                                            >
                                                {processing === inv.id ? 'Aprobando...' : 'Marcar Pagado'}
                                            </button>
                                        )}
                                        {inv.status === 'PAID' && (
                                            <span className="text-slate-400 text-xs italic">Acreditado</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
