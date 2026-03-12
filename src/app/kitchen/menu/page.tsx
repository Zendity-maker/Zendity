"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { format, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { UtensilsCrossed, Calendar as CalendarIcon, Save, ChevronLeft, ChevronRight, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function KitchenMenuSync() {
    const { user } = useAuth();
    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    // Menu State
    const [menu, setMenu] = useState({
        breakfast: "",
        lunch: "",
        dinner: "",
        snacks: ""
    });

    useEffect(() => {
        if (!user) return;
        if (user.role !== "KITCHEN" && user.role !== "ADMIN" && user.role !== "DIRECTOR" && !(user as any).secondaryRoles?.includes("KITCHEN")) {
            router.replace("/");
            return;
        }
        fetchMenu(currentDate);
    }, [user, router, currentDate]);

    const fetchMenu = async (date: Date) => {
        setLoading(true);
        setMessage({ type: "", text: "" });
        try {
            const dateStr = date.toISOString().split("T")[0];
            const hqId = user?.headquartersId || user?.hqId;
            const res = await fetch(`/api/kitchen/menu?hqId=${hqId}&date=${dateStr}`);
            const data = await res.json();

            if (data.success && data.menu) {
                setMenu({
                    breakfast: data.menu.breakfast || "",
                    lunch: data.menu.lunch || "",
                    dinner: data.menu.dinner || "",
                    snacks: data.menu.snacks || ""
                });
            } else {
                // Not found for this day, clear inputs
                setMenu({ breakfast: "", lunch: "", dinner: "", snacks: "" });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage({ type: "", text: "" });
        try {
            const dateStr = currentDate.toISOString().split("T")[0];
            const hqId = user?.headquartersId || user?.hqId;

            const res = await fetch(`/api/kitchen/menu`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hqId,
                    date: dateStr,
                    ...menu
                })
            });

            const data = await res.json();
            if (data.success) {
                setMessage({ type: "success", text: "Menú guardado y sincronizado exitosamente con el Wall of Care." });
            } else {
                setMessage({ type: "error", text: data.error || "Fallo al guardar el menú." });
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: "error", text: "Error de red al guardar." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/kitchen" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="w-10 h-10 rounded-xl bg-[#0F6B78] flex items-center justify-center text-white shadow-md">
                            <UtensilsCrossed className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Sincronización de Menú</h1>
                            <p className="text-xs font-bold text-slate-400">TV Dashboard & Wall of Care</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {/* Info Card */}
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-6 flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 text-sky-600">
                        <CalendarIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-sky-900 mb-1">Programador de Menú (Live Sync)</h2>
                        <p className="text-sm text-sky-700">El menú que ingreses aquí se enviará en tiempo real al <strong>Smart TV (Wall of Care)</strong> de la facilidad en las fechas correspondientes. Puedes programar el menú de toda la semana seleccionando los días.</p>
                    </div>
                </div>

                {/* Date Navigation */}
                <div className="bg-white border border-slate-200 rounded-3xl p-4 flex items-center justify-between shadow-sm">
                    <button
                        onClick={() => setCurrentDate(subDays(currentDate, 1))}
                        className="p-3 hover:bg-slate-100 rounded-xl transition text-slate-600"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha del Menú</span>
                        <h2 className="text-2xl font-black text-[#0F6B78] capitalize">
                            {format(currentDate, "EEEE, d 'de' MMMM, yyyy", { locale: es })}
                        </h2>
                    </div>
                    <button
                        onClick={() => setCurrentDate(addDays(currentDate, 1))}
                        className="p-3 hover:bg-slate-100 rounded-xl transition text-slate-600"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm relative overflow-hidden">
                    {loading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
                            <Loader2 className="w-10 h-10 animate-spin text-[#0F6B78]" />
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 focus-within:ring-2 focus-within:ring-orange-200 focus-within:bg-orange-50 transition-all">
                                <label className="block text-sm font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500"></span> Desayuno
                                </label>
                                <textarea
                                    className="w-full bg-transparent border-none p-0 text-slate-800 text-lg font-medium focus:ring-0 resize-none h-20 placeholder:text-slate-300"
                                    placeholder="Ej. Avena con Canela, Tostadas Integrales..."
                                    value={menu.breakfast}
                                    onChange={(e) => setMenu({ ...menu, breakfast: e.target.value })}
                                />
                            </div>

                            <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 focus-within:ring-2 focus-within:ring-emerald-200 focus-within:bg-emerald-50 transition-all">
                                <label className="block text-sm font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Almuerzo
                                </label>
                                <textarea
                                    className="w-full bg-transparent border-none p-0 text-slate-800 text-lg font-medium focus:ring-0 resize-none h-20 placeholder:text-slate-300"
                                    placeholder="Ej. Sopa de Lentejas, Arroz Blanco, Pollo Asado..."
                                    value={menu.lunch}
                                    onChange={(e) => setMenu({ ...menu, lunch: e.target.value })}
                                />
                            </div>

                            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 focus-within:ring-2 focus-within:ring-indigo-200 focus-within:bg-indigo-50 transition-all">
                                <label className="block text-sm font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Cena
                                </label>
                                <textarea
                                    className="w-full bg-transparent border-none p-0 text-slate-800 text-lg font-medium focus:ring-0 resize-none h-20 placeholder:text-slate-300"
                                    placeholder="Ej. Ensalada Mixta, Pescado al Horno..."
                                    value={menu.dinner}
                                    onChange={(e) => setMenu({ ...menu, dinner: e.target.value })}
                                />
                            </div>

                            <div className="bg-purple-50/50 p-6 rounded-2xl border border-purple-100 focus-within:ring-2 focus-within:ring-purple-200 focus-within:bg-purple-50 transition-all">
                                <label className="block text-sm font-black text-purple-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-500"></span> Snacks / Meriendas
                                </label>
                                <textarea
                                    className="w-full bg-transparent border-none p-0 text-slate-800 text-lg font-medium focus:ring-0 resize-none h-20 placeholder:text-slate-300"
                                    placeholder="Ej. Yogurt Griego, Frutas Picadas, Galletas..."
                                    value={menu.snacks}
                                    onChange={(e) => setMenu({ ...menu, snacks: e.target.value })}
                                />
                            </div>
                        </div>

                        {message.text && (
                            <div className={`p-4 rounded-xl font-bold text-sm ${message.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="pt-4 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-[#0F6B78] hover:bg-teal-700 text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-teal-900/20 transition-all flex items-center gap-3 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Guardar y Publicar en Wall of Care
                            </button>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
