"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Building2, Plus, Pencil, X, Users, Bed, Calendar, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

// Paleta warm
const COLORS = {
    bg: "#fafaf9",
    text: "#1F2D3A",
    teal: "#0F6B78",
    amber: "#E5A93D",
    red: "#D9534F",
    green: "#22A06B",
} as const;

interface HQRow {
    id: string;
    name: string;
    capacity: number;
    isActive: boolean;
    licenseActive: boolean;
    licenseExpiry: string;
    ownerName: string | null;
    ownerEmail: string | null;
    ownerPhone: string | null;
    taxId: string | null;
    subscriptionPlan: string;
    subscriptionStatus: string;
    _count: { patients: number; users: number };
}

interface FormState {
    id?: string;
    name: string;
    capacity: string;
    licenseExpiry: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    taxId: string;
    subscriptionPlan: string;
    isActive: boolean;
}

const BLANK_FORM: FormState = {
    name: "",
    capacity: "50",
    licenseExpiry: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    taxId: "",
    subscriptionPlan: "PRO",
    isActive: true,
};

type Toast = { kind: "success" | "error"; text: string } | null;

export default function SedesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [rows, setRows] = useState<HQRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [form, setForm] = useState<FormState>(BLANK_FORM);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<Toast>(null);

    // Auth guard: DIRECTOR / ADMIN
    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace("/login");
            return;
        }
        if (user.role !== "DIRECTOR" && user.role !== "ADMIN") {
            router.replace("/corporate");
        }
    }, [user, authLoading, router]);

    const fetchRows = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/corporate/headquarters");
            const data = await res.json();
            if (data.success) setRows(data.headquarters || []);
            else showToast("error", data.error || "Error al cargar sedes");
        } catch (err: any) {
            showToast("error", err.message || "Error de red");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user && (user.role === "DIRECTOR" || user.role === "ADMIN")) {
            fetchRows();
        }
    }, [user, fetchRows]);

    function showToast(kind: "success" | "error", text: string) {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 3500);
    }

    function openCreate() {
        setModalMode("create");
        setForm(BLANK_FORM);
        setModalOpen(true);
    }

    function openEdit(row: HQRow) {
        setModalMode("edit");
        setForm({
            id: row.id,
            name: row.name,
            capacity: String(row.capacity),
            licenseExpiry: row.licenseExpiry ? row.licenseExpiry.substring(0, 10) : "",
            ownerName: row.ownerName || "",
            ownerEmail: row.ownerEmail || "",
            ownerPhone: row.ownerPhone || "",
            taxId: row.taxId || "",
            subscriptionPlan: row.subscriptionPlan || "PRO",
            isActive: row.isActive,
        });
        setModalOpen(true);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) return showToast("error", "Nombre requerido");
        if (!form.capacity || parseInt(form.capacity) < 1) return showToast("error", "Capacidad inválida");
        if (!form.licenseExpiry) return showToast("error", "Fecha de licencia requerida");

        setSaving(true);
        try {
            const method = modalMode === "create" ? "POST" : "PATCH";
            const payload: any = {
                name: form.name.trim(),
                capacity: parseInt(form.capacity),
                licenseExpiry: form.licenseExpiry,
                ownerName: form.ownerName.trim() || null,
                ownerEmail: form.ownerEmail.trim() || null,
                ownerPhone: form.ownerPhone.trim() || null,
                taxId: form.taxId.trim() || null,
                subscriptionPlan: form.subscriptionPlan,
            };
            if (modalMode === "edit") {
                payload.id = form.id;
                payload.isActive = form.isActive;
            }
            const res = await fetch("/api/corporate/headquarters", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                showToast("success", modalMode === "create" ? "Sede creada" : "Sede actualizada");
                setModalOpen(false);
                fetchRows();
            } else {
                showToast("error", data.error || "Error al guardar");
            }
        } catch (err: any) {
            showToast("error", err.message || "Error de red");
        } finally {
            setSaving(false);
        }
    }

    function licenseStatus(expiry: string): { label: string; color: string; icon: any } {
        const now = new Date();
        const exp = new Date(expiry);
        const diffDays = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: "Expirada", color: COLORS.red, icon: XCircle };
        if (diffDays <= 30) return { label: `Vence en ${diffDays}d`, color: COLORS.amber, icon: AlertTriangle };
        return { label: "Activa", color: COLORS.green, icon: CheckCircle2 };
    }

    if (authLoading || !user) {
        return (
            <div className="p-10 text-center text-slate-500">Cargando…</div>
        );
    }
    if (user.role !== "DIRECTOR" && user.role !== "ADMIN") {
        return null;
    }

    return (
        <div
            className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ color: COLORS.text }}
        >
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-3" style={{ color: COLORS.text }}>
                        <Building2 className="w-8 h-8" style={{ color: COLORS.teal }} />
                        Gestión de Sedes
                    </h1>
                    <p className="text-slate-500 mt-1 max-w-xl">
                        Crea y edita las sedes (headquarters) del sistema. Estos son los espacios operativos
                        donde viven los residentes y trabaja el staff.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openCreate}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
                        style={{ backgroundColor: COLORS.teal }}
                    >
                        <Plus className="w-4 h-4" /> Nueva Sede
                    </button>
                    <button
                        onClick={() => router.push("/corporate")}
                        className="px-5 py-2.5 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        ← Volver
                    </button>
                </div>
            </div>

            {/* Tabla */}
            <div className="rounded-3xl border border-slate-200 shadow-xl overflow-hidden" style={{ backgroundColor: "#ffffff" }}>
                {loading ? (
                    <div className="p-10 text-center text-slate-500">Cargando sedes…</div>
                ) : rows.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">
                        No hay sedes registradas. Crea la primera con el botón <strong>+ Nueva Sede</strong>.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 text-xs uppercase tracking-widest text-slate-500 font-black" style={{ backgroundColor: COLORS.bg }}>
                                <th className="p-4">Sede</th>
                                <th className="p-4">Capacidad · Residentes</th>
                                <th className="p-4">Staff</th>
                                <th className="p-4">Licencia</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map(row => {
                                const lic = licenseStatus(row.licenseExpiry);
                                const LicIcon = lic.icon;
                                const occupancy = row.capacity > 0
                                    ? Math.round((row._count.patients / row.capacity) * 100)
                                    : 0;
                                return (
                                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                    style={{ backgroundColor: `${COLORS.teal}15`, color: COLORS.teal }}
                                                >
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold" style={{ color: COLORS.text }}>{row.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span
                                                            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                                                            style={{
                                                                backgroundColor: row.isActive ? `${COLORS.green}18` : `${COLORS.red}18`,
                                                                color: row.isActive ? COLORS.green : COLORS.red,
                                                            }}
                                                        >
                                                            {row.isActive ? "Activa" : "Inactiva"}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-mono">{row.subscriptionPlan}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Bed className="w-4 h-4 text-slate-400" />
                                                <span className="font-bold" style={{ color: COLORS.text }}>
                                                    {row._count.patients}
                                                </span>
                                                <span className="text-slate-400">/ {row.capacity}</span>
                                                <span className="text-xs text-slate-500">({occupancy}%)</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Users className="w-4 h-4 text-slate-400" />
                                                <span className="font-bold" style={{ color: COLORS.text }}>{row._count.users}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <LicIcon className="w-4 h-4" style={{ color: lic.color }} />
                                                <div>
                                                    <div
                                                        className="text-xs font-bold uppercase"
                                                        style={{ color: lic.color }}
                                                    >
                                                        {lic.label}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 font-mono">
                                                        {new Date(row.licenseExpiry).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => openEdit(row)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
                                                style={{ color: COLORS.teal }}
                                            >
                                                <Pencil className="w-3.5 h-3.5" /> Editar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal crear/editar */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => !saving && setModalOpen(false)}
                    />
                    <div
                        className="relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200"
                        style={{ backgroundColor: "#ffffff" }}
                    >
                        <div
                            className="p-6 border-b border-slate-100 flex items-center justify-between"
                            style={{ backgroundColor: COLORS.bg }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: `${COLORS.teal}18`, color: COLORS.teal }}
                                >
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold" style={{ color: COLORS.text }}>
                                        {modalMode === "create" ? "Nueva Sede" : "Editar Sede"}
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        {modalMode === "create"
                                            ? "Registra un nuevo hogar en Zendity"
                                            : "Actualiza los datos de esta sede"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => !saving && setModalOpen(false)}
                                disabled={saving}
                                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                            {/* Información del hogar */}
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: COLORS.teal }}>
                                    Información del Hogar
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Nombre de la sede *</label>
                                        <input
                                            required
                                            type="text"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            placeholder="Ej: Vivid Senior Living Mayagüez"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Capacidad *</label>
                                        <input
                                            required
                                            type="number"
                                            min={1}
                                            value={form.capacity}
                                            onChange={e => setForm({ ...form, capacity: e.target.value })}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Licencia */}
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: COLORS.amber }}>
                                    Licencia & Estatus
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">
                                            <Calendar className="inline w-3 h-3 mr-1" />
                                            Vencimiento de licencia *
                                        </label>
                                        <input
                                            required
                                            type="date"
                                            value={form.licenseExpiry}
                                            onChange={e => setForm({ ...form, licenseExpiry: e.target.value })}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                        />
                                    </div>
                                    {modalMode === "edit" && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Sede activa</label>
                                            <button
                                                type="button"
                                                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold flex items-center justify-between hover:bg-slate-50 transition-colors"
                                                style={{ color: form.isActive ? COLORS.green : COLORS.red }}
                                            >
                                                <span>{form.isActive ? "Activa" : "Inactiva"}</span>
                                                <div
                                                    className="w-10 h-5 rounded-full relative transition-colors"
                                                    style={{ backgroundColor: form.isActive ? COLORS.green : "#cbd5e1" }}
                                                >
                                                    <div
                                                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                                                        style={{ left: form.isActive ? "1.375rem" : "0.125rem" }}
                                                    />
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Dueño B2B */}
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: COLORS.teal }}>
                                    Cliente / Dueño B2B
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Nombre del propietario</label>
                                        <input
                                            type="text"
                                            value={form.ownerName}
                                            onChange={e => setForm({ ...form, ownerName: e.target.value })}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Email de contacto</label>
                                        <input
                                            type="email"
                                            value={form.ownerEmail}
                                            onChange={e => setForm({ ...form, ownerEmail: e.target.value })}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Teléfono</label>
                                        <input
                                            type="tel"
                                            value={form.ownerPhone}
                                            onChange={e => setForm({ ...form, ownerPhone: e.target.value })}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Tax ID / EIN</label>
                                        <input
                                            type="text"
                                            value={form.taxId}
                                            onChange={e => setForm({ ...form, taxId: e.target.value })}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Plan */}
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: COLORS.green }}>
                                    Facturación SaaS
                                </h3>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Plan de suscripción</label>
                                    <select
                                        value={form.subscriptionPlan}
                                        onChange={e => setForm({ ...form, subscriptionPlan: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                    >
                                        <option value="LITE">LITE ($299/mes) — eMAR Core</option>
                                        <option value="PRO">PRO ($599/mes) — Operations & Academy</option>
                                        <option value="ENTERPRISE">ENTERPRISE ($999/mes) — CRM + Voz + Family</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md active:scale-95 transition-all disabled:opacity-50"
                                    style={{ backgroundColor: COLORS.teal }}
                                >
                                    {saving
                                        ? "Guardando…"
                                        : modalMode === "create"
                                        ? "Crear sede"
                                        : "Guardar cambios"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div
                    className="fixed bottom-6 right-6 px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold text-white animate-in slide-in-from-bottom-4 duration-200 z-50"
                    style={{
                        backgroundColor: toast.kind === "success" ? COLORS.green : COLORS.red,
                    }}
                >
                    {toast.text}
                </div>
            )}
        </div>
    );
}
