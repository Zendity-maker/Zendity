"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import TaskAssignmentButton from "@/components/TaskAssignmentButton";

interface HQDocument {
    id: string;
    headquarters: { name: string };
    type: string;
    name: string;
    expirationDate: string;
    fileUrl: string;
    status: "ACTIVE" | "WARNING" | "EXPIRED";
}

export default function ZendityHQPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [documents, setDocuments] = useState<HQDocument[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states para simulador de subida
    const [docName, setDocName] = useState("");
    const [docType, setDocType] = useState("LICENSE");
    const [expDate, setExpDate] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Branding states
    const [logoUrl, setLogoUrl] = useState("");
    const [savingBranding, setSavingBranding] = useState(false);

    useEffect(() => {
        fetchDocs();
        fetchBranding();
    }, []);

    const fetchBranding = async () => {
        try {
            const res = await fetch("/api/corporate/hq/branding");
            const data = await res.json();
            if (data.success && data.hq?.logoUrl) setLogoUrl(data.hq.logoUrl);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSaveBranding = async () => {
        setSavingBranding(true);
        try {
            const res = await fetch("/api/corporate/hq/branding", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logoUrl })
            });
            const data = await res.json();
            if (data.success) {
                alert("Branding actualizado exitosamente.");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSavingBranding(false);
        }
    };

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/corporate/hq");
            const data = await res.json();
            if (data.success) setDocuments(data.documents);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docName || !expDate) return;
        setSubmitting(true);

        try {
            const res = await fetch("/api/corporate/hq", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: docName, type: docType, expirationDate: expDate }),
            });
            const data = await res.json();
            if (data.success) {
                setDocName("");
                setExpDate("");
                fetchDocs(); // Refresh
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "ACTIVE":
                return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200"> Vigente</span>;
            case "WARNING":
                return <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-200 animate-pulse"> Próximo a Vencer (&lt;30 días)</span>;
            case "EXPIRED":
                return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold border border-red-200"> Expirado</span>;
            default:
                return <span>{status}</span>;
        }
    };

    if (loading) return <div className="p-10 font-bold text-center text-teal-600 animate-pulse">Cargando Bóveda Corporativa...</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <span className="text-4xl"></span> Zendity HQ
                    </h1>
                    <p className="text-slate-500 mt-1 max-w-xl">
                        Bóveda de Cumplimiento Legal y Corporativo. Gestione las licencias del Departamento de la Familia, permisos de bomberos y seguros corporativos.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <TaskAssignmentButton user={user} buttonStyle="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-xl text-sm font-bold transition-colors flex items-center gap-2" />
                    <button onClick={() => router.push('/corporate')} className="px-5 py-2.5 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-teal-700 transition-colors">
                        ← Volver al Dashboard
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Panel Izquierdo: Formulario de Subida */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl">
                        <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">Anexar Documento</h2>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nombre del Documento</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Licencia Sanitaria 2026"
                                    className="w-full border-slate-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 bg-slate-50"
                                    value={docName}
                                    onChange={(e) => setDocName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Registro</label>
                                <select
                                    className="w-full border-slate-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 bg-slate-50"
                                    value={docType}
                                    onChange={(e) => setDocType(e.target.value)}
                                >
                                    <option value="LICENSE">Licencia Administrativa</option>
                                    <option value="PERMIT">Permiso de Operación</option>
                                    <option value="INSURANCE">Póliza de Seguros</option>
                                    <option value="OTHER">Otro Documento Legal</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Fecha de Expiración</label>
                                <input
                                    type="date"
                                    className="w-full border-slate-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 bg-slate-50"
                                    value={expDate}
                                    onChange={(e) => setExpDate(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Fake File Input UI */}
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 cursor-pointer transition-colors">
                                <p className="text-2xl mb-1"></p>
                                <p className="text-xs font-bold text-teal-600">Click para adjuntar PDF</p>
                                <p className="text-[10px] text-slate-400 mt-1">Soporta PDF, JPG (Max 5MB)</p>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-lg hover:shadow-teal-500/20 active:scale-95 transition-all"
                            >
                                {submitting ? 'Subiendo Bóveda...' : 'Custodiar Documento'}
                            </button>
                        </form>
                    </div>

                    {/* Branding Panel */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl">
                        <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
                             Zendity Branding
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Logo URL (Marca Blanca)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: /vivid-logo.png o https://..."
                                    className="w-full border-slate-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 bg-slate-50 text-sm"
                                    value={logoUrl}
                                    onChange={(e) => setLogoUrl(e.target.value)}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Este logo reemplazará a Zendity en el Portal Familiar B2C.</p>
                            </div>

                            {logoUrl && (
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-center items-center h-24">
                                    <img src={logoUrl} alt="Preview Logo" className="max-h-full object-contain" />
                                </div>
                            )}

                            <button
                                onClick={handleSaveBranding}
                                disabled={savingBranding}
                                className="w-full py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl shadow-md active:scale-95 transition-all text-sm"
                            >
                                {savingBranding ? 'Guardando...' : 'Aplicar Marca'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Panel Derecho: Listado de Documentos y Alertas */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                        <div className="bg-slate-900 p-5 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-xl font-bold">Inventario Documental</h2>
                                <p className="text-xs text-slate-400">Archivos oficiales de la Sede</p>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
                        </div>

                        <div className="p-0">
                            {documents.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 font-medium">
                                    No hay documentos en la bóveda de esta sede. Sube el primer registro.
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-widest text-slate-500 font-black">
                                            <th className="p-4">Documento</th>
                                            <th className="p-4">Sede HQ</th>
                                            <th className="p-4">Expira</th>
                                            <th className="p-4 text-right">Estatus Legal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {documents.map(doc => (
                                            <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-2xl">
                                                            {doc.type === 'LICENSE' ? '' : doc.type === 'INSURANCE' ? '' : ''}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800">{doc.name}</p>
                                                            <p className="text-[10px] uppercase font-bold text-slate-400">{doc.type}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm font-medium text-slate-600">{doc.headquarters.name}</td>
                                                <td className="p-4 text-sm font-mono text-slate-500">
                                                    {new Date(doc.expirationDate).toLocaleDateString()}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {getStatusBadge(doc.status)}
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
        </div>
    );
}
