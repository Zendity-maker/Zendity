"use client";

import { useState, useEffect } from "react";
import { FaFileInvoiceDollar, FaCheckCircle, FaExclamationCircle, FaLock, FaRegClock, FaCloudDownloadAlt } from "react-icons/fa";

export default function FamilyBilling() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/family/billing')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setInvoices(data.invoices);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'PAID':
                return <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><FaCheckCircle /> Pagado</span>;
            case 'PENDING':
                return <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><FaRegClock /> Pendiente</span>;
            case 'OVERDUE':
                return <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><FaExclamationCircle /> Vencido</span>;
            default:
                return <span className="bg-slate-50 text-slate-500 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest">{status}</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
            {/* Encabezado */}
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-900/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -z-0"></div>
                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-md">
                                <FaFileInvoiceDollar className="text-xl text-indigo-300" />
                            </div>
                            <h2 className="font-extrabold text-2xl tracking-tight">Zendity Pay</h2>
                        </div>
                        <p className="text-indigo-200 text-sm font-medium">Estado de Cuenta y Facturación Mensual</p>
                    </div>
                </div>
            </div>

            {/* Area Principal - Facturas */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 text-lg mb-6 flex items-center gap-2">
                    Mis Facturas
                </h3>

                {loading ? (
                    <div className="flex justify-center items-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-2xl bg-slate-50 border border-slate-100/50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <FaFileInvoiceDollar className="text-2xl text-slate-500" />
                        </div>
                        <h4 className="font-bold text-slate-700">Sin Facturas Pendientes</h4>
                        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">Actualmente no existen registros de facturación asociados al residente.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {invoices.map((inv) => (
                            <div key={inv.id} className="group border border-slate-100 hover:border-indigo-100 rounded-2xl p-5 sm:p-6 transition-all bg-white hover:shadow-md hover:shadow-indigo-50/50 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-[100px] -z-0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative z-10 flex flex-col sm:flex-row justify-between gap-6">

                                    {/* Info Principal */}
                                    <div className="space-y-3 flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-slate-800 tracking-wider">#{inv.invoiceNumber}</span>
                                            <StatusBadge status={inv.status} />
                                        </div>

                                        <div className="text-sm text-slate-500 font-medium">
                                            <p>Vence el: <span className="font-bold text-slate-700">{new Date(inv.dueDate).toLocaleDateString()}</span></p>
                                        </div>

                                        {/* Breakdowns (Items) */}
                                        {inv.items && inv.items.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-dashed border-slate-100 space-y-2">
                                                {inv.items.map((item: any) => (
                                                    <div key={item.id} className="flex justify-between text-sm">
                                                        <span className="text-slate-600 font-medium">{item.description} <span className="text-slate-500 text-xs">x{item.quantity}</span></span>
                                                        <span className="font-bold text-slate-800">{formatCurrency(item.totalPrice)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Columna Acciones / Total */}
                                    <div className="flex flex-col items-start sm:items-end justify-between border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6">
                                        <div className="text-left sm:text-right w-full mb-4 sm:mb-0">
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Total a Pagar</p>
                                            <p className="text-3xl font-black text-slate-800 tracking-tighter">{formatCurrency(inv.totalAmount)}</p>
                                        </div>

                                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                                            {inv.status !== 'PAID' ? (
                                                <button className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-indigo-200 w-full">
                                                    <FaLock className="text-xs" /> Pagar Seguro
                                                </button>
                                            ) : (
                                                <button className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold transition-all w-full">
                                                    <FaCloudDownloadAlt /> Recibo
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-center text-xs text-slate-500 font-semibold uppercase tracking-widest">
                <FaLock className="inline-block mb-1 mr-1" /> Zendity Secure Payments
            </p>
        </div>
    );
}
