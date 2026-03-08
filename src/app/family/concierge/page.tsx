"use client";

import { useEffect, useState } from "react";
import { FaSpa, FaShoppingCart, FaGift, FaWallet, FaCheckCircle, FaHeartbeat } from "react-icons/fa";

interface MarketplaceItem {
    id: string;
    name: string;
    price: number;
    category: string;
    stock?: number;
}

export default function ConciergePage() {
    const [data, setData] = useState<{ products: MarketplaceItem[], services: MarketplaceItem[], balance: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [buying, setBuying] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState("");

    const [errorMsg, setErrorMsg] = useState("");

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

    useEffect(() => {
        loadMarketplace();
    }, []);

    const handlePurchase = async (item: MarketplaceItem, type: 'product' | 'service') => {
        if (!data || data.balance < item.price) {
            if (item.category !== 'GiftCards') {
                alert("Saldo insuficiente para esta operación. Por favor adquiere una Gift Card.");
                return;
            }
        }

        if (!confirm(`¿Confirmas la compra de ${item.name} por $${item.price.toFixed(2)}?`)) return;

        setBuying(item.id);
        setSuccessMsg("");

        try {
            const res = await fetch('/api/family/concierge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, id: item.id, price: item.price })
            });
            const resData = await res.json();

            if (resData.success) {
                setSuccessMsg(`¡${type === 'product' ? 'Compra' : 'Reserva'} exitosa de: ${item.name}!`);
                loadMarketplace(); // Recargar balance
            } else {
                alert(resData.error || "Error al procesar la orden.");
            }
        } catch (e) {
            alert("Error de conexión con el banco. Intenta de nuevo.");
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
            <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center text-3xl mb-4 text-rose-500">⚠️</div>
            <h3 className="text-xl font-bold text-slate-800">Error al cargar el Marketplace</h3>
            <p className="text-slate-500 mt-2">{errorMsg}</p>
        </div>
    );

    if (!data) return null;

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700 pb-10">
            {/* Header & Balance */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -z-0"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2 text-indigo-200">
                            <FaSpa className="text-xl" />
                            <h2 className="text-sm font-black uppercase tracking-widest">Zendity Concierge</h2>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Marketplace de Servicios Adicionales en Vivid</h1>
                        <p className="text-indigo-200/70 font-medium max-w-md">Productos de higiene, terapias especializadas y servicios de estética directo a la habitación.</p>
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
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl font-bold flex items-center gap-3 animate-pulse shadow-sm shadow-emerald-100">
                    <FaCheckCircle className="text-xl" />
                    {successMsg}
                </div>
            )}

            {/* Tratamientos Especiales (Servicios) */}
            <div>
                <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                    <FaHeartbeat className="text-rose-500" /> Especialidades y Terapias
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                    {data.services.map((service) => (
                        <div key={service.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 transition-all group flex flex-col justify-between h-full">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${service.category === 'Belleza' ? 'bg-pink-100 text-pink-500' : 'bg-blue-100 text-blue-500'}`}>
                                        {service.category === 'Belleza' ? <FaSpa className="text-xl" /> : <FaHeartbeat className="text-xl" />}
                                    </div>
                                    <span className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-slate-100">{service.category}</span>
                                </div>
                                <h4 className="font-bold text-slate-800 text-lg leading-tight mb-1">{service.name}</h4>
                                <p className="text-sm font-black text-indigo-600 mb-4">${service.price.toFixed(2)}</p>
                            </div>
                            <button
                                onClick={() => handlePurchase(service, 'service')}
                                disabled={buying === service.id || (data.balance < service.price)}
                                className="w-full py-3 bg-slate-100 hover:bg-indigo-500 text-slate-600 hover:text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 active:scale-95"
                            >
                                {buying === service.id ? 'Reservando...' : 'Reservar Cita'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Productos de Farmacia (Gift Cards) */}
            <div>
                <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                    <FaShoppingCart className="text-sky-500" /> Productos e Insumos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                    {data.products.map((product) => (
                        <div key={product.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-sky-100 transition-all flex flex-col justify-between h-full">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${product.category === 'GiftCards' ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-400'}`}>
                                        {product.category === 'GiftCards' ? <FaGift className="text-xl" /> : <FaShoppingCart className="text-xl" />}
                                    </div>
                                    {product.category === 'GiftCards' && <span className="bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-amber-100">Pre-Pago</span>}
                                </div>
                                <h4 className="font-bold text-slate-800 text-lg leading-tight mb-1">{product.name}</h4>
                                <p className="text-sm font-bold text-slate-500 mb-4">Stock: {(product.stock ?? 0) > 0 ? product.stock : 'Agotado'}</p>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="text-xl font-black text-slate-800">${product.price.toFixed(2)}</div>
                                <button
                                    onClick={() => handlePurchase(product, 'product')}
                                    disabled={buying === product.id}
                                    className={`flex-1 py-3 font-bold rounded-xl transition-all active:scale-95 ${product.category === 'GiftCards'
                                        ? 'bg-amber-100 hover:bg-amber-500 text-amber-700 hover:text-white'
                                        : 'bg-sky-100 hover:bg-sky-500 text-sky-700 hover:text-white'
                                        }`}
                                >
                                    {buying === product.id ? 'Procesando...' : (product.category === 'GiftCards' ? 'Añadir Fondo' : 'Comprar')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
