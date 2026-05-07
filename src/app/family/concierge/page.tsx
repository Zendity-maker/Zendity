"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaSpa, FaShoppingCart, FaGift, FaWallet, FaCheckCircle, FaHeartbeat, FaCalendarAlt, FaClipboardList } from "react-icons/fa";
import { X, ChevronLeft, ChevronRight, Clock, Camera, Bell, Users, ChevronDown, ChevronUp, Heart } from "lucide-react";

interface MarketplaceItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    category: string;
    stock?: number;
    isOffer?: boolean;
    originalPrice?: number;
    imageUrl?: string;
}

interface MyAppointment {
    id: string;
    scheduledAt: string | null;
    status: string;
    notes: string | null;
    service: { name: string; category: string; imageUrl: string | null };
    specialist: { name: string; role: string } | null;
}

// Genera slots de 30 min entre 9AM y 5PM
function generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let h = 9; h < 17; h++) {
        for (const m of [0, 30]) {
            const period = h < 12 ? 'AM' : 'PM';
            const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
            slots.push(`${displayH}:${m === 0 ? '00' : '30'} ${period}`);
        }
    }
    return slots;
}

// Conjunto de fechas disponibles (próximos 60 días, sin lunes)
function buildAvailableSet(): Set<string> {
    const set = new Set<string>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 1; i <= 60; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() !== 1) set.add(d.toDateString());
    }
    return set;
}

// Genera el grid del mes: semanas completas (Dom→Sáb)
function buildMonthGrid(year: number, month: number): (Date | null)[][] {
    const firstDay = new Date(year, month, 1).getDay(); // 0=Dom
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    // Rellena el resto de la última semana
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

function parseTimeSlot(slot: string): { hours: number; minutes: number } {
    const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return { hours: 9, minutes: 0 };
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const p = match[3].toUpperCase();
    if (p === 'PM' && h !== 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return { hours: h, minutes: m };
}

const TIME_SLOTS = generateTimeSlots();
const AVAILABLE_SET = buildAvailableSet();

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    SCHEDULED:   { label: 'Pendiente de confirmación', color: 'bg-amber-50 text-amber-700 border-amber-200',  icon: '⏳' },
    IN_PROGRESS: { label: 'En progreso',                color: 'bg-blue-50 text-blue-700 border-blue-200',    icon: '🔵' },
    COMPLETED:   { label: 'Completado',                 color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '✅' },
    CANCELLED:   { label: 'Cancelado',                  color: 'bg-red-50 text-red-700 border-red-200',       icon: '❌' },
};

export default function ConciergePage() {
    const [data, setData] = useState<{ products: MarketplaceItem[]; services: MarketplaceItem[]; balance: number; myAppointments: MyAppointment[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [buying, setBuying] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [activeTab, setActiveTab] = useState<'marketplace' | 'reservas'>('marketplace');

    // Modal de reserva de servicio
    const [bookingItem, setBookingItem] = useState<MarketplaceItem | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [bookingNotes, setBookingNotes] = useState('');
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const [expandedService, setExpandedService] = useState<string | null>(null);
    const [yogaMode, setYogaMode] = useState<'grupal' | 'privada'>('grupal'); // para el Yoga

    const loadMarketplace = () => {
        fetch('/api/family/concierge')
            .then(res => res.json())
            .then(resData => {
                if (resData.success) {
                    setData(resData);
                } else {
                    setErrorMsg(resData.error || "No se pudo cargar el catálogo.");
                }
                setLoading(false);
            })
            .catch(() => {
                setErrorMsg("Error de red al conectar con el servidor.");
                setLoading(false);
            });
    };

    useEffect(() => { loadMarketplace(); }, []);

    // Abrir modal de fecha para servicio
    // Los servicios se cargan a la factura mensual — no requieren saldo previo
    const openBookingModal = (item: MarketplaceItem) => {
        const now = new Date();
        setBookingItem(item);
        setSelectedDate(null);
        setSelectedTime('');
        setBookingNotes('');
        setCalMonth(now.getMonth());
        setCalYear(now.getFullYear());
    };

    const closeBookingModal = () => {
        setBookingItem(null);
        setSelectedDate(null);
        setSelectedTime('');
        setBookingNotes('');
    };

    const prevMonth = () => {
        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
        else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
        else setCalMonth(m => m + 1);
    };

    const confirmBooking = async () => {
        if (!bookingItem || !selectedDate || !selectedTime) return;

        const { hours, minutes } = parseTimeSlot(selectedTime);
        const scheduledAt = new Date(selectedDate);
        scheduledAt.setHours(hours, minutes, 0, 0);

        setBuying(bookingItem.id);
        setSuccessMsg("");
        try {
            const res = await fetch('/api/family/concierge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'service',
                    id: bookingItem.id,
                    price: bookingItem.price,
                    scheduledAt: scheduledAt.toISOString(),
                    notes: bookingNotes,
                })
            });
            const resData = await res.json();
            if (resData.success) {
                setSuccessMsg(`¡Reserva confirmada: ${bookingItem.name} el ${selectedDate.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'short' })} a las ${selectedTime}!`);
                closeBookingModal();
                loadMarketplace();
                setActiveTab('reservas');
            } else {
                alert(resData.error || "Error al procesar la reserva.");
            }
        } catch {
            alert("Error de conexión. Intenta de nuevo.");
        }
        setBuying(null);
    };

    const handleProductPurchase = async (item: MarketplaceItem) => {
        // Solo productos físicos (no GiftCards) requieren saldo previo
        if (item.category !== 'GiftCards' && data && data.balance < item.price) {
            alert("Saldo insuficiente. Adquiere una Gift Card para recargar.");
            return;
        }
        if (!confirm(`¿Confirmas la compra de ${item.name} por $${item.price.toFixed(2)}?`)) return;

        setBuying(item.id);
        try {
            const res = await fetch('/api/family/concierge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'product', id: item.id, price: item.price })
            });
            const resData = await res.json();
            if (resData.success) {
                setSuccessMsg(`¡Compra exitosa: ${item.name}!`);
                loadMarketplace();
            } else {
                alert(resData.error || "Error al procesar la orden.");
            }
        } catch {
            alert("Error de conexión. Intenta de nuevo.");
        }
        setBuying(null);
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
        </div>
    );

    if (errorMsg) return (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-rose-100 flex flex-col items-center mt-10">
            <p className="text-xl font-bold text-slate-800">Error al cargar el Marketplace</p>
            <p className="text-slate-500 mt-2">{errorMsg}</p>
        </div>
    );

    if (!data) return null;

    const calWeeks = buildMonthGrid(calYear, calMonth);
    const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('es-PR', { month: 'long', year: 'numeric' });

    // No permitir navegar a meses anteriores al actual
    const now = new Date();
    const canGoPrev = calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth > now.getMonth());

    const pendingCount = data.myAppointments?.filter(a => a.status === 'SCHEDULED').length ?? 0;

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700 pb-10">

            {/* Header & Balance */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2 text-indigo-200">
                            <FaSpa className="text-xl" />
                            <h2 className="text-sm font-black uppercase tracking-widest">Zendity Concierge</h2>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Marketplace de Servicios</h1>
                        <p className="text-indigo-200/70 font-medium max-w-md">Terapias, estética y servicios especiales. Elige fecha y hora y lo coordinamos.</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 min-w-[200px] text-right">
                        <p className="text-xs uppercase font-bold tracking-widest text-indigo-200 mb-1 flex items-center justify-end gap-2">
                            <FaWallet /> Saldo Concierge
                        </p>
                        <p className="text-4xl font-black text-white">${data.balance.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl font-bold flex items-center gap-3 shadow-sm">
                    <FaCheckCircle className="text-xl flex-shrink-0" />
                    {successMsg}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 bg-slate-100 rounded-2xl p-1">
                <button
                    onClick={() => setActiveTab('marketplace')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'marketplace' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <FaSpa /> Catálogo de Servicios
                </button>
                <button
                    onClick={() => setActiveTab('reservas')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 relative ${activeTab === 'reservas' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <FaClipboardList /> Mis Reservas
                    {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                            {pendingCount}
                        </span>
                    )}
                </button>
            </div>

            {/* ── TAB: CATÁLOGO ─────────────────────────────────────────── */}
            {activeTab === 'marketplace' && (
                <>
                    {/* ── Banner: Foto + Notificación al familiar ── */}
                    <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-5">
                        <p className="text-sm font-black text-indigo-800 mb-3 flex items-center gap-2">
                            <Bell className="w-4 h-4 text-indigo-500" /> ¿Cómo funciona?
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex items-start gap-3 bg-white/70 rounded-xl p-3 border border-indigo-100">
                                <Camera className="w-8 h-8 text-indigo-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-black text-slate-800">📸 Foto del servicio</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Al completarse cada sesión, el equipo envía una foto al familiar para que veas cómo disfrutó el residente.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-white/70 rounded-xl p-3 border border-indigo-100">
                                <Bell className="w-8 h-8 text-violet-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-black text-slate-800">🔔 Notificación en tiempo real</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Recibes una notificación aquí en el portal cuando el servicio comienza, se completa o cuando un producto es entregado.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Servicios */}
                    <div>
                        <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                            <FaHeartbeat className="text-rose-500" /> Especialidades y Terapias
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {data.services.map((service) => {
                                const isYoga = service.name.toLowerCase().includes('yoga');
                                const isExpanded = expandedService === service.id;
                                const displayPrice = isYoga && yogaMode === 'privada' ? 59.99 : service.price;

                                return (
                                <div key={service.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group flex flex-col relative">
                                    {service.isOffer && (
                                        <div className="absolute top-3 right-3 z-10 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                                            <FaGift /> Oferta
                                        </div>
                                    )}
                                    {service.imageUrl && (
                                        <div className="h-40 w-full relative overflow-hidden bg-slate-100">
                                            <img src={service.imageUrl} alt={service.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            <span className="absolute bottom-3 left-3 bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-white/20">
                                                {service.category}
                                            </span>
                                        </div>
                                    )}
                                    <div className="p-5 flex-1 flex flex-col">
                                        <h4 className="font-bold text-slate-800 text-base leading-tight mb-1">{service.name}</h4>

                                        {/* Selector grupal/privada para Yoga */}
                                        {isYoga && (
                                            <div className="flex gap-2 mb-3">
                                                <button
                                                    onClick={() => setYogaMode('grupal')}
                                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${yogaMode === 'grupal' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}
                                                >
                                                    <Users className="w-3 h-3" /> Grupal · $39.99
                                                </button>
                                                <button
                                                    onClick={() => setYogaMode('privada')}
                                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${yogaMode === 'privada' ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'}`}
                                                >
                                                    <Heart className="w-3 h-3" /> Privada Familiar · $59.99
                                                </button>
                                            </div>
                                        )}
                                        {isYoga && yogaMode === 'privada' && (
                                            <p className="text-[11px] text-rose-600 font-bold bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">
                                                💑 El familiar puede unirse y practicar junto al residente en una sesión privada exclusiva.
                                            </p>
                                        )}

                                        {/* Pestaña: descripción / beneficios */}
                                        {service.description && (
                                            <div className="mb-3">
                                                <button
                                                    onClick={() => setExpandedService(isExpanded ? null : service.id)}
                                                    className="w-full flex items-center justify-between text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl px-3 py-2 transition-colors border border-indigo-100"
                                                >
                                                    <span>Descripción y beneficios</span>
                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>
                                                {isExpanded && (
                                                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                                        <p className="text-xs text-slate-600 leading-relaxed">{service.description}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-auto flex justify-between items-end mb-4">
                                            <div>
                                                {service.isOffer && service.originalPrice && (
                                                    <p className="text-xs text-slate-400 line-through">${service.originalPrice.toFixed(2)}</p>
                                                )}
                                                <p className="text-xl font-black text-indigo-600">${displayPrice.toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-slate-400">
                                                <FaCalendarAlt /> Elige fecha y hora
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (isYoga && yogaMode === 'privada') {
                                                    openBookingModal({ ...service, price: 59.99, name: service.name + ' (Privada Familiar)' });
                                                } else {
                                                    openBookingModal(service);
                                                }
                                            }}
                                            disabled={buying === service.id}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <FaCalendarAlt />
                                            {buying === service.id ? 'Reservando...' : 'Reservar — Elegir Fecha'}
                                        </button>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Productos */}
                    <div>
                        <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                            <FaShoppingCart className="text-sky-500" /> Tienda y Gift Cards
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {data.products.map((product) => (
                                <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-lg transition-all flex flex-col relative">
                                    {product.isOffer && (
                                        <div className="absolute top-3 right-3 z-10 bg-rose-500 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                                            <FaGift /> Oferta
                                        </div>
                                    )}
                                    {product.imageUrl && (
                                        <div className="h-40 w-full overflow-hidden bg-slate-100">
                                            <img src={product.imageUrl} alt={product.name} className="object-cover w-full h-full" />
                                        </div>
                                    )}
                                    <div className="p-5 flex-1 flex flex-col">
                                        <h4 className="font-bold text-slate-800 text-base leading-tight mb-1">{product.name}</h4>
                                        {product.description && (
                                            <div className="mb-2">
                                                <button
                                                    onClick={() => setExpandedService(expandedService === product.id ? null : product.id)}
                                                    className="w-full flex items-center justify-between text-xs font-black text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-xl px-3 py-2 transition-colors border border-sky-100 mb-1"
                                                >
                                                    <span>Descripción del producto</span>
                                                    {expandedService === product.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>
                                                {expandedService === product.id && (
                                                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                                        <p className="text-xs text-slate-600 leading-relaxed">{product.description}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <p className="text-xs font-bold text-slate-400 mb-3">Stock: {(product.stock ?? 0) > 0 ? product.stock : 'Agotado'}</p>
                                        <div className="mt-auto mb-4">
                                            {product.isOffer && product.originalPrice && (
                                                <p className="text-xs text-slate-400 line-through">${product.originalPrice.toFixed(2)}</p>
                                            )}
                                            <p className="text-xl font-black text-slate-800">${product.price.toFixed(2)}</p>
                                        </div>
                                        <button
                                            onClick={() => handleProductPurchase(product)}
                                            disabled={buying === product.id || (product.category !== 'GiftCards' && data.balance < product.price)}
                                            className={`w-full py-3 font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 ${product.category === 'GiftCards'
                                                ? 'bg-amber-100 hover:bg-amber-500 text-amber-700 hover:text-white'
                                                : 'bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white'}`}
                                        >
                                            {buying === product.id ? 'Procesando...' : product.category === 'GiftCards' ? '+ Recargar Saldo' : 'Comprar'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* ── TAB: MIS RESERVAS ─────────────────────────────────────── */}
            {activeTab === 'reservas' && (
                <div className="space-y-4">
                    {!data.myAppointments || data.myAppointments.length === 0 ? (
                        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center">
                            <FaCalendarAlt className="text-4xl text-slate-300 mx-auto mb-3" />
                            <p className="font-bold text-slate-600">No tienes reservas activas</p>
                            <p className="text-sm text-slate-400 mt-1">Ve al catálogo y elige un servicio para comenzar.</p>
                            <button onClick={() => setActiveTab('marketplace')} className="mt-4 bg-indigo-600 text-white font-bold px-6 py-2 rounded-xl text-sm hover:bg-indigo-700 transition-colors">
                                Ver catálogo
                            </button>
                        </div>
                    ) : (
                        data.myAppointments.map((appt) => {
                            const st = STATUS_LABELS[appt.status] || STATUS_LABELS.SCHEDULED;
                            const dateStr = appt.scheduledAt
                                ? new Date(appt.scheduledAt).toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                                : '—';
                            const timeStr = appt.scheduledAt
                                ? new Date(appt.scheduledAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })
                                : '';
                            return (
                                <div key={appt.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    <div className="flex gap-4 p-5">
                                        {appt.service.imageUrl && (
                                            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                                                <img src={appt.service.imageUrl} alt={appt.service.name} className="object-cover w-full h-full" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 flex-wrap">
                                                <h4 className="font-bold text-slate-800 text-base leading-snug">{appt.service.name}</h4>
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1 flex-shrink-0 ${st.color}`}>
                                                    {st.icon} {st.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">{appt.service.category}</p>
                                            <div className="mt-3 flex flex-wrap gap-3">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                                                    <FaCalendarAlt className="text-indigo-400" />
                                                    <span className="font-medium capitalize">{dateStr}</span>
                                                </div>
                                                {timeStr && (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                                                        <Clock size={12} className="text-indigo-400" />
                                                        <span className="font-medium">{timeStr}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {appt.specialist && (
                                                <p className="mt-2 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg inline-flex items-center gap-1">
                                                    ✓ Especialista: {appt.specialist.name}
                                                </p>
                                            )}
                                            {appt.notes && (
                                                <p className="mt-2 text-xs text-slate-500 italic">"{appt.notes}"</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── MODAL DE RESERVA CON FECHA ────────────────────────────── */}
            {bookingItem && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" style={{ maxHeight: '92vh' }}>

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
                            <div>
                                <h3 className="font-black text-slate-800 text-lg leading-snug">{bookingItem.name}</h3>
                                <p className="text-sm text-indigo-600 font-bold mt-0.5">${bookingItem.price.toFixed(2)}</p>
                            </div>
                            <button onClick={closeBookingModal} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 160px)' }}>

                            {/* Selector de fecha — calendario mensual */}
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                    <FaCalendarAlt className="text-indigo-400" /> Selecciona una Fecha
                                </p>

                                {/* Navegación de mes */}
                                <div className="flex items-center justify-between mb-3">
                                    <button
                                        onClick={prevMonth}
                                        disabled={!canGoPrev}
                                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronLeft size={15} />
                                    </button>
                                    <span className="text-sm font-black text-slate-700 capitalize">{monthLabel}</span>
                                    <button
                                        onClick={nextMonth}
                                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronRight size={15} />
                                    </button>
                                </div>

                                {/* Headers días de semana */}
                                <div className="grid grid-cols-7 mb-1">
                                    {['Do','Lu','Ma','Mi','Ju','Vi','Sá'].map(d => (
                                        <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-wide py-1">{d}</div>
                                    ))}
                                </div>

                                {/* Semanas */}
                                <div className="space-y-1">
                                    {calWeeks.map((week, wi) => (
                                        <div key={wi} className="grid grid-cols-7 gap-0.5">
                                            {week.map((day, di) => {
                                                if (!day) return <div key={di} />;
                                                const isAvailable = AVAILABLE_SET.has(day.toDateString());
                                                const isSelected = selectedDate?.toDateString() === day.toDateString();
                                                const today = new Date(); today.setHours(0,0,0,0);
                                                const isPast = day <= today;
                                                return (
                                                    <button
                                                        key={di}
                                                        onClick={() => isAvailable && !isPast && setSelectedDate(day)}
                                                        disabled={!isAvailable || isPast}
                                                        className={`h-9 rounded-lg text-sm font-bold transition-all flex items-center justify-center
                                                            ${isSelected
                                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105'
                                                                : isPast || !isAvailable
                                                                    ? 'text-slate-300 cursor-not-allowed'
                                                                    : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
                                                            }`}
                                                    >
                                                        {day.getDate()}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>

                                {selectedDate && (
                                    <p className="mt-3 text-xs text-emerald-700 font-bold text-center bg-emerald-50 rounded-lg py-2 border border-emerald-200">
                                        ✓ {selectedDate.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                    </p>
                                )}
                            </div>

                            {/* Selector de hora */}
                            {selectedDate && (
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                        <Clock size={12} className="text-indigo-400" /> Selecciona una Hora
                                    </p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {TIME_SLOTS.map((slot) => (
                                            <button
                                                key={slot}
                                                onClick={() => setSelectedTime(slot)}
                                                className={`py-2 rounded-xl text-xs font-bold transition-all ${selectedTime === slot
                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                    : 'bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200'}`}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Notas opcionales */}
                            {selectedDate && selectedTime && (
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Nota para el equipo (opcional)</p>
                                    <textarea
                                        value={bookingNotes}
                                        onChange={(e) => setBookingNotes(e.target.value)}
                                        placeholder="Ej: prefiero por la mañana, tiene alergia a X..."
                                        rows={2}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Footer del modal */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
                            {selectedDate && selectedTime ? (
                                <div className="space-y-3">
                                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-sm text-indigo-800 font-medium">
                                        <span className="font-black">{selectedDate.toLocaleDateString('es-PR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                                        {' '}a las{' '}
                                        <span className="font-black">{selectedTime}</span>
                                        {' · '}
                                        <span className="text-indigo-600 font-black">${bookingItem.price.toFixed(2)}</span>
                                    </div>
                                    <button
                                        onClick={confirmBooking}
                                        disabled={!!buying}
                                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black rounded-xl transition-all active:scale-95 shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
                                    >
                                        <FaCheckCircle />
                                        {buying ? 'Confirmando...' : 'Confirmar Reserva'}
                                    </button>
                                </div>
                            ) : (
                                <p className="text-center text-xs text-slate-400 font-medium py-1">
                                    {!selectedDate ? 'Selecciona una fecha para continuar' : 'Selecciona una hora para confirmar'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
