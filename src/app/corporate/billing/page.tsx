"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FileText, Plus, CheckCircle, Clock, AlertCircle, Loader2, Banknote, DollarSign } from "lucide-react";

type Patient = {
    id: string;
    name: string;
    roomNumber: string | null;
};

type InvoiceItem = {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
};

type Invoice = {
    id: string;
    invoiceNumber: string;
    subtotal: number;
    taxRate: number;
    totalAmount: number;
    status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
    issueDate: string;
    dueDate: string;
    patient: Patient;
    items: InvoiceItem[];
    headquarters?: {
        name: string;
        logoUrl: string | null;
    };
};

export default function BillingDashboard() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [totalPending, setTotalPending] = useState(0);
    const [totalPaid, setTotalPaid] = useState(0);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { data: session } = useSession();
    const hqName = (session?.user as any)?.headquartersName || "Zendity HQ";

    // Modal nueva factura
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [viewPdfInvoice, setViewPdfInvoice] = useState<Invoice | null>(null);

    // Modal pago
    const [payModalInvoice, setPayModalInvoice] = useState<Invoice | null>(null);
    const [payMethod, setPayMethod] = useState("ACH");
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
    const [payRef, setPayRef] = useState("");
    const [payAmount, setPayAmount] = useState("");
    const [isPaySubmitting, setIsPaySubmitting] = useState(false);

    // New Invoice Form State
    const [selectedPatientId, setSelectedPatientId] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<{ description: string, quantity: number, unitPrice: number }[]>([
        { description: "Mensualidad Base", quantity: 1, unitPrice: 0 }
    ]);

    useEffect(() => {
        fetchData();
        // Set default due date to 5 days from now
        const defaultDue = new Date();
        defaultDue.setDate(defaultDue.getDate() + 5);
        setDueDate(defaultDue.toISOString().split('T')[0]);
    }, []);

    const fetchData = async () => {
        try {
            const timestamp = new Date().getTime();
            const res = await fetch(`/api/corporate/billing?t=${timestamp}`, { cache: "no-store", headers: { 'Cache-Control': 'no-cache' } });
            if (res.ok) {
                const data = await res.json();
                setInvoices(data.invoices || []);
                setPatients(data.patients || []);
                setTotalPending(data.totalPending || 0);
                setTotalPaid(data.totalPaid || 0);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = () => {
        setItems([...items, { description: "", quantity: 1, unitPrice: 0 }]);
    };

    const handleItemChange = (index: number, field: string, value: string | number) => {
        const newItems = [...items];
        (newItems as any)[index][field] = value;
        setItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch("/api/corporate/billing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: selectedPatientId,
                    dueDate,
                    notes,
                    items
                })
            });

            if (res.ok) {
                setIsModalOpen(false);
                setSelectedPatientId("");
                setItems([{ description: "Mensualidad Base", quantity: 1, unitPrice: 0 }]);
                fetchData();
            } else {
                alert("Error al emitir factura");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const openPayModal = (invoice: Invoice) => {
        setPayModalInvoice(invoice);
        setPayMethod("ACH");
        setPayDate(new Date().toISOString().split('T')[0]);
        setPayRef("");
        setPayAmount(invoice.totalAmount.toString());
    };

    const handleConfirmPay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payModalInvoice) return;
        setIsPaySubmitting(true);
        try {
            const res = await fetch(`/api/corporate/billing/${payModalInvoice.id}/pay`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paymentMethod: payMethod,
                    paidAt: payDate,
                    referenceNumber: payRef || undefined,
                    amount: parseFloat(payAmount) || payModalInvoice.totalAmount,
                })
            });
            const data = await res.json();
            if (data.success) {
                setPayModalInvoice(null);
                await fetchData();
                router.refresh();
            } else {
                alert(`Error: ${data.error || 'Desconocido'}`);
            }
        } catch (err: any) {
            alert(`Error de conexión: ${err.message}`);
        } finally {
            setIsPaySubmitting(false);
        }
    };

    const calculateSubtotal = () => {
        return items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <Banknote className="w-8 h-8 text-emerald-600" />
                        Facturación y Cobranza
                    </h1>
                    <p className="text-slate-500 mt-2">Control de ingresos, emisión de recibos y conciliación.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Emitir Recibo
                </button>
            </div>

            {/* Widgets Financieros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Pagos Pendientes</p>
                        <h2 className="text-4xl font-black text-rose-600">
                            ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </h2>
                    </div>
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
                        <Clock className="w-8 h-8" />
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Ingresos Cobrados</p>
                        <h2 className="text-4xl font-black text-emerald-600">
                            ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </h2>
                    </div>
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500">
                        <CheckCircle className="w-8 h-8" />
                    </div>
                </div>
            </div>

            {/* Tabla de Facturas */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="p-5 text-sm font-bold text-slate-500">Recibo</th>
                                <th className="p-5 text-sm font-bold text-slate-500">Residente</th>
                                <th className="p-5 text-sm font-bold text-slate-500">Emisión / Vencimiento</th>
                                <th className="p-5 text-sm font-bold text-slate-500">Total</th>
                                <th className="p-5 text-sm font-bold text-slate-500">Estado</th>
                                <th className="p-5 text-sm font-bold text-slate-500 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                                        Calculando contabilidad...
                                    </td>
                                </tr>
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                                        No hay recibos generados aún. Haz clic en "Emitir Recibo" para comenzar.
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((invoice) => (
                                    <tr key={invoice.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <td className="p-5">
                                            <p className="font-bold text-slate-900">{invoice.invoiceNumber}</p>
                                            <p className="text-xs text-slate-500 font-medium mt-1">{invoice.items.length} Conceptos</p>
                                        </td>
                                        <td className="p-5">
                                            <p className="font-bold text-slate-800">{invoice.patient.name}</p>
                                            <p className="text-xs text-slate-500">Cuarto {invoice.patient.roomNumber || 'N/A'}</p>
                                        </td>
                                        <td className="p-5 text-sm">
                                            <p className="text-slate-600">Emi: {format(new Date(invoice.issueDate), 'dd MMM yyyy', { locale: es })}</p>
                                            <p className="text-slate-500 text-xs mt-0.5">Vence: {format(new Date(invoice.dueDate), 'dd MMM yyyy', { locale: es })}</p>
                                        </td>
                                        <td className="p-5">
                                            <p className="font-black text-slate-800 text-lg">
                                                ${invoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </p>
                                        </td>
                                        <td className="p-5">
                                            {invoice.status === 'PAID' && (
                                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center w-fit gap-1.5 border border-emerald-200">
                                                    <CheckCircle className="w-3.5 h-3.5" /> Pagado
                                                </span>
                                            )}
                                            {invoice.status === 'PENDING' && (
                                                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center w-fit gap-1.5 border border-amber-200">
                                                    <Clock className="w-3.5 h-3.5" /> Pendiente
                                                </span>
                                            )}
                                            {invoice.status === 'OVERDUE' && (
                                                <span className="bg-rose-100 text-rose-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center w-fit gap-1.5 border border-rose-200">
                                                    <AlertCircle className="w-3.5 h-3.5" /> Vencido
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-5 text-right">
                                            {invoice.status !== 'PAID' ? (
                                                <button
                                                    onClick={() => openPayModal(invoice)}
                                                    className="bg-white border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center gap-2 ml-auto"
                                                >
                                                    <DollarSign className="w-4 h-4" /> Marcar Pagado
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setViewPdfInvoice(invoice)}
                                                    className="text-slate-500 hover:text-slate-600 text-sm font-bold flex items-center justify-end w-full gap-2 transition-colors"
                                                >
                                                    <FileText className="w-4 h-4" /> PDF
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Nueva Factura */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <FileText className="w-6 h-6 text-emerald-600" />
                                Emitir Nuevo Recibo
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-600 font-bold p-2"></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">

                            {/* Residente y Fechas */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Residente a Facturar</label>
                                    <select
                                        value={selectedPatientId}
                                        onChange={e => setSelectedPatientId(e.target.value)}
                                        className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-500 font-medium text-slate-800"
                                    >
                                        <option value="">Selecciona un residente activo...</option>
                                        {patients.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} {p.roomNumber ? `(Cuarto ${p.roomNumber})` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Vencimiento Límite</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-500 font-medium text-slate-800"
                                    />
                                </div>
                            </div>

                            {/* Line Items */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-sm font-bold text-slate-700">Conceptos a Cobrar</label>
                                    <button type="button" onClick={handleAddItem} className="text-sm text-emerald-600 font-bold flex items-center gap-1 hover:text-emerald-700">
                                        + Agregar Concepto
                                    </button>
                                </div>

                                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                                    {items.map((item, index) => (
                                        <div key={index} className="flex gap-2 items-start">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="Descripción del cargo"
                                                    value={item.description}
                                                    onChange={e => handleItemChange(index, "description", e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-800"
                                                />
                                            </div>
                                            <div className="w-20">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={e => handleItemChange(index, "quantity", parseInt(e.target.value))}
                                                    className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-800"
                                                />
                                            </div>
                                            <div className="w-32 relative">
                                                <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.unitPrice}
                                                    onChange={e => handleItemChange(index, "unitPrice", parseFloat(e.target.value))}
                                                    className="w-full pl-7 pr-3 py-2 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-800"
                                                />
                                            </div>
                                            {items.length > 1 && (
                                                <button onClick={() => handleRemoveItem(index)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"></button>
                                            )}
                                        </div>
                                    ))}

                                    <div className="border-t border-slate-200 pt-3 mt-4 text-right">
                                        <p className="text-slate-500 font-medium text-sm">Total Estimado</p>
                                        <p className="text-2xl font-black text-emerald-600">${calculateSubtotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-white">
                            <button
                                onClick={handleCreateInvoice}
                                disabled={isSubmitting || !selectedPatientId}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isSubmitting ? "Emitiendo..." : "Emitir y Guardar Recibo"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Registrar Pago */}
            {payModalInvoice && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <DollarSign className="w-6 h-6 text-emerald-600" />
                                Registrar Pago
                            </h2>
                            <button onClick={() => setPayModalInvoice(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-lg">✕</button>
                        </div>

                        <form onSubmit={handleConfirmPay} className="p-6 space-y-5">
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Factura</p>
                                <p className="font-bold text-slate-800">{payModalInvoice.invoiceNumber} — {payModalInvoice.patient.name}</p>
                                <p className="text-2xl font-black text-emerald-600 mt-1">
                                    ${payModalInvoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Método de Pago</label>
                                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} required
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 font-semibold text-slate-800 focus:border-emerald-500 outline-none">
                                    <option value="ACH">ACH — Débito Automático</option>
                                    <option value="CHECK">Cheque</option>
                                    <option value="WIRE">Transferencia Bancaria</option>
                                    <option value="CASH">Efectivo</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Pago</label>
                                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 font-medium text-slate-800 focus:border-emerald-500 outline-none" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Número de Referencia <span className="text-slate-300 font-normal normal-case">(opcional)</span></label>
                                <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)}
                                    placeholder="# Cheque, confirmación ACH…"
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 font-medium text-slate-800 focus:border-emerald-500 outline-none" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto Recibido</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3.5 text-slate-400 font-bold">$</span>
                                    <input type="number" min="0.01" step="0.01" value={payAmount}
                                        onChange={e => setPayAmount(e.target.value)} required
                                        className="w-full border-2 border-slate-200 rounded-xl py-3 pl-8 pr-4 font-bold text-slate-800 focus:border-emerald-500 outline-none" />
                                </div>
                            </div>

                            <div className="pt-2 space-y-2">
                                <button type="submit" disabled={isPaySubmitting}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                                    {isPaySubmitting ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
                                    ) : (
                                        <><CheckCircle className="w-5 h-5" /> Confirmar y Enviar Recibo</>
                                    )}
                                </button>
                                <button type="button" onClick={() => setPayModalInvoice(null)}
                                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors">
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Visor de PDF Ficticio */}
            {viewPdfInvoice && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
                        <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> Visor de Recibo PDF</h3>
                            <div className="flex gap-4">
                                <button className="text-slate-500 hover:text-white font-bold text-sm" onClick={() => window.print()}> Imprimir</button>
                                <button onClick={() => setViewPdfInvoice(null)} className="text-slate-500 hover:text-white font-bold"> Cerrar</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-12 bg-slate-100 flex justify-center">
                            <div className="bg-white p-12 w-full max-w-2xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-12 border-b border-slate-200 pb-8">
                                    <div className="flex flex-col items-start">
                                        {viewPdfInvoice.headquarters?.logoUrl && (
                                            <img src={viewPdfInvoice.headquarters.logoUrl} alt="Logo" className="h-12 object-contain mb-4" />
                                        )}
                                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">RECIBO</h1>
                                        <p className="text-slate-500 font-medium mt-1 uppercase tracking-wider text-sm">{viewPdfInvoice.headquarters?.name || hqName}</p>
                                    </div>
                                    <div className="text-right text-sm text-slate-600">
                                        <p><span className="font-bold text-slate-800">Factura:</span> {viewPdfInvoice.invoiceNumber}</p>
                                        <p><span className="font-bold text-slate-800">Fecha:</span> {format(new Date(viewPdfInvoice.issueDate), 'dd/MM/yyyy')}</p>
                                        <p><span className="font-bold text-slate-800">Estado:</span> <span className="text-emerald-600 font-bold">PAGADO</span></p>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Facturado a</p>
                                    <p className="text-lg font-bold text-slate-800">{viewPdfInvoice.patient.name}</p>
                                    <p className="text-slate-600">Residente - Cuarto {viewPdfInvoice.patient.roomNumber || 'N/A'}</p>
                                </div>

                                <table className="w-full mb-8 text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-slate-800 text-left">
                                            <th className="py-3 font-bold text-slate-800">Descripción</th>
                                            <th className="py-3 font-bold text-slate-800 text-center">Cant.</th>
                                            <th className="py-3 font-bold text-slate-800 text-right">Precio Unit.</th>
                                            <th className="py-3 font-bold text-slate-800 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewPdfInvoice.items.map((item) => (
                                            <tr key={item.id} className="border-b border-slate-100">
                                                <td className="py-4 text-slate-700 font-medium">{item.description}</td>
                                                <td className="py-4 text-slate-700 text-center">{item.quantity}</td>
                                                <td className="py-4 text-slate-700 text-right">${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                <td className="py-4 text-slate-900 font-bold text-right">${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="flex justify-end pt-4 border-t-2 border-slate-800">
                                    <div className="w-64">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-slate-600 font-bold">Subtotal</span>
                                            <span className="text-slate-800 font-medium">${viewPdfInvoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between mb-4">
                                            <span className="text-slate-600 font-bold">Impuestos</span>
                                            <span className="text-slate-800 font-medium">${(viewPdfInvoice.subtotal * viewPdfInvoice.taxRate).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-4 border-t border-slate-200">
                                            <span className="text-slate-900 font-black text-lg">Total Pagado</span>
                                            <span className="text-emerald-600 font-black text-2xl">${viewPdfInvoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-16 text-center text-sm text-slate-500 border-t border-slate-100 pt-8">
                                    Este recibo ha sido liquidado en su totalidad. Generado en {hqName}.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
