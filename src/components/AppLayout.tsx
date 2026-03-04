"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ZendiWidget from "./ZendiWidget"; // FASE 9 ZENDI

const navigation = [
    { name: 'Insights', href: '/', icon: '📈' },
    { name: 'Intake (Admitir)', href: '/intake', icon: '📥' },
    { name: 'Med & Zoning', href: '/med', icon: '💊' },
    { name: 'Zendity Care (Tablets)', href: '/care', icon: '📱' },
    { name: 'Life Plan (PAI)', href: '/cuidadores', icon: '🪪' },
    { name: 'HQ & Audit', href: '/corporate/hq', icon: '🏛️' },
    { name: 'Academy', href: '/academy', icon: '🎓' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, logout, loading } = useAuth();

    if (loading) return null;

    const isAuthRoute = pathname === "/login";
    const isCorporateRoute = pathname.startsWith("/corporate") || pathname.startsWith("/locations") || pathname.startsWith("/hr");
    const isFamilyRoute = pathname.startsWith("/family");

    if (isAuthRoute) {
        return <div className="w-full min-h-screen">{children}</div>;
    }

    // Renderizar sidebar clínico únicamente si estamos en zonas clínicas ("/" o "/med" o "/academy", etc.)
    const renderSidebar = !isCorporateRoute && !isFamilyRoute;

    return (
        <>
            <ZendiWidget />
            {renderSidebar ? (
                <div className="flex w-full h-screen overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
                        <div className="h-16 flex justify-between items-center px-6 border-b border-slate-100">
                            <div className="flex gap-2 items-center">
                                <svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" className="text-teal-800">
                                    <path d="M 20 25 H 75 L 25 75 H 80" />
                                </svg>
                                <h1 className="text-2xl font-black text-teal-900 tracking-tight">Zendity</h1>
                            </div>
                        </div>
                        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                            {navigation.map((item) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${pathname === item.href ? 'bg-teal-50 text-teal-800 border border-teal-100' : 'text-slate-600 hover:bg-slate-50 hover:text-teal-800'}`}
                                >
                                    <span className="mr-3 text-lg">{item.icon}</span>
                                    {item.name}
                                </Link>
                            ))}
                        </nav>
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 w-full">
                                    <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold shadow-sm">
                                        {user?.name.substring(0, 2).toUpperCase() || 'HQ'}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-bold text-slate-800 truncate">{user?.name || 'Clínico'}</p>
                                        <p className="text-xs text-teal-600 font-medium uppercase tracking-wider">{user?.role === 'NURSE' ? 'Enfermería' : 'Staff'}</p>
                                    </div>
                                </div>
                            </div>
                            <button onClick={logout} className="mt-4 w-full flex items-center justify-center gap-2 text-xs bg-white border border-slate-200 text-slate-700 font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 py-2.5 rounded-xl transition shadow-sm">
                                <span>⏻</span> Cerrar Sesión
                            </button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
                        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-10 sticky top-0">
                            <div className="flex items-center space-x-4">
                                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Sede Activa: {user?.hqId || 'Principal'}
                                </span>
                            </div>
                            <div className="flex items-center space-x-4">
                                <button className="text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-full">🔔 Notificaciones</button>
                            </div>
                        </header>
                        <div className="flex-1 overflow-y-auto p-8 main-content relative">
                            {/* Elementos decorativos (Opcional) */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 rounded-full blur-3xl opacity-50 -z-10 -mr-20 -mt-20"></div>
                            {children}
                        </div>
                    </main>
                </div>
            ) : (
                <div className="w-full h-screen bg-slate-50 flex flex-col">
                    <div className="flex-1 w-full h-full">
                        {children}
                    </div>
                    {/* Botón Flotante Global para Salir de Módulos Específicos (Corporate/Family) */}
                    <button onClick={logout} className="fixed bottom-6 right-6 bg-slate-900 border border-slate-800 hover:bg-red-600 hover:border-red-500 text-white shadow-2xl hover:shadow-red-500/20 px-5 py-3 rounded-full text-sm font-bold z-50 transition-all flex items-center gap-2 group">
                        <span className="group-hover:text-red-200">⏻</span> Cerrar Sesión
                    </button>
                </div>
            )}
        </>
    );
}
