"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Settings, Plus, Edit2, Trash2, ChevronLeft, Loader2, Copy, Check, X, Tablet, MapPin, Clock, ExternalLink, QrCode } from "lucide-react";
import QRCodeDisplay from "@/components/ui/QRCodeDisplay";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Tab = 'categories' | 'providers' | 'devices';

interface Category {
    id: string;
    name: string;
    icon: string | null;
    displayOrder: number;
    isActive: boolean;
    _count: { providers: number };
}
interface Provider {
    id: string;
    name: string;
    categoryId: string;
    contactPhone: string | null;
    contactEmail: string | null;
    notes: string | null;
    isActive: boolean;
    category: { id: string; name: string; icon: string | null };
}
interface Device {
    id: string;
    floorNumber: number;
    label: string;
    isActive: boolean;
    lastSeenAt: string | null;
    createdAt: string;
    revokedAt: string | null;
}

export default function AdminExternalServicesPage() {
    const [tab, setTab] = useState<Tab>('categories');
    const [categories, setCategories] = useState<Category[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    // Modal estados
    const [editCat, setEditCat] = useState<Partial<Category> & { mode: 'create' | 'edit' } | null>(null);
    const [editProv, setEditProv] = useState<Partial<Provider> & { mode: 'create' | 'edit' } | null>(null);
    const [newDeviceModal, setNewDeviceModal] = useState(false);
    const [newDeviceResult, setNewDeviceResult] = useState<{ setupUrl: string; deviceToken: string; label: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Sprint B — ConfirmDialog: eliminar proveedor (destructivo, async).
    const [confirmDeleteProv, setConfirmDeleteProv] = useState<{ id: string; name: string } | null>(null);

    const fetchAll = useCallback(async () => {
        const [c, p, d] = await Promise.all([
            fetch('/api/admin/external-services/categories', { cache: 'no-store' }).then(r => r.json()),
            fetch('/api/admin/external-services/providers', { cache: 'no-store' }).then(r => r.json()),
            fetch('/api/admin/external-kiosk/devices', { cache: 'no-store' }).then(r => r.json()),
        ]);
        if (c.success) setCategories(c.categories);
        if (p.success) setProviders(p.providers);
        if (d.success) setDevices(d.devices);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    // ──────── Categorías
    const saveCat = async () => {
        if (!editCat) return;
        setSubmitting(true);
        try {
            const isCreate = editCat.mode === 'create';
            const res = await fetch(
                isCreate ? '/api/admin/external-services/categories' : `/api/admin/external-services/categories/${editCat.id}`,
                {
                    method: isCreate ? 'POST' : 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: editCat.name,
                        icon: editCat.icon || null,
                        displayOrder: editCat.displayOrder ?? 999,
                        ...(isCreate ? {} : { isActive: editCat.isActive }),
                    }),
                }
            );
            const data = await res.json();
            if (data.success) {
                setToast({ msg: isCreate ? 'Categoría creada' : 'Categoría actualizada', type: 'ok' });
                setEditCat(null);
                fetchAll();
            } else setToast({ msg: data.error || 'Error', type: 'err' });
        } finally { setSubmitting(false); }
    };

    const deleteCat = async (id: string) => {
        if (!confirm('¿Eliminar esta categoría? No se puede deshacer.')) return;
        const res = await fetch(`/api/admin/external-services/categories/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { setToast({ msg: 'Categoría eliminada', type: 'ok' }); fetchAll(); }
        else setToast({ msg: data.error || 'Error', type: 'err' });
    };

    // ──────── Providers
    const saveProv = async () => {
        if (!editProv) return;
        setSubmitting(true);
        try {
            const isCreate = editProv.mode === 'create';
            const res = await fetch(
                isCreate ? '/api/admin/external-services/providers' : `/api/admin/external-services/providers/${editProv.id}`,
                {
                    method: isCreate ? 'POST' : 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: editProv.name,
                        categoryId: editProv.categoryId,
                        contactPhone: editProv.contactPhone || null,
                        contactEmail: editProv.contactEmail || null,
                        notes: editProv.notes || null,
                        ...(isCreate ? {} : { isActive: editProv.isActive }),
                    }),
                }
            );
            const data = await res.json();
            if (data.success) {
                setToast({ msg: isCreate ? 'Proveedor creado' : 'Proveedor actualizado', type: 'ok' });
                setEditProv(null);
                fetchAll();
            } else setToast({ msg: data.error || 'Error', type: 'err' });
        } finally { setSubmitting(false); }
    };

    const performDeleteProv = async () => {
        if (!confirmDeleteProv) return;
        const id = confirmDeleteProv.id;
        const res = await fetch(`/api/admin/external-services/providers/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            setToast({ msg: 'Proveedor eliminado', type: 'ok' });
            setConfirmDeleteProv(null);
            fetchAll();
        } else {
            // ConfirmDialog deja el modal abierto en error; el toast comunica el motivo.
            setToast({ msg: data.error || 'Error eliminando proveedor', type: 'err' });
            throw new Error(data.error || 'Error eliminando proveedor');
        }
    };

    // ──────── Devices
    const createDevice = async (floorNumber: number, label: string) => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/external-kiosk/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ floorNumber, label }),
            });
            const data = await res.json();
            if (data.success) {
                setNewDeviceModal(false);
                setNewDeviceResult({ setupUrl: data.setupUrl, deviceToken: data.deviceToken, label });
                fetchAll();
            } else setToast({ msg: data.error || 'Error', type: 'err' });
        } finally { setSubmitting(false); }
    };

    const revokeDevice = async (id: string, label: string) => {
        if (!confirm(`¿Revocar "${label}"? La tablet dejará de funcionar inmediatamente.`)) return;
        const res = await fetch(`/api/admin/external-kiosk/devices/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { setToast({ msg: 'Tablet revocada', type: 'ok' }); fetchAll(); }
        else setToast({ msg: data.error || 'Error', type: 'err' });
    };

    // Re-expone el QR/URL de una tablet PRE-USO (lastSeenAt === null).
    // El endpoint rechaza 410 si ya se conectó alguna vez — abrimos toast
    // de error en ese caso. Reusa el modal `newDeviceResult` con los datos
    // que devuelva el servidor (sin re-fetch del listado).
    const revealToken = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/external-kiosk/devices/${id}/token`);
            const data = await res.json();
            if (data.success) {
                setNewDeviceResult({
                    setupUrl: data.setupUrl,
                    deviceToken: data.deviceToken,
                    label: data.label,
                });
            } else {
                setToast({ msg: data.error || 'No se pudo obtener el QR', type: 'err' });
            }
        } catch {
            setToast({ msg: 'Error de conexión', type: 'err' });
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-teal-600" /></div>;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-6 py-8">
                <Link href="/corporate/external-services" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-teal-700 mb-3">
                    <ChevronLeft className="w-4 h-4" /> Volver al dashboard
                </Link>
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-700 flex items-center justify-center">
                        <Settings className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">Admin · Servicios Externos</h1>
                        <p className="text-sm text-slate-500">Gestiona el catálogo de proveedores y las tablets de los pisos</p>
                    </div>
                </div>

                <div className="flex gap-1 mb-6 border-b border-slate-200">
                    <TabBtn active={tab === 'categories'} onClick={() => setTab('categories')} label={`Categorías (${categories.length})`} />
                    <TabBtn active={tab === 'providers'} onClick={() => setTab('providers')} label={`Proveedores (${providers.length})`} />
                    <TabBtn active={tab === 'devices'} onClick={() => setTab('devices')} label={`Tablets (${devices.length})`} />
                </div>

                {tab === 'categories' && (
                    <div>
                        <div className="flex justify-end mb-4">
                            <button onClick={() => setEditCat({ mode: 'create', name: '', icon: '', displayOrder: 999 })} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition">
                                <Plus className="w-4 h-4" /> Nueva categoría
                            </button>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr><Th>Orden</Th><Th>Icono</Th><Th>Nombre</Th><Th>Proveedores</Th><Th>Estado</Th><Th>Acciones</Th></tr>
                                </thead>
                                <tbody>
                                    {categories.map(c => (
                                        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <Td>{c.displayOrder}</Td>
                                            <Td><span className="text-2xl">{c.icon || '—'}</span></Td>
                                            <Td><span className="font-bold text-slate-800">{c.name}</span></Td>
                                            <Td>{c._count.providers}</Td>
                                            <Td>{c.isActive ? <span className="text-xs font-black text-emerald-700">ACTIVA</span> : <span className="text-xs font-black text-slate-400">INACTIVA</span>}</Td>
                                            <Td>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setEditCat({ ...c, mode: 'edit' })} className="p-2 rounded-lg hover:bg-slate-200 transition"><Edit2 className="w-4 h-4 text-slate-600" /></button>
                                                    <button onClick={() => deleteCat(c.id)} className="p-2 rounded-lg hover:bg-rose-100 transition"><Trash2 className="w-4 h-4 text-rose-600" /></button>
                                                </div>
                                            </Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'providers' && (
                    <div>
                        <div className="flex justify-end mb-4">
                            <button onClick={() => setEditProv({ mode: 'create', name: '', categoryId: categories[0]?.id })} disabled={categories.length === 0} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50">
                                <Plus className="w-4 h-4" /> Nuevo proveedor
                            </button>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr><Th>Categoría</Th><Th>Nombre</Th><Th>Contacto</Th><Th>Estado</Th><Th>Acciones</Th></tr>
                                </thead>
                                <tbody>
                                    {providers.map(p => (
                                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <Td><span className="text-sm text-slate-500">{p.category.icon || ''} {p.category.name}</span></Td>
                                            <Td><span className="font-bold text-slate-800">{p.name}</span></Td>
                                            <Td><span className="text-xs text-slate-500">{p.contactPhone || p.contactEmail || '—'}</span></Td>
                                            <Td>{p.isActive ? <span className="text-xs font-black text-emerald-700">ACTIVO</span> : <span className="text-xs font-black text-slate-400">INACTIVO</span>}</Td>
                                            <Td>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setEditProv({ ...p, mode: 'edit' })} className="p-2 rounded-lg hover:bg-slate-200 transition"><Edit2 className="w-4 h-4 text-slate-600" /></button>
                                                    <button onClick={() => setConfirmDeleteProv({ id: p.id, name: p.name })} className="p-2 rounded-lg hover:bg-rose-100 transition"><Trash2 className="w-4 h-4 text-rose-600" /></button>
                                                </div>
                                            </Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'devices' && (
                    <div>
                        <div className="flex justify-end mb-4">
                            <button onClick={() => setNewDeviceModal(true)} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition">
                                <Plus className="w-4 h-4" /> Generar nueva tablet
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {devices.length === 0 && (
                                <div className="col-span-full bg-white rounded-2xl p-10 text-center text-slate-500 border border-dashed border-slate-300">
                                    Aún no hay tablets configuradas. Genera una para empezar.
                                </div>
                            )}
                            {devices.map(d => {
                                const lastSeen = d.lastSeenAt ? new Date(d.lastSeenAt) : null;
                                const minsSinceLastSeen = lastSeen ? Math.floor((Date.now() - lastSeen.getTime()) / 60000) : null;
                                const isStale = minsSinceLastSeen !== null && minsSinceLastSeen > 30;
                                return (
                                    <div key={d.id} className={`bg-white rounded-2xl p-5 border ${d.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'} shadow-sm`}>
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${d.isActive ? 'bg-teal-100' : 'bg-slate-100'}`}>
                                                    <Tablet className={`w-6 h-6 ${d.isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-slate-900">{d.label}</h3>
                                                    <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Piso {d.floorNumber}</p>
                                                </div>
                                            </div>
                                            {d.isActive ? <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">ACTIVA</span> : <span className="text-xs font-black text-rose-700 bg-rose-100 px-2 py-1 rounded-lg">REVOCADA</span>}
                                        </div>
                                        <div className="text-xs text-slate-500 space-y-1 mb-3">
                                            <p className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {lastSeen ? (
                                                    isStale
                                                        ? <span className="text-amber-700">Hace {minsSinceLastSeen} min · podría estar apagada</span>
                                                        : <span className="text-emerald-700">Activa hace {minsSinceLastSeen} min</span>
                                                ) : 'Nunca conectada'}
                                            </p>
                                            <p>Creada: {new Date(d.createdAt).toLocaleDateString('es-PR')}</p>
                                            {d.revokedAt && <p>Revocada: {new Date(d.revokedAt).toLocaleDateString('es-PR')}</p>}
                                        </div>
                                        {d.isActive && (
                                            <div className="space-y-2">
                                                {/* Solo se puede re-ver el QR de tablets PRE-USO (nunca conectadas).
                                                    Una vez que la tablet pinguea, el endpoint /token responde 410
                                                    y este botón desaparece — el token queda enterrado por seguridad. */}
                                                {lastSeen === null && (
                                                    <button
                                                        onClick={() => revealToken(d.id)}
                                                        className="w-full text-sm font-bold text-[var(--color-zendity-teal)] hover:bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl transition flex items-center justify-center gap-2"
                                                    >
                                                        <QrCode className="w-4 h-4" /> Mostrar QR para configurar
                                                    </button>
                                                )}
                                                <button onClick={() => revokeDevice(d.id, d.label)} className="w-full text-sm font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl transition">
                                                    Revocar tablet
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: edit/create categoría */}
            {editCat && (
                <Modal title={editCat.mode === 'create' ? 'Nueva categoría' : 'Editar categoría'} onClose={() => setEditCat(null)}>
                    <Field label="Nombre">
                        <input type="text" value={editCat.name || ''} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })} className="input" />
                    </Field>
                    <Field label="Icono (emoji corto)">
                        <input type="text" value={editCat.icon || ''} onChange={(e) => setEditCat({ ...editCat, icon: e.target.value })} placeholder="🏥" className="input" />
                    </Field>
                    <Field label="Orden">
                        <input type="number" value={editCat.displayOrder ?? 999} onChange={(e) => setEditCat({ ...editCat, displayOrder: parseInt(e.target.value, 10) || 999 })} className="input" />
                    </Field>
                    {editCat.mode === 'edit' && (
                        <Field label="Activa">
                            <input type="checkbox" checked={!!editCat.isActive} onChange={(e) => setEditCat({ ...editCat, isActive: e.target.checked })} />
                        </Field>
                    )}
                    <ModalActions onCancel={() => setEditCat(null)} onSave={saveCat} disabled={!editCat.name || submitting} loading={submitting} />
                </Modal>
            )}

            {/* MODAL: edit/create provider */}
            {editProv && (
                <Modal title={editProv.mode === 'create' ? 'Nuevo proveedor' : 'Editar proveedor'} onClose={() => setEditProv(null)}>
                    <Field label="Categoría">
                        <select value={editProv.categoryId || ''} onChange={(e) => setEditProv({ ...editProv, categoryId: e.target.value })} className="input">
                            {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.icon || ''} {c.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Nombre">
                        <input type="text" value={editProv.name || ''} onChange={(e) => setEditProv({ ...editProv, name: e.target.value })} className="input" />
                    </Field>
                    <Field label="Teléfono (opcional)">
                        <input type="text" value={editProv.contactPhone || ''} onChange={(e) => setEditProv({ ...editProv, contactPhone: e.target.value })} className="input" />
                    </Field>
                    <Field label="Email (opcional)">
                        <input type="email" value={editProv.contactEmail || ''} onChange={(e) => setEditProv({ ...editProv, contactEmail: e.target.value })} className="input" />
                    </Field>
                    <Field label="Notas (opcional)">
                        <textarea value={editProv.notes || ''} onChange={(e) => setEditProv({ ...editProv, notes: e.target.value })} rows={2} className="input" />
                    </Field>
                    {editProv.mode === 'edit' && (
                        <Field label="Activo">
                            <input type="checkbox" checked={!!editProv.isActive} onChange={(e) => setEditProv({ ...editProv, isActive: e.target.checked })} />
                        </Field>
                    )}
                    <ModalActions onCancel={() => setEditProv(null)} onSave={saveProv} disabled={!editProv.name || !editProv.categoryId || submitting} loading={submitting} />
                </Modal>
            )}

            {/* MODAL: new device */}
            {newDeviceModal && (
                <NewDeviceModal onClose={() => setNewDeviceModal(false)} onSubmit={createDevice} submitting={submitting} />
            )}

            {/* MODAL: device created success — QR + URL + abrir + copiar */}
            {newDeviceResult && (
                <Modal title={`Configurar tablet: ${newDeviceResult.label}`} onClose={() => setNewDeviceResult(null)}>
                    <p className="text-sm text-slate-600 mb-4">
                        Escanea el QR con la cámara de la tablet (sin app). También puedes copiar la URL o abrirla directamente. <strong className="text-amber-700">Este token se muestra una sola vez.</strong>
                    </p>
                    <div className="flex justify-center mb-4">
                        <QRCodeDisplay
                            url={newDeviceResult.setupUrl}
                            caption="Escanea con la cámara de la tablet"
                            size={200}
                        />
                    </div>
                    <div className="bg-slate-100 rounded-xl p-3 mb-3 break-all font-mono text-[11px] text-slate-700 max-h-20 overflow-y-auto">
                        {newDeviceResult.setupUrl}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(newDeviceResult.setupUrl);
                                setToast({ msg: 'URL copiada al portapapeles', type: 'ok' });
                            }}
                            className="bg-white border-2 border-slate-200 hover:border-teal-500 hover:text-teal-700 text-slate-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition"
                        >
                            <Copy className="w-4 h-4" /> Copiar URL
                        </button>
                        <a
                            href={newDeviceResult.setupUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition"
                        >
                            <ExternalLink className="w-4 h-4" /> Abrir en pestaña
                        </a>
                    </div>
                </Modal>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm ${toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {toast.msg}
                </div>
            )}

            <style jsx>{`.input { width: 100%; border: 2px solid #e2e8f0; border-radius: 12px; padding: 10px 14px; font-size: 14px; outline: none; }
                .input:focus { border-color: #0F6E56; }`}</style>

            {/* ConfirmDialog destructivo — Sprint B */}
            <ConfirmDialog
                open={!!confirmDeleteProv}
                onClose={() => setConfirmDeleteProv(null)}
                onConfirm={performDeleteProv}
                title="Eliminar proveedor"
                message={
                    <>
                        ¿Eliminar a <strong>{confirmDeleteProv?.name}</strong>?<br />
                        Si el proveedor tiene visitas registradas, no podrás eliminarlo — desactívalo en su lugar.
                    </>
                }
                tone="danger"
                confirmLabel="Sí, eliminar"
                cancelLabel="Cancelar"
            />
        </div>
    );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button onClick={onClick} className={`px-4 py-2.5 font-bold text-sm border-b-2 transition ${active ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {label}
        </button>
    );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3 text-sm">{children}</td>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-4">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">{label}</label>
            {children}
        </div>
    );
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="font-black text-slate-900">{title}</h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-5">{children}</div>
            </div>
        </div>
    );
}
function ModalActions({ onCancel, onSave, disabled, loading }: { onCancel: () => void; onSave: () => void; disabled?: boolean; loading?: boolean }) {
    return (
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 mt-3">
            <button onClick={onCancel} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50">Cancelar</button>
            <button onClick={onSave} disabled={disabled} className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-black flex items-center gap-2 disabled:opacity-50 transition">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
            </button>
        </div>
    );
}
function NewDeviceModal({ onClose, onSubmit, submitting }: { onClose: () => void; onSubmit: (floor: number, label: string) => void; submitting: boolean }) {
    const [floor, setFloor] = useState(1);
    const [label, setLabel] = useState('');
    return (
        <Modal title="Generar nueva tablet" onClose={onClose}>
            <Field label="Etiqueta (visible en el kiosko)">
                <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder='Ej: "Tablet Piso 1 — Lobby"' className="input" />
            </Field>
            <Field label="Piso">
                <input type="number" min={1} max={10} value={floor} onChange={(e) => setFloor(parseInt(e.target.value, 10) || 1)} className="input" />
            </Field>
            <p className="text-xs text-slate-500 mb-3">Se generará un token único. Lo verás UNA sola vez para configurar la tablet — guárdalo o úsalo de inmediato.</p>
            <ModalActions onCancel={onClose} onSave={() => onSubmit(floor, label.trim())} disabled={!label.trim() || submitting} loading={submitting} />
        </Modal>
    );
}
