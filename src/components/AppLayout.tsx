"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ZendiWidget from "./ZendiWidget"; // FASE 9 ZENDI
import {
    LayoutDashboard, Users, UserCog, GraduationCap,
    Activity, ClipboardList, ShieldAlert, Pill,
    Package, Calendar, UserCheck, Receipt, Settings, Scale,
    ChevronDown, Building2, Stethoscope, Search, Bell
} from 'lucide-react';

const clinicalNavigation = [
    { name: 'Insights', href: '/', icon: '📈' },
    { name: 'Intake (Admitir)', href: '/intake', icon: '📥' },
    { name: 'Med & Zoning', href: '/med', icon: '💊' },
    { name: 'Zendity Care (Tablets)', href: '/care', icon: '📱' },
    { name: 'Cabina Supervisor', href: '/care/supervisor', icon: '🔭' },
    { name: 'Life Plan (PAI)', href: '/cuidadores', icon: '🪪' },
    { name: 'Academy', href: '/academy', icon: '🎓' },
];

const corporateNavigationSections = [
    {
        title: "Operaciones y Crecimiento",
        links: [
            { name: "Dashboard Global", href: "/corporate", icon: LayoutDashboard },
            { name: "Planta Física & Mantenimiento", href: "/maintenance", icon: Settings },
            { name: "CRM & Ventas", href: "/corporate/crm", icon: Users },
            { name: "Calendario", href: "/corporate/calendar", icon: Calendar },
            { name: "Concierge Fulfillment", href: "/corporate/concierge", icon: Package },
        ]
    },
    {
        title: "Área Clínica / Médica",
        links: [
            { name: "Directorio Global", href: "/corporate/medical/patients", icon: Users },
            { name: "Handovers", href: "/corporate/medical/handovers", icon: ClipboardList },
            { name: "Prevención de Riesgos", href: "/corporate/medical/fall-risk", icon: ShieldAlert },
            { name: "UPPs (Úlceras)", href: "/corporate/medical/upp-dashboard", icon: Activity },
            { name: "eMAR Audit", href: "/corporate/medical/emar", icon: Pill },
            { name: "Catálogo Farmacia", href: "/corporate/medical/catalog", icon: Package },
        ]
    },
    {
        title: "Recursos Humanos",
        links: [
            { name: "Desempeño & Evaluaciones", href: "/hr", icon: ClipboardList },
            { name: "Directorio Staff", href: "/hr/staff", icon: UserCog },
            { name: "Zendity Academy", href: "/academy", icon: GraduationCap },
        ]
    },
    {
        title: "Administración",
        links: [
            { name: "Facturación", href: "/corporate/billing", icon: Receipt },
            { name: "Localizaciones", href: "/locations", icon: Building2 },
            { name: "Zendity HQ", href: "/corporate/hq", icon: Scale },
        ]
    }
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, loading } = useAuth();
    const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

    if (loading) return null;

    const isAuthRoute = pathname === "/login";
    const isFamilyRoute = pathname.startsWith("/family");

    // Si estamos en auth o family, renderizamos sin sidebar unificado (tienen su propio layout)
    if (isAuthRoute || isFamilyRoute) {
        return <div className="w-full h-full">{children}</div>;
    }

    // Determinar Workspace Activo basado en la ruta interactiva ("Clinical" vs "Corporate")
    const isCorporateWorkspace = pathname.startsWith("/corporate") || pathname.startsWith("/locations") || pathname.startsWith("/hr");

    // Sidebar colors and styles based on workspace
    const sidebarBg = isCorporateWorkspace ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-600";
    const sidebarLogoText = isCorporateWorkspace ? "text-white" : "text-teal-900";
    const sidebarHoverItem = isCorporateWorkspace ? "hover:bg-slate-800 hover:text-white" : "hover:bg-teal-50 hover:text-teal-800";
    const sidebarActiveItem = isCorporateWorkspace ? "bg-slate-800 text-teal-400 font-bold border border-slate-700/50 shadow-sm" : "bg-teal-50 text-teal-800 border border-teal-100 font-bold shadow-sm";

    return (
        <div className="flex w-full h-screen overflow-hidden bg-slate-50 font-sans">
            <ZendiWidget />

            {/* Unified Sidebar */}
            <aside className={`w-64 border-r flex flex-col shadow-sm transition-colors duration-300 flex-shrink-0 z-50 ${sidebarBg}`}>
                {/* Workspace Switcher / Logo */}
                <div className="h-20 flex items-center justify-between px-5 border-b border-opacity-20 border-current relative">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shadow-md ${isCorporateWorkspace ? 'bg-gradient-to-br from-teal-500 to-teal-700 text-white' : 'bg-gradient-to-br from-teal-100 to-teal-200 text-teal-800'}`}>
                            Z
                        </div>
                        <div className="flex flex-col">
                            <h1 className={`text-xl font-black tracking-tight leading-tight ${sidebarLogoText}`}>Zendity</h1>
                            <span className="text-[10px] uppercase font-black tracking-widest text-teal-500">
                                {isCorporateWorkspace ? 'Corporate HQ' : 'Clinical Care'}
                            </span>
                        </div>
                    </div>

                    {/* Workspace Selector (Solo para roles compatibles) */}
                    {(user?.role === "ADMIN" || user?.role === "DIRECTOR") && (
                        <button
                            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
                            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        >
                            <ChevronDown className="w-4 h-4 opacity-70" />
                        </button>
                    )}

                    {workspaceMenuOpen && (
                        <div className="absolute top-16 left-4 right-4 bg-white rounded-xl shadow-xl border border-slate-200 p-2 text-slate-800 animate-in fade-in slide-in-from-top-2 z-50">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2 mt-1">Cambiar Entorno</p>
                            <button
                                onClick={() => { router.push("/"); setWorkspaceMenuOpen(false); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${!isCorporateWorkspace ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-50 text-slate-600'}`}
                            >
                                <Stethoscope className="w-4 h-4" /> Entorno Clínico
                            </button>
                            <button
                                onClick={() => { router.push("/corporate"); setWorkspaceMenuOpen(false); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${isCorporateWorkspace ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                            >
                                <Building2 className="w-4 h-4" /> Global Corporativo
                            </button>
                        </div>
                    )}
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-1 custom-scrollbar">
                    {isCorporateWorkspace ? (
                        corporateNavigationSections.map((section, idx) => (
                            <div key={idx} className="mb-6">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-3">
                                    {section.title}
                                </h3>
                                <ul className="space-y-1">
                                    {section.links.map((link) => {
                                        const isExact = pathname === link.href;
                                        const isNested = link.href !== '/corporate' && pathname?.startsWith(link.href);
                                        const isCurrent = isExact || isNested;
                                        const Icon = link.icon;
                                        return (
                                            <li key={link.name}>
                                                <Link
                                                    href={link.href}
                                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${isCurrent ? sidebarActiveItem : sidebarHoverItem}`}
                                                >
                                                    <Icon className="w-[18px] h-[18px]" strokeWidth={isCurrent ? 2.5 : 2} />
                                                    {link.name}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))
                    ) : (
                        clinicalNavigation.map((item) => {
                            // FASE 30: Hide Cabina Supervisor from ordinary Caregivers
                            if (user?.role === "CAREGIVER" && item.href === '/care/supervisor') return null;

                            const isCurrent = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-colors duration-200 mb-1 ${isCurrent ? sidebarActiveItem : sidebarHoverItem}`}
                                >
                                    <span className="mr-3 text-lg">{item.icon}</span>
                                    {item.name}
                                </Link>
                            )
                        })
                    )}
                </nav>

                {/* User Profile / Logout */}
                <div className="p-4 border-t border-opacity-20 border-current">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-sm ${isCorporateWorkspace ? 'bg-slate-800 text-teal-400' : 'bg-teal-100 text-teal-700'}`}>
                            {user?.name.substring(0, 2).toUpperCase() || 'HQ'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-bold truncate">{user?.name || 'Clínico'}</p>
                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider truncate">{user?.role || 'Staff'}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className={`w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl transition shadow-sm border ${isCorporateWorkspace ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-rose-900/50 hover:text-rose-400 hover:border-rose-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'}`}
                    >
                        <span>⏻</span> Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 relative">
                {/* Unified Topbar */}
                <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-8 z-40 sticky top-0 shadow-sm flex-shrink-0">
                    <div className="flex items-center flex-1 max-w-xl">
                        {isCorporateWorkspace && user?.role === "ADMIN" ? (
                            <div className="relative w-full group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-teal-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar residentes, métricas, reportes..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border border-slate-200 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400 text-slate-700"
                                />
                            </div>
                        ) : (
                            <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-4 py-1.5 rounded-full border border-emerald-200/60 flex items-center gap-2 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Sede Activa: {user?.hqName || user?.hqId || 'Principal'}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center space-x-6">
                        <button className="relative p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-all focus:outline-none">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 main-content relative [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
                    {children}
                </div>
            </main>
        </div>
    );
}
