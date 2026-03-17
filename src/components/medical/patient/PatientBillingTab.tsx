"use client";

import { useState, useEffect } from "react";
import { FaMoneyBillWave, FaFileInvoiceDollar, FaCheckCircle, FaExclamationCircle, FaRegClock, FaSave, FaHandHoldingUsd } from "react-icons/fa";

export default function PatientBillingTab({ patientId, patientData, onRefresh }: { patientId: string, patientData: any, onRefresh: () => void }) {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);

    // Form settings
    const [monthlyFee, setMonthlyFee] = useState<string>(patientData?.monthlyFee?.toString() || "0");
    const [adfContribution, setAdfContribution] = useState<string>(patientData?.adfContribution?.toString() || "0");
    const [privateContribution, setPrivateContribution] = useState<number>(patientData?.privateContribution || 0);

    // Form abono
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [paymentAmount, setPaymentAmount] = useState<string>("");
    const [paymentSource, setPaymentSource] = useState("PRIVATE");
    const [paymentNotes, setPaymentNotes] = useState("");
    const [processingPayment, setProcessingPayment] = useState(false);

    useEffect(() => {
        loadInvoices();
    }, [patientId]);

    useEffect(() => {
        // Auto-calculate private contribution
        const total = parseFloat(monthlyFee) || 0;
        const adf = parseFloat(adfContribution) || 0;
        setPrivateContribution(Math.max(0, total - adf));
    }, [monthlyFee, adfContribution]);

    const loadInvoices = async () => {
        try {
            // Reutilizamos el endpoint familiar o creamos uno corporativo. 
            // Para fines prácticos, consultaremos un api corporativo hipotético /api/corporate/patients/[id]/invoices
            const res = await fetch(`/api/corporate/patients/${patientId}/invoices`);
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

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/billing-specs`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ monthlyFee, adfContribution })
            });
            const data = await res.json();
            if (data.success) {
                alert("Configuración financiera guardada.");
                onRefresh();
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            alert("Error de conexión");
        }
        setSavingSettings(false);
    };

    const handleProcessPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInvoice) return;

        setProcessingPayment(true);
        try {
            const res = await fetch(`/api/corporate/billing/payments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invoiceId: selectedInvoice.id,
                    amount: paymentAmount,
                    source: paymentSource,
                    notes: paymentNotes
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Abono procesado con éxito.");
                setShowPaymentModal(false);
                setPaymentAmount("");
                setPaymentNotes("");
                loadInvoices();
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            alert("Error de conexión");
        }
        setProcessingPayment(false);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col lg:flex-row gap-8">

                {/* Left Col: Configuraciones Financieras */}
                <div className="w-full lg:w-1/3 space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FaMoneyBillWave className="text-emerald-500" />
                            Cuotas y Aportaciones
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 mb-6">
                            Establece la tarifa mensual y desglosa cuántos fondos provienen del Departamento de la Familia.
                        </p>

                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 shadow-inner space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cuota Mensual (Base)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                                    <input 
                                        type="number" 
                                        min="0" step="0.01"
                                        value={monthlyFee}
                                        onChange={(e) => setMonthlyFee(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl py-3 pl-8 pr-4 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Aportación ADF</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                                    <input 
                                        type="number" 
                                        min="0" step="0.01"
                                        value={adfContribution}
                                        onChange={(e) => setAdfContribution(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl py-3 pl-8 pr-4 font-bold text-amber-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Porción a Facturar a la Familia</label>
                                <p className="text-2xl font-black text-rose-600">{formatCurrency(privateContribution)}</p>
                            </div>

                            <button 
                                onClick={handleSaveSettings}
                                disabled={savingSettings}
                                className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-md shadow-emerald-200 transition-colors disabled:opacity-50"
                            >
                                <FaSave /> {savingSettings ? 'Guardando...' : 'Guardar Ajustes'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Col: Historial de Facturas y Pagos */}
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FaFileInvoiceDollar className="text-indigo-500" />
                            Historial de Facturas
                        </h2>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        {loading && <div className="p-10 text-center text-slate-500 font-bold">Cargando facturas...</div>}
                        {!loading && invoices.length === 0 && <div className="p-10 text-center text-slate-500 font-medium">No hay facturas emitidas para este residente.</div>}
                        
                        {!loading && invoices.length > 0 && (
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Factura</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Monto Total</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Balance Restante</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map(inv => {
                                        const remaining = inv.totalAmount - inv.amountPaid;
                                        return (
                                            <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-bold text-slate-700">#{inv.invoiceNumber}</td>
                                                <td className="p-4">
                                                    {inv.status === 'PAID' && <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-black">PAGADA</span>}
                                                    {inv.status === 'PENDING' && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-black">PENDIENTE</span>}
                                                    {inv.status === 'OVERDUE' && <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-black">VENCIDA</span>}
                                                </td>
                                                <td className="p-4 font-medium text-slate-600">{formatCurrency(inv.totalAmount)}</td>
                                                <td className="p-4 font-black tracking-tight text-slate-800">
                                                    {formatCurrency(remaining)}
                                                    {inv.amountPaid > 0 && <span className="block text-[10px] text-slate-400 uppercase font-bold">({formatCurrency(inv.amountPaid)} Abonado)</span>}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                                                        <button 
                                                            onClick={() => { setSelectedInvoice(inv); setShowPaymentModal(true); setPaymentAmount(remaining.toString()); }}
                                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                                        >
                                                            Abonar
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

            </div>

            {/* Modal de Pago Parcial */}
            {showPaymentModal && selectedInvoice && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <h3 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-2">
                            <FaHandHoldingUsd className="text-emerald-500" /> Registrar Abono
                        </h3>
                        <p className="text-slate-500 font-medium mb-6">Aplicando recibo a la factura <strong>#{selectedInvoice.invoiceNumber}</strong></p>

                        <form onSubmit={handleProcessPayment} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto del Abono</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                                    <input 
                                        type="number" min="0.01" step="0.01" required
                                        max={selectedInvoice.totalAmount - selectedInvoice.amountPaid}
                                        value={paymentAmount}
                                        onChange={e => setPaymentAmount(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-8 pr-4 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 block">Balance pendiente actual: {formatCurrency(selectedInvoice.totalAmount - selectedInvoice.amountPaid)}</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Origen de Fondos</label>
                                <select 
                                    value={paymentSource} 
                                    onChange={e => setPaymentSource(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                                >
                                    <option value="PRIVATE">Pago Privado (Familia)</option>
                                    <option value="ADF">Aportación ADF (Gobierno)</option>
                                    <option value="OTHER">Otro</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas / Referencia</label>
                                <input 
                                    type="text"
                                    value={paymentNotes}
                                    onChange={e => setPaymentNotes(e.target.value)}
                                    placeholder="# Cheque o # Confirmación ACH"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700"
                                />
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors">Cancelar</button>
                                <button type="submit" disabled={processingPayment} className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-50">Confirmar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
