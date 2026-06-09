"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { CreditCard, Landmark, FileText, CheckCircle, Clock, AlertCircle, Save, Plus, Wallet, RefreshCw } from "lucide-react";

// Roles que pueden ESCRIBIR en billing (mismo set que los endpoints
// /api/corporate/patients/[id]/billing-specs, /invoices, /recharge-concierge,
// /generate-monthly-invoice). SOCIAL_WORKER queda fuera — billing es
// administrativo, no clínico ni social. El backend ya rechaza con 403; aquí
// solo es defensa-en-profundidad UX para no mostrar botones que fallarían.
const BILLING_WRITE_ROLES = ['DIRECTOR', 'ADMIN'];

export default function PatientBillingTab({
    patientId, patientData, onRefresh
}: {
    patientId: string;
    patientData: any;
    onRefresh: () => void;
}) {
    const { user } = useAuth();
    const canWrite = BILLING_WRITE_ROLES.includes(user?.role || '');
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);
    const [generatingInvoice, setGeneratingInvoice] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    // Recarga de saldo Concierge
    const [rechargeAmount, setRechargeAmount] = useState<string>("");
    const [rechargeNote, setRechargeNote] = useState<string>("");
    const [recharging, setRecharging] = useState(false);
    const [conciergeBalance, setConciergeBalance] = useState<number>(patientData?.conciergeBalance ?? 0);

    // Cuotas
    const [monthlyFee, setMonthlyFee] = useState<string>(patientData?.monthlyFee?.toString() || "0");
    const [adfContribution, setAdfContribution] = useState<string>(patientData?.adfContribution?.toString() || "0");
    const [privateContribution, setPrivateContribution] = useState<number>(patientData?.privateContribution || 0);

    // Método de pago ACH / Cheque
    const [paymentMethod, setPaymentMethod] = useState<string>(patientData?.paymentMethod || "");
    const [achBankName, setAchBankName] = useState<string>(patientData?.achBankName || "");
    const [achAccountNumber, setAchAccountNumber] = useState<string>(patientData?.achAccountNumber || "");
    const [achRoutingNumber, setAchRoutingNumber] = useState<string>(patientData?.achRoutingNumber || "");

    useEffect(() => {
        loadInvoices();
    }, [patientId]);

    useEffect(() => {
        const total = parseFloat(monthlyFee) || 0;
        const adf = parseFloat(adfContribution) || 0;
        setPrivateContribution(Math.max(0, total - adf));
    }, [monthlyFee, adfContribution]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3500);
    };

    const loadInvoices = async () => {
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/invoices`);
            const data = await res.json();
            if (data.success) setInvoices(data.invoices);
        } catch (e) {
            console.error(e);
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
                body: JSON.stringify({
                    monthlyFee, adfContribution,
                    paymentMethod: paymentMethod || null,
                    achBankName: paymentMethod === 'ACH' ? (achBankName || null) : null,
                    achAccountNumber: paymentMethod === 'ACH' ? (achAccountNumber || null) : null,
                    achRoutingNumber: paymentMethod === 'ACH' ? (achRoutingNumber || null) : null,
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast("✓ Configuración guardada correctamente.");
                onRefresh();
            } else {
                showToast("Error: " + data.error);
            }
        } catch {
            showToast("Error de conexión");
        }
        setSavingSettings(false);
    };

    const handleRechargeBalance = async () => {
        const monto = parseFloat(rechargeAmount);
        if (!monto || isNaN(monto) || monto <= 0) {
            showToast("⚠️ Ingresa un monto válido mayor a $0");
            return;
        }
        setRecharging(true);
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/balance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: monto, note: rechargeNote.trim() || undefined }),
            });
            const data = await res.json();
            if (data.success) {
                setConciergeBalance(data.newBalance);
                setRechargeAmount("");
                setRechargeNote("");
                showToast(`✓ ${data.message}`);
                await loadInvoices();
                onRefresh();
            } else {
                showToast("Error: " + data.error);
            }
        } catch {
            showToast("Error de conexión");
        }
        setRecharging(false);
    };

    const handleGenerateMonthlyInvoice = async () => {
        if (!confirm(`¿Generar factura mensual de $${parseFloat(monthlyFee).toLocaleString('en-US', { minimumFractionDigits: 2 })} para ${patientData?.name}?`)) return;
        setGeneratingInvoice(true);
        try {
            const now = new Date();
            const monthName = now.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' });
            const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 5); // vence el 5 del mes siguiente

            const items = [
                { description: `Cuota Mensual — ${monthName}`, quantity: 1, unitPrice: parseFloat(monthlyFee) || 0 }
            ];
            if (parseFloat(adfContribution) > 0) {
                items.push({ description: `Aportación ADF — ${monthName}`, quantity: 1, unitPrice: -(parseFloat(adfContribution)) });
            }

            const res = await fetch("/api/corporate/billing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId,
                    dueDate: dueDate.toISOString().split('T')[0],
                    notes: `Factura mensual generada desde la ficha del residente — ${monthName}`,
                    items,
                })
            });
            const data = await res.json();
            if (data.success || res.ok) {
                showToast("✓ Factura del mes generada.");
                await loadInvoices();
            } else {
                showToast("Error al generar factura: " + (data.error || res.statusText));
            }
        } catch (e: any) {
            showToast("Error de conexión: " + e.message);
        }
        setGeneratingInvoice(false);
    };

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-8 animate-in fade-in duration-300">

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm animate-in slide-in-from-bottom-4">
                    {toast}
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-8">

                {/* ── Columna Izquierda: Configuración Financiera ── */}
                <div className="w-full lg:w-2/5 space-y-6">

                    {/* Cuotas */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                            <CreditCard className="w-5 h-5 text-emerald-500" /> Cuotas y Aportaciones
                        </h2>
                        <p className="text-sm text-slate-500 mb-4">Tarifa mensual y desglose ADF / privado.</p>

                        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cuota Mensual Base</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                                    <input type="number" min="0" step="0.01" value={monthlyFee}
                                        onChange={e => setMonthlyFee(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl py-3 pl-8 pr-4 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Aportación ADF</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                                    <input type="number" min="0" step="0.01" value={adfContribution}
                                        onChange={e => setAdfContribution(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl py-3 pl-8 pr-4 font-bold text-amber-700 focus:ring-2 focus:ring-emerald-500 outline-none" />
                                </div>
                            </div>
                            <div className="pt-3 border-t border-slate-200">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">A Facturar a la Familia</label>
                                <p className="text-2xl font-black text-rose-600">{formatCurrency(privateContribution)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Método de Pago */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                            <Landmark className="w-5 h-5 text-indigo-500" /> Método de Pago
                        </h2>
                        <p className="text-sm text-slate-500 mb-4">Configuración de cobro recurrente.</p>

                        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Método</label>
                                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none">
                                    <option value="">— Sin configurar —</option>
                                    <option value="ACH">ACH — Débito Automático</option>
                                    <option value="CHECK">Cheque</option>
                                </select>
                            </div>

                            {paymentMethod === 'ACH' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Banco</label>
                                        <input type="text" value={achBankName} onChange={e => setAchBankName(e.target.value)}
                                            placeholder="Ej. FirstBank, Popular, Oriental…"
                                            className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                Últimos 4 — Cuenta
                                            </label>
                                            <input type="text" maxLength={4} value={achAccountNumber}
                                                onChange={e => setAchAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                placeholder="XXXX"
                                                className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 font-mono font-bold text-slate-800 tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none text-center" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                Últimos 4 — Routing
                                            </label>
                                            <input type="text" maxLength={4} value={achRoutingNumber}
                                                onChange={e => setAchRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                placeholder="XXXX"
                                                className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 font-mono font-bold text-slate-800 tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none text-center" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 flex items-center gap-1">
                                        🔒 Solo se guardan los últimos 4 dígitos — nunca el número completo.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {canWrite && (
                        <button onClick={handleSaveSettings} disabled={savingSettings}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold shadow-md shadow-emerald-200 transition-colors disabled:opacity-50">
                            <Save className="w-4 h-4" /> {savingSettings ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    )}

                    {/* ── Recarga de Saldo Concierge ── */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                            <Wallet className="w-5 h-5 text-violet-500" /> Saldo Concierge
                        </h2>
                        <p className="text-sm text-slate-500 mb-4">Recarga el saldo del portal familiar. El cargo aparecerá en la factura mensual.</p>

                        <div className="bg-violet-50 rounded-2xl border border-violet-200 p-5 space-y-4">
                            {/* Saldo actual */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Actual</span>
                                <span className="text-2xl font-black text-violet-700">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(conciergeBalance)}
                                </span>
                            </div>

                            {/* Monto a recargar */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto a Recargar</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                                    <input
                                        type="number" min="1" step="0.01"
                                        value={rechargeAmount}
                                        onChange={e => setRechargeAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-white border border-violet-300 rounded-xl py-3 pl-8 pr-4 font-bold text-slate-800 focus:ring-2 focus:ring-violet-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Nota opcional */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nota (opcional)</label>
                                <input
                                    type="text"
                                    value={rechargeNote}
                                    onChange={e => setRechargeNote(e.target.value)}
                                    placeholder="Ej. Recarga mensual familia García"
                                    className="w-full bg-white border border-violet-300 rounded-xl py-3 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-violet-500 outline-none"
                                />
                            </div>

                            {canWrite && (
                                <button
                                    onClick={handleRechargeBalance}
                                    disabled={recharging || !rechargeAmount || parseFloat(rechargeAmount) <= 0}
                                    className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl font-bold shadow-md shadow-violet-200 transition-colors disabled:opacity-40"
                                >
                                    <RefreshCw className={`w-4 h-4 ${recharging ? 'animate-spin' : ''}`} />
                                    {recharging ? 'Recargando...' : 'Recargar Saldo'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Columna Derecha: Historial de Facturas ── */}
                <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-500" /> Historial de Facturas
                        </h2>
                        {canWrite && (
                            <button onClick={handleGenerateMonthlyInvoice} disabled={generatingInvoice || !monthlyFee || parseFloat(monthlyFee) <= 0}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-colors disabled:opacity-40">
                                <Plus className="w-4 h-4" />
                                {generatingInvoice ? 'Generando...' : 'Generar factura del mes'}
                            </button>
                        )}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        {loading && (
                            <div className="p-10 text-center text-slate-500 font-bold animate-pulse">Cargando facturas...</div>
                        )}
                        {!loading && invoices.length === 0 && (
                            <div className="p-10 text-center text-slate-500 font-medium">
                                No hay facturas emitidas para este residente.
                            </div>
                        )}
                        {!loading && invoices.length > 0 && (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Factura</th>
                                        <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Mes</th>
                                        <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Total</th>
                                        <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Estado</th>
                                        <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider">F. Pago</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv: any) => (
                                        <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="p-4 font-bold text-slate-700">#{inv.invoiceNumber}</td>
                                            <td className="p-4 text-slate-600">
                                                {new Date(inv.issueDate).toLocaleDateString('es-PR', { month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="p-4 font-black text-slate-800">{formatCurrency(inv.totalAmount)}</td>
                                            <td className="p-4">
                                                {inv.status === 'PAID' && (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs font-black">
                                                        <CheckCircle className="w-3 h-3" /> Pagada
                                                    </span>
                                                )}
                                                {inv.status === 'PENDING' && (
                                                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-xs font-black">
                                                        <Clock className="w-3 h-3" /> Pendiente
                                                    </span>
                                                )}
                                                {inv.status === 'OVERDUE' && (
                                                    <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-xs font-black">
                                                        <AlertCircle className="w-3 h-3" /> Vencida
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-slate-500 text-xs">
                                                {inv.paidAt
                                                    ? new Date(inv.paidAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
