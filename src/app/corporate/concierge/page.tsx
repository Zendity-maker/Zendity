"use client";

import { useState, useEffect } from "react";
import { FaBoxOpen, FaUserNurse, FaCheckCircle, FaTimesCircle, FaClock, FaCheck, FaExclamationTriangle } from "react-icons/fa";

interface GenericItem {
    id: string;
    patient: { name: string; roomNumber: string | null };
    createdAt: string;
    status: string;
}

interface Order extends GenericItem {
    product: { name: string; category: string; imageUrl: string | null };
}

interface Appointment extends GenericItem {
    service: { name: string; category: string; providerType: string };
    specialist?: { name: string; role: string } | null;
    specialistId?: string | null;
}

interface StaffMember {
    id: string;
    name: string;
    role: string;
}

export default function ConciergeFulfillment() {
    const [activeTab, setActiveTab] = useState<'ORDERS' | 'APPOINTMENTS'>('ORDERS');
    const [orders, setOrders] = useState<Order[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [resOrders, resAppts] = await Promise.all([
                fetch('/api/corporate/concierge/orders').then(res => res.json()),
                fetch('/api/corporate/concierge/appointments').then(res => res.json())
            ]);

            if (resOrders.success) setOrders(resOrders.orders);
            if (resAppts.success) {
                setAppointments(resAppts.appointments);
                setStaff(resAppts.availableStaff);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const updateOrder = async (orderId: string, status: string) => {
        if (!confirm(`¿Estás seguro de marcar esta orden como ${status === 'DELIVERED' ? 'ENTREGADA' : 'CANCELADA'}?`)) return;
        setActionLoading(orderId);
        try {
            const res = await fetch('/api/corporate/concierge/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, status })
            });
            if (res.ok) await loadData();
        } finally {
            setActionLoading(null);
        }
    };

    const updateAppointment = async (appointmentId: string, status: string, specialistId?: string) => {
        if (status === 'IN_PROGRESS' && !specialistId) {
            alert('Debes seleccionar un especialista antes de empezar la terapia.');
            return;
        }
        if (!confirm(`¿Confirmas el cambio de estado a ${status}?`)) return;

        setActionLoading(appointmentId);
        try {
            const res = await fetch('/api/corporate/concierge/appointments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointmentId, status, specialistId })
            });
            if (res.ok) await loadData();
        } finally {
            setActionLoading(null);
        }
    };

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING':
            case 'SCHEDULED': return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><FaClock /> Pendiente</span>;
            case 'IN_PROGRESS': return <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><FaUserNurse className="animate-pulse" /> En Ruta / Progreso</span>;
            case 'DELIVERED':
            case 'COMPLETED': return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><FaCheckCircle /> Finalizado</span>;
            case 'CANCELLED': return <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><FaTimesCircle /> Cancelado</span>;
            default: return null;
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in pb-12">

            {/* Encabezado Principal */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-teal-50 rounded-full blur-3xl"></div>

                <div className="relative z-10">
                    <span className="bg-teal-50 text-teal-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-teal-100 mb-2 inline-block">Módulo Interactivo</span>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Concierge Fulfillment</h1>
                    <p className="text-slate-500 font-medium mt-1">Gestión de despachos y asignación de terapias B2C.</p>
                </div>

                <div className="hidden sm:flex bg-slate-50 p-2 rounded-2xl border border-slate-200">
                    <button
                        onClick={() => setActiveTab('ORDERS')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'ORDERS' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FaBoxOpen className="text-xl" /> Entregas a Habitación
                        {orders.filter(o => o.status === 'PENDING').length > 0 && <span className="ml-2 bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">{orders.filter(o => o.status === 'PENDING').length}</span>}
                    </button>
                    <button
                        onClick={() => setActiveTab('APPOINTMENTS')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'APPOINTMENTS' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FaUserNurse className="text-xl" /> Terapias y Citas
                        {appointments.filter(a => a.status === 'SCHEDULED').length > 0 && <span className="ml-2 bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">{appointments.filter(a => a.status === 'SCHEDULED').length}</span>}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div></div>
            ) : (
                <div className="space-y-4">

                    {/* LISTA DE ÓRDENES (PRODUCTOS) */}
                    {activeTab === 'ORDERS' && (
                        orders.length === 0 ? (
                            <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 font-medium">No hay órdenes registradas.</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {orders.map(order => (
                                    <div key={order.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:border-teal-100 transition-all flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                {renderStatusBadge(order.status)}
                                                <span className="text-xs text-slate-400 font-bold">{new Date(order.createdAt).toLocaleDateString()}</span>
                                            </div>

                                            <div className="mb-4">
                                                <h3 className="text-lg font-black text-slate-800 leading-tight">{order.product.name}</h3>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{order.product.category}</p>
                                            </div>

                                            <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100 mb-6">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente Entregar a</p>
                                                    <p className="font-bold text-slate-700">{order.patient.name}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apto/Hab</p>
                                                    <p className="font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-lg inline-block">{order.patient.roomNumber || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {order.status === 'PENDING' && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateOrder(order.id, 'CANCELLED')}
                                                    disabled={actionLoading === order.id}
                                                    className="flex-1 py-3 text-sm font-bold bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-xl transition-all"
                                                >
                                                    Reembolsar
                                                </button>
                                                <button
                                                    onClick={() => updateOrder(order.id, 'DELIVERED')}
                                                    disabled={actionLoading === order.id}
                                                    className="flex-1 py-3 text-sm font-bold bg-teal-500 text-white hover:bg-teal-600 rounded-xl transition-all shadow-md shadow-teal-500/20"
                                                >
                                                    Entregado
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {/* LISTA DE CITAS (TERAPIAS) */}
                    {activeTab === 'APPOINTMENTS' && (
                        appointments.length === 0 ? (
                            <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 font-medium">No hay citas registradas.</div>
                        ) : (
                            <div className="space-y-4">
                                {appointments.map(appt => (
                                    <div key={appt.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">

                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                {renderStatusBadge(appt.status)}
                                                <span className="text-xs text-slate-400 font-bold">{new Date(appt.createdAt).toLocaleString()}</span>
                                            </div>
                                            <h3 className="text-xl font-black text-slate-800 leading-tight">{appt.service.name}</h3>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200">{appt.patient.name}</span>
                                                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200">Hab: {appt.patient.roomNumber || 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div className="md:w-72 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                                            {appt.status === 'SCHEDULED' ? (
                                                <>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 shadow-sm">Asignar a:</p>
                                                        <select
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                            onChange={(e) => {
                                                                // Mutamos localmente para tener el ID a mano al darle "Empezar"
                                                                const updated = [...appointments];
                                                                const idx = updated.findIndex(a => a.id === appt.id);
                                                                updated[idx].specialistId = e.target.value;
                                                                setAppointments(updated);
                                                            }}
                                                            value={appt.specialistId || ''}
                                                        >
                                                            <option value="">-- Selecciona Especialista --</option>
                                                            {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => updateAppointment(appt.id, 'CANCELLED')}
                                                            disabled={actionLoading === appt.id}
                                                            className="px-4 py-2 text-xs font-bold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={() => updateAppointment(appt.id, 'IN_PROGRESS', appt.specialistId || '')}
                                                            disabled={actionLoading === appt.id || !appt.specialistId}
                                                            className="flex-1 py-2 text-xs font-bold bg-teal-500 text-white hover:bg-teal-600 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                                        >
                                                            <FaCheck className="inline mr-1" /> Empezar Terapia
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-sm font-medium text-slate-600">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Especialista Asignado</p>
                                                    <p className="font-bold">{appt.specialist?.name || 'Asignado'}</p>

                                                    {appt.status === 'IN_PROGRESS' && (
                                                        <button
                                                            onClick={() => updateAppointment(appt.id, 'COMPLETED')}
                                                            disabled={actionLoading === appt.id}
                                                            className="w-full mt-3 py-2 text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl transition-all shadow-sm"
                                                        >
                                                            Marcar Finalizado
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                ))}
                            </div>
                        )
                    )}

                </div>
            )}
        </div>
    );
}
