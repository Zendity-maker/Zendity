"use client";

import { useEffect, useState } from "react";
import { FaFileInvoiceDollar, FaDownload, FaCheckCircle, FaExclamationCircle, FaShieldAlt } from "react-icons/fa";
import Link from "next/link";
import { jsPDF } from "jspdf";

export default function FamilyBillingPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Aprovecha la API del Dashboard Familiar (o crearíamos una específica)
        // Por ahora, traemos la info básica del paciente autenticado
        fetch('/api/family/dashboard')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.resident && data.resident.invoices) {
                    setInvoices(data.resident.invoices);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const generatePDF = (invoice: any) => {
        const doc = new jsPDF();

        // Brand Header
        doc.setFontSize(22);
        doc.setTextColor(59, 130, 246); // Blue
        doc.text("Vivid Senior Living Cupey", 20, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("123 Care Street, San Juan, PR", 20, 28);
        doc.text("Tel: (787) 555-1234 | billing@vividcupey.com", 20, 34);

        // Invoice Info
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text("FACTURA DE SERVICIOS", 130, 20);

        doc.setFontSize(10);
        doc.text(`No. Factura: ${invoice.invoiceNumber}`, 130, 28);
        doc.text(`Fecha Emisión: ${new Date(invoice.issueDate).toLocaleDateString()}`, 130, 34);
        doc.text(`Estado: ${invoice.status}`, 130, 40);

        // Line
        doc.setLineWidth(0.5);
        doc.line(20, 48, 190, 48);

        // Resident Info
        doc.setFontSize(12);
        doc.text("Facturado a:", 20, 58);
        doc.setFontSize(10);
        doc.text(`Residente: ${invoice.patient.name}`, 20, 65);

        // Items Table Header
        doc.setFillColor(240, 240, 240);
        doc.rect(20, 80, 170, 10, 'F');
        doc.setFontSize(10);
        doc.text("Descripción", 25, 87);
        doc.text("Cant.", 130, 87);
        doc.text("Total", 160, 87);

        // Items
        let y = 100;
        invoice.items.forEach((item: any) => {
            doc.text(item.description.substring(0, 50), 25, y);
            doc.text(item.quantity.toString(), 133, y);
            doc.text(`$${item.totalPrice.toFixed(2)}`, 160, y);
            y += 10;
        });

        // Line before totals
        doc.line(130, y, 190, y);
        y += 10;

        // Totals
        doc.text("Subtotal:", 130, y);
        doc.text(`$${invoice.subtotal.toFixed(2)}`, 160, y);
        y += 8;
        doc.text("Impuesto (IVU):", 130, y);
        doc.text(`$${(invoice.taxRate * invoice.subtotal).toFixed(2)}`, 160, y);
        y += 8;

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL DUE:", 130, y);
        doc.text(`$${invoice.totalAmount.toFixed(2)}`, 160, y);

        // Footer note
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text(invoice.notes || "Gracias por confiar en Zendity Care.", 20, 280);

        doc.save(`${invoice.invoiceNumber}_VividCupey.pdf`);
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <FaFileInvoiceDollar className="text-indigo-500" /> Facturación y Pagos
                </h1>
                <p className="text-slate-500 mt-1 font-medium">Buzón histórico de tus recibos y cuentas claras.</p>
            </div>

            {/* List */}
            <div className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FaShieldAlt className="text-emerald-500" /> Transacciones Seguras
                    </h3>
                </div>

                <div className="p-6">
                    {invoices.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 italic">No hay historial de facturación disponible para tu familiar.</div>
                    ) : (
                        <div className="space-y-4">
                            {invoices.map((inv) => (
                                <div key={inv.id} className="flex flex-col md:flex-row items-center justify-between p-5 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors bg-white">
                                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                                            {inv.status === 'PAID' ? <FaCheckCircle /> : <FaExclamationCircle />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{new Date(inv.issueDate).toLocaleDateString('es-PR', { month: 'long', year: 'numeric' })}</p>
                                            <h4 className="text-lg font-black text-slate-800">{inv.invoiceNumber}</h4>
                                            {inv.status === 'PENDING' && <p className="text-xs text-amber-600 font-bold mt-1">Vence: {new Date(inv.dueDate).toLocaleDateString()}</p>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-400 uppercase">Monto</p>
                                            <p className="text-xl font-black text-slate-800">${inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <button
                                            onClick={() => generatePDF(inv)}
                                            className="w-12 h-12 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl flex items-center justify-center transition-all border border-indigo-100 shadow-sm"
                                            title="Descargar Factura PDF"
                                        >
                                            <FaDownload />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
