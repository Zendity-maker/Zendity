"use client";

import { useEffect, useState } from "react";
import {
    X, ChevronLeft, ChevronRight, Clock, Camera, Bell, Users, ChevronDown, ChevronUp, Heart,
    Sparkles, ShoppingCart, Gift, Wallet, CheckCircle2, Activity, Calendar as CalendarIcon, ClipboardList,
    ShoppingBag, Shield, Leaf, Package,
} from "lucide-react";

// ── Placeholder visual cuando no hay imageUrl ─────────────────────────
// Map de categoría → ícono Lucide
const CATEGORY_ICON: Record<string, any> = {
    Terapia:    Heart,
    Belleza:    Sparkles,
    Higiene:    Shield,
    Nutrición:  Leaf,
    Nutricion:  Leaf,      // por si llega sin tilde desde DB
    GiftCards:  Gift,
    "Gift Cards": Gift,
};

function CategoryPlaceholder({ category, size = "large" }: { category: string; size?: "large" | "small" }) {
    const Icon = CATEGORY_ICON[category] || (size === "small" ? Package : ShoppingBag);
    if (size === "small") {
        return (
            <div className="w-20 h-20 rounded-xl flex items-center justify-center bg-gradient-to-br from-brand/10 to-brand/20 border border-brand/20 flex-shrink-0">
                <Icon className="w-7 h-7 text-brand/40" strokeWidth={1.25} />
            </div>
        );
    }
    return (
        <div className="h-36 w-full rounded-xl flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-brand/10 to-brand/20 border border-brand/20 mb-3">
            <Icon className="w-10 h-10 text-brand/40" strokeWidth={1} />
            <span className="text-xs font-medium text-brand-secondary uppercase tracking-wide">
                {category}
            </span>
        </div>
    );
}

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    SCHEDULED:   { label: 'Pendiente',    color: 'bg-amber-50 text-amber-700 border-amber-200' },
    IN_PROGRESS: { label: 'En progreso',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
    COMPLETED:   { label: 'Completado',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CANCELLED:   { label: 'Cancelado',    color: 'bg-red-50 text-red-700 border-red-200' },
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
    const [yogaMode, setYogaMode] = useState<'grupal' | 'privada'>('grupal');

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
                setSuccessMsg(`Reserva confirmada: ${bookingItem.name} el ${selectedDate.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'short' })} a las ${selectedTime}.`);
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
                setSuccessMsg(`Compra exitosa: ${item.name}.`);
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
        <div className="bg-[#FAFAF8] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-secondary"></div>
        </div>
    );

    if (errorMsg) return (
        <div className="bg-[#FAFAF8] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen flex justify-center items-center px-4">
            <div className="bg-white rounded-3xl border border-amber-100 shadow-none p-10 text-center max-w-md">
                <p className="text-lg font-bold text-slate-800">Error al cargar el Marketplace</p>
                <p className="text-amber-700 mt-2 text-sm">{errorMsg}</p>
            </div>
        </div>
    );

    if (!data) return null;

    const calWeeks = buildMonthGrid(calYear, calMonth);
    const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('es-PR', { month: 'long', year: 'numeric' });

    const now = new Date();
    const canGoPrev = calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth > now.getMonth());

    const pendingCount = data.myAppointments?.filter(a => a.status === 'SCHEDULED').length ?? 0;

    return (
        <div className="bg-[#FAFAF8] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">

            {/* Header página */}
            <div className="bg-white border-b border-stone-100 px-4 py-5">
                <div className="flex items-center gap-3">
                    <ShoppingBag size={24} className="text-brand" />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Servicios</h1>
                        <p className="text-xs text-slate-400">Bienestar y cuidado especial</p>
                    </div>
                </div>
            </div>

            <div className="px-4 py-5 space-y-5 max-w-5xl mx-auto">

                {/* Saldo Concierge */}
                <div className="bg-brand/10 border border-brand/20 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Wallet size={18} className="text-brand" />
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Saldo Concierge</span>
                    </div>
                    <p className="text-2xl font-bold text-brand">${data.balance.toFixed(2)}</p>
                </div>

                {/* Success message */}
                {successMsg && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl font-medium flex items-center gap-3">
                        <CheckCircle2 size={18} className="flex-shrink-0" />
                        <span className="text-sm">{successMsg}</span>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('marketplace')}
                        className={`rounded-full px-4 py-2 text-sm border flex items-center gap-2 transition-all ${activeTab === 'marketplace' ? 'bg-brand/10 text-brand font-semibold border-brand/20' : 'bg-white text-slate-500 border-slate-100'}`}
                    >
                        <Sparkles size={14} /> Catálogo de Servicios
                    </button>
                    <button
                        onClick={() => setActiveTab('reservas')}
                        className={`rounded-full px-4 py-2 text-sm border flex items-center gap-2 transition-all relative ${activeTab === 'reservas' ? 'bg-brand/10 text-brand font-semibold border-brand/20' : 'bg-white text-slate-500 border-slate-100'}`}
                    >
                        <ClipboardList size={14} /> Mis Reservas
                        {pendingCount > 0 && (
                            <span className="ml-1 w-5 h-5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full flex items-center justify-center">
                                {pendingCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* ── TAB: CATÁLOGO ─────────────────────────────────────── */}
                {activeTab === 'marketplace' && (
                    <>
                        {/* Cómo funciona */}
                        <div className="bg-brand/10 border border-brand/20 rounded-2xl p-4">
                            <p className="text-sm font-semibold text-brand mb-3 flex items-center gap-2">
                                <Bell size={16} className="text-brand" /> ¿Cómo funciona?
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex items-start gap-3 bg-white rounded-xl p-3 border border-slate-100">
                                    <Camera size={20} className="text-brand flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800">Foto del servicio</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Al completarse cada sesión, el equipo envía una foto al familiar.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 bg-white rounded-xl p-3 border border-slate-100">
                                    <Bell size={20} className="text-brand flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800">Notificación en tiempo real</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Recibes aviso cuando el servicio comienza, se completa o un producto es entregado.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Servicios */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">Especialidades y Terapias</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {data.services.map((service) => {
                                    const isYoga = service.name.toLowerCase().includes('yoga');
                                    const isExpanded = expandedService === service.id;
                                    const displayPrice = isYoga && yogaMode === 'privada' ? 59.99 : service.price;

                                    return (
                                    <div key={service.id} className="bg-white border border-slate-100 rounded-2xl shadow-none p-4 flex flex-col relative">
                                        {service.isOffer && (
                                            <div className="absolute top-3 right-3 z-10 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Gift size={11} /> Oferta
                                            </div>
                                        )}
                                        {service.imageUrl ? (
                                            <div className="h-36 w-full rounded-xl overflow-hidden bg-stone-100 mb-3 relative">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={service.imageUrl} alt={service.name} className="object-cover w-full h-full" />
                                                <span className="absolute bottom-2 left-2 bg-white/90 backdrop-blur text-slate-700 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full">
                                                    {service.category}
                                                </span>
                                            </div>
                                        ) : (
                                            <CategoryPlaceholder category={service.category} />
                                        )}
                                        <h4 className="text-base font-semibold text-slate-800 leading-tight mb-1">{service.name}</h4>

                                        {/* Selector grupal/privada para Yoga */}
                                        {isYoga && (
                                            <div className="flex gap-2 mb-3 mt-2">
                                                <button
                                                    onClick={() => setYogaMode('grupal')}
                                                    className={`flex-1 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${yogaMode === 'grupal' ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200'}`}
                                                >
                                                    <Users size={12} /> Grupal · $39.99
                                                </button>
                                                <button
                                                    onClick={() => setYogaMode('privada')}
                                                    className={`flex-1 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${yogaMode === 'privada' ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200'}`}
                                                >
                                                    <Heart size={12} /> Privada · $59.99
                                                </button>
                                            </div>
                                        )}
                                        {isYoga && yogaMode === 'privada' && (
                                            <p className="text-[11px] text-amber-700 font-medium bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                                                El familiar puede unirse y practicar junto al residente en una sesión privada exclusiva.
                                            </p>
                                        )}

                                        {service.description && (
                                            <div className="mb-3">
                                                <button
                                                    onClick={() => setExpandedService(isExpanded ? null : service.id)}
                                                    className="w-full flex items-center justify-between text-xs font-semibold text-brand bg-brand/10 hover:bg-brand/15 rounded-xl px-3 py-2 transition-colors border border-brand/20"
                                                >
                                                    <span>Descripción y beneficios</span>
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                                {isExpanded && (
                                                    <div className="mt-2 bg-stone-50 border border-slate-100 rounded-xl px-4 py-3">
                                                        <p className="text-xs text-slate-600 leading-relaxed">{service.description}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-auto flex justify-between items-end mb-3">
                                            <div>
                                                {service.isOffer && service.originalPrice && (
                                                    <p className="text-xs text-slate-400 line-through">${service.originalPrice.toFixed(2)}</p>
                                                )}
                                                <p className="text-lg text-brand font-bold">${displayPrice.toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-slate-400">
                                                <CalendarIcon size={14} /> Elige fecha
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
                                            className="bg-brand hover:bg-brand disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full py-2.5 px-5 font-semibold text-sm w-full transition-all flex items-center justify-center gap-2"
                                        >
                                            <CalendarIcon size={14} />
                                            {buying === service.id ? 'Reservando…' : 'Reservar'}
                                        </button>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Productos */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">Tienda y Gift Cards</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {data.products.map((product) => (
                                    <div key={product.id} className="bg-white border border-slate-100 rounded-2xl shadow-none p-4 flex flex-col relative">
                                        {product.isOffer && (
                                            <div className="absolute top-3 right-3 z-10 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Gift size={11} /> Oferta
                                            </div>
                                        )}
                                        {product.imageUrl ? (
                                            <div className="h-36 w-full rounded-xl overflow-hidden bg-stone-100 mb-3">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={product.imageUrl} alt={product.name} className="object-cover w-full h-full" />
                                            </div>
                                        ) : (
                                            <CategoryPlaceholder category={product.category} />
                                        )}
                                        <h4 className="text-base font-semibold text-slate-800 leading-tight mb-1">{product.name}</h4>
                                        {product.description && (
                                            <div className="mb-2">
                                                <button
                                                    onClick={() => setExpandedService(expandedService === product.id ? null : product.id)}
                                                    className="w-full flex items-center justify-between text-xs font-semibold text-brand bg-brand/10 hover:bg-brand/15 rounded-xl px-3 py-2 transition-colors border border-brand/20 mb-1"
                                                >
                                                    <span>Descripción</span>
                                                    {expandedService === product.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                                {expandedService === product.id && (
                                                    <div className="bg-stone-50 border border-slate-100 rounded-xl px-4 py-3">
                                                        <p className="text-xs text-slate-600 leading-relaxed">{product.description}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <p className="text-xs text-slate-400 mb-3">Stock: {(product.stock ?? 0) > 0 ? product.stock : 'Agotado'}</p>
                                        <div className="mt-auto mb-3">
                                            {product.isOffer && product.originalPrice && (
                                                <p className="text-xs text-slate-400 line-through">${product.originalPrice.toFixed(2)}</p>
                                            )}
                                            <p className="text-lg text-brand font-bold">${product.price.toFixed(2)}</p>
                                        </div>
                                        <button
                                            onClick={() => handleProductPurchase(product)}
                                            disabled={buying === product.id || (product.category !== 'GiftCards' && data.balance < product.price)}
                                            className="bg-brand hover:bg-brand disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full py-2.5 px-5 font-semibold text-sm w-full transition-all flex items-center justify-center gap-2"
                                        >
                                            {product.category === 'GiftCards' ? <Gift size={14} /> : <ShoppingCart size={14} />}
                                            {buying === product.id ? 'Procesando…' : product.category === 'GiftCards' ? 'Recargar Saldo' : 'Comprar'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ── TAB: MIS RESERVAS ─────────────────────────────────── */}
                {activeTab === 'reservas' && (
                    <div className="space-y-4">
                        {!data.myAppointments || data.myAppointments.length === 0 ? (
                            <div className="bg-white border border-slate-100 rounded-2xl shadow-none p-10 text-center">
                                <CalendarIcon size={48} className="text-slate-200 mx-auto mb-3" strokeWidth={1.25} />
                                <p className="text-slate-400 text-sm">No tienes reservas activas</p>
                                <p className="text-slate-400 text-xs mt-1">Ve al catálogo y elige un servicio para comenzar.</p>
                                <button
                                    onClick={() => setActiveTab('marketplace')}
                                    className="mt-4 bg-brand hover:bg-brand text-white rounded-full py-2.5 px-5 font-semibold text-sm transition-all"
                                >
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
                                    <div key={appt.id} className="bg-white rounded-2xl border border-slate-100 shadow-none p-4">
                                        <div className="flex gap-4">
                                            {appt.service.imageUrl ? (
                                                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-stone-100">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={appt.service.imageUrl} alt={appt.service.name} className="object-cover w-full h-full" />
                                                </div>
                                            ) : (
                                                <CategoryPlaceholder category={appt.service.category} size="small" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                                    <h4 className="font-semibold text-slate-800 text-base leading-snug">{appt.service.name}</h4>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${st.color}`}>
                                                        {st.label}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">{appt.service.category}</p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-stone-50 border border-slate-100 px-3 py-1.5 rounded-full">
                                                        <CalendarIcon size={12} className="text-brand" />
                                                        <span className="font-medium capitalize">{dateStr}</span>
                                                    </div>
                                                    {timeStr && (
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-stone-50 border border-slate-100 px-3 py-1.5 rounded-full">
                                                            <Clock size={12} className="text-brand" />
                                                            <span className="font-medium">{timeStr}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {appt.specialist && (
                                                    <p className="mt-2 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full inline-flex items-center gap-1">
                                                        <CheckCircle2 size={12} /> Especialista: {appt.specialist.name}
                                                    </p>
                                                )}
                                                {appt.notes && (
                                                    <p className="mt-2 text-xs text-slate-500 italic">&ldquo;{appt.notes}&rdquo;</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* ── MODAL DE RESERVA ──────────────────────────────────── */}
            {bookingItem && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md mx-auto border border-slate-100 overflow-hidden" style={{ maxHeight: '92vh' }}>

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 leading-snug">{bookingItem.name}</h3>
                                <p className="text-sm text-brand font-semibold mt-0.5">${bookingItem.price.toFixed(2)}</p>
                            </div>
                            <button onClick={closeBookingModal} className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-slate-500 transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>

                            {/* Selector de fecha */}
                            <div>
                                <p className="text-xs font-semibold text-slate-400 tracking-widest uppercase mb-3 flex items-center gap-2">
                                    <CalendarIcon size={14} className="text-brand" /> Selecciona una Fecha
                                </p>

                                <div className="flex items-center justify-between mb-3">
                                    <button
                                        onClick={prevMonth}
                                        disabled={!canGoPrev}
                                        className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 disabled:opacity-30 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronLeft size={15} />
                                    </button>
                                    <span className="text-sm font-semibold text-slate-700 capitalize">{monthLabel}</span>
                                    <button
                                        onClick={nextMonth}
                                        className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronRight size={15} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-7 mb-1">
                                    {['Do','Lu','Ma','Mi','Ju','Vi','Sá'].map(d => (
                                        <div key={d} className="text-center text-xs font-semibold text-slate-400 uppercase py-1">{d}</div>
                                    ))}
                                </div>

                                <div className="space-y-1">
                                    {calWeeks.map((week, wi) => (
                                        <div key={wi} className="grid grid-cols-7 gap-0.5 justify-items-center">
                                            {week.map((day, di) => {
                                                if (!day) return <div key={di} className="w-9 h-9" />;
                                                const isAvailable = AVAILABLE_SET.has(day.toDateString());
                                                const isSelected = selectedDate?.toDateString() === day.toDateString();
                                                const today = new Date(); today.setHours(0,0,0,0);
                                                const isPast = day <= today;
                                                return (
                                                    <button
                                                        key={di}
                                                        onClick={() => isAvailable && !isPast && setSelectedDate(day)}
                                                        disabled={!isAvailable || isPast}
                                                        className={`rounded-full w-9 h-9 text-sm font-medium transition-all flex items-center justify-center
                                                            ${isSelected
                                                                ? 'bg-brand text-white shadow-md shadow-brand/25'
                                                                : isPast || !isAvailable
                                                                    ? 'text-slate-300 cursor-not-allowed'
                                                                    : 'text-slate-700 hover:bg-brand/10'
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
                                    <p className="mt-3 text-xs text-emerald-700 font-semibold text-center bg-emerald-50 rounded-full py-2 border border-emerald-100">
                                        {selectedDate.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                    </p>
                                )}
                            </div>

                            {/* Selector de hora */}
                            {selectedDate && (
                                <div>
                                    <p className="text-xs font-semibold text-slate-400 tracking-widest uppercase mb-3 flex items-center gap-2">
                                        <Clock size={14} className="text-brand" /> Selecciona una Hora
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {TIME_SLOTS.map((slot) => (
                                            <button
                                                key={slot}
                                                onClick={() => setSelectedTime(slot)}
                                                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${selectedTime === slot
                                                    ? 'bg-brand text-white border-brand'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-brand/10'}`}
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
                                    <p className="text-xs font-semibold text-slate-400 tracking-widest uppercase mb-2">Nota para el equipo (opcional)</p>
                                    <textarea
                                        value={bookingNotes}
                                        onChange={(e) => setBookingNotes(e.target.value)}
                                        placeholder="Ej: prefiero por la mañana, tiene alergia a X…"
                                        rows={2}
                                        className="w-full bg-stone-50 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-secondary-500 transition-all"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Footer del modal */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-stone-50">
                            {selectedDate && selectedTime ? (
                                <div className="space-y-3">
                                    <div className="bg-brand/10 border border-brand/20 rounded-xl px-4 py-3 text-sm text-brand">
                                        <span className="font-semibold">{selectedDate.toLocaleDateString('es-PR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                                        {' a las '}
                                        <span className="font-semibold">{selectedTime}</span>
                                        {' · '}
                                        <span className="text-brand font-bold">${bookingItem.price.toFixed(2)}</span>
                                    </div>
                                    <button
                                        onClick={confirmBooking}
                                        disabled={!!buying}
                                        className="w-full bg-brand hover:bg-brand disabled:opacity-60 text-white font-semibold rounded-xl py-3 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 size={16} />
                                        {buying ? 'Confirmando…' : 'Confirmar Reserva'}
                                    </button>
                                </div>
                            ) : (
                                <p className="text-center text-xs text-slate-400 py-1">
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
