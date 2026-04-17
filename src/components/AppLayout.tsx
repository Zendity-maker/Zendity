"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ZendiWidget from "./ZendiWidget"; // FASE 9 ZENDI
import StaffChat from "./StaffChat"; // FASE 81 — Chat interno staff
import BackToDashboard from "./ui/BackToDashboard";
import {
    LayoutDashboard, Users, UserCog, GraduationCap,
    Activity, ClipboardList, ShieldAlert, Pill,
    Package, Calendar, UserCheck, Receipt, Settings, Scale,
    ChevronDown, ChevronLeft, ChevronRight, Building2, Stethoscope, Search, Bell, Menu, X,
    LineChart, UserPlus, Smartphone, Eye, FileText, Utensils, CalendarDays, Monitor, SprayCan,
    Info, AlertTriangle, CheckCircle2, Users as UsersIcon, MessageSquare
} from 'lucide-react';
import { UserIcon } from "@heroicons/react/24/outline";

const clinicalNavigation = [
    { name: 'Insights', href: '/', icon: LineChart },
    { name: 'Intake (Admitir)', href: '/intake', icon: UserPlus },
    { name: 'Med & Zoning', href: '/med', icon: Pill },
    { name: 'Zendity Care (Tablets)', href: '/care', icon: Smartphone },
    { name: 'Vitales', href: '/care/vitals', icon: Activity },
    { name: 'Triage & Supervisión', href: '/care/supervisor', icon: ShieldAlert },
    { name: 'Handovers Clínicos', href: '/nursing/handovers', icon: ClipboardList },
    { name: 'Life Plan (PAI)', href: '/cuidadores', icon: FileText },
    { name: 'Cocina y Nutrición', href: '/kitchen', icon: Utensils },
    { name: 'Academy', href: '/academy', icon: GraduationCap },
];

const corporateNavigationSections = [
    {
        title: "Operaciones y Crecimiento",
        links: [
            { name: "Dashboard Global", href: "/corporate", icon: LayoutDashboard },
            { name: "Cierre de Turno", href: "/corporate/shift-closure", icon: LayoutDashboard },
            { name: "Triage Center", href: "/corporate/triage", icon: ShieldAlert },
            { name: "Planta Física & Mantenimiento", href: "/maintenance", icon: Settings },
            { name: "Limpieza & Sanitización", href: "/corporate/cleaning", icon: SprayCan },
            { name: "CRM & Ventas", href: "/corporate/crm", icon: Users },
            { name: "Calendario", href: "/corporate/calendar", icon: Calendar },
            { name: "Concierge Fulfillment", href: "/corporate/concierge", icon: Package },
        ]
    },
    {
        title: "Área Clínica / Médica",
        links: [
            { name: "Admisión de Residentes", href: "/corporate/patients/intake", icon: UserPlus },
            { name: "Directorio Global", href: "/corporate/medical/patients", icon: Users },
            { name: "Handovers", href: "/nursing/handovers", icon: ClipboardList },
            { name: "Prevención de Riesgos", href: "/corporate/medical/fall-risk", icon: ShieldAlert },
            { name: "UPPs (Úlceras)", href: "/corporate/medical/upp-dashboard", icon: Activity },
            { name: "eMAR Audit", href: "/corporate/medical/emar", icon: Pill },
            { name: "Catálogo Farmacia", href: "/corporate/medical/catalog", icon: Package },
            { name: "Trabajo Social", href: "/corporate/social", icon: Users },
        ]
    },
    {
        title: "Recursos Humanos",
        links: [
            { name: "Alertas Zendi AI", href: "/hr/insights", icon: ShieldAlert },
            { name: "Desempeño & Evaluaciones", href: "/hr", icon: ClipboardList },
            { name: "Constructor de Horarios", href: "/hr/schedule", icon: CalendarDays },
            { name: "Directorio Staff", href: "/hr/staff", icon: UserCog },
            { name: "Zendity Academy", href: "/academy", icon: UserCheck },
        ]
    },
    {
        title: "Administración",
        links: [
            { name: "Facturación", href: "/corporate/billing", icon: Receipt },
            { name: "Documentos de Admisión", href: "/corporate/intake", icon: FileText },
            { name: "Localizaciones", href: "/locations", icon: Building2 },
            { name: "Zendity HQ", href: "/corporate/hq", icon: Scale },
            { name: "Registro de Visitas", href: "/reception/visits", icon: ClipboardList },
            { name: "Kiosco de Recepción", href: "/reception", icon: Monitor },
        ]
    }
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, loading } = useAuth();
    const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
    const [sidebarMode, setSidebarMode] = useState<'expanded' | 'collapsed' | 'hidden'>(
        typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'expanded' : 'collapsed'
    );
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [staffChatOpen, setStaffChatOpen] = useState(false);
    const [staffChatUnread, setStaffChatUnread] = useState(0);
    const workspaceSwitcherRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    // Click-outside handler for workspace switcher
    useEffect(() => {
        if (!workspaceMenuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (workspaceSwitcherRef.current && !workspaceSwitcherRef.current.contains(e.target as Node)) {
                setWorkspaceMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [workspaceMenuOpen]);

    // Click-outside handler for notification panel
    useEffect(() => {
        if (!notifOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [notifOpen]);

    // Fetch notifications on mount and periodically
    const fetchNotifications = React.useCallback(async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`/api/notifications?userId=${user.id}`);
            const data = await res.json();
            if (data.success) {
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            }
        } catch (e) {
            console.error('Error fetching notifications', e);
        }
    }, [user?.id]);

    useEffect(() => {
        if (user?.id) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(interval);
        }
    }, [user?.id, fetchNotifications]);

    const markAllRead = async () => {
        if (!user?.id || unreadCount === 0) return;
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, all: true }),
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error('Error marking notifications read', e);
        }
    };

    const timeAgo = (dateStr: string) => {
        const now = Date.now();
        const diff = now - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'ahora';
        if (mins < 60) return `hace ${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `hace ${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `hace ${days}d`;
    };

    const getNotifUrl = (notif: any): string | null => {
        switch (notif.type) {
            case 'SHIFT_ALERT':      return '/care/supervisor';
            case 'EMAR_ALERT':       return '/care/supervisor';
            case 'COURSE_COMPLETED': return '/academy';
            case 'FAMILY_VISIT':     return '/reception';
            case 'TRIAGE':           return '/corporate/triage';
            case 'HANDOVER':         return '/care/supervisor';
            case 'STAFF_MESSAGE':    return 'STAFF_CHAT'; // Sentinel — abre el panel, no navega
            default:                 return null;
        }
    };

    const handleNotifClick = async (notif: any) => {
        // 1. Mark as read
        if (!notif.isRead) {
            try {
                await fetch('/api/notifications', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user?.id, ids: [notif.id] }),
                });
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (e) {
                console.error('Error marking notification read', e);
            }
        }
        // 2. Close notif panel
        setNotifOpen(false);
        // 3. Action según tipo
        const url = getNotifUrl(notif);
        if (url === 'STAFF_CHAT') {
            setStaffChatOpen(true);
        } else if (url) {
            router.push(url);
        }
    };

    const notifIcon = (type: string) => {
        switch (type) {
            case 'warning': case 'SHIFT_ALERT': case 'EMAR_ALERT':
                return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
            case 'success': case 'ACADEMY': case 'COURSE_COMPLETED':
                return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
            case 'FAMILY_VISIT':
                return <UsersIcon className="w-4 h-4 text-indigo-500 shrink-0" />;
            case 'STAFF_MESSAGE':
                return <MessageSquare className="w-4 h-4 text-teal-500 shrink-0" />;
            default:
                return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
        }
    };

    useEffect(() => {
        const w = window.innerWidth;
        if (w >= 1024) setSidebarMode('expanded');
        else if (w >= 768) setSidebarMode('collapsed');
        else setSidebarMode('hidden');
    }, []);

    const isSidebarCollapsed = sidebarMode === 'collapsed';
    const isSidebarVisible = sidebarMode !== 'hidden';

    const toggleSidebar = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setMobileDrawerOpen(v => !v);
        } else {
            setSidebarMode(prev => prev === 'expanded' ? 'collapsed' : 'expanded');
        }
    };

    // Rutas full-screen que tienen su propio layout (sin sidebar ni topbar de AppLayout)
    const isFullScreenRoute =
        pathname === "/login" ||
        pathname === "/reception" ||
        pathname.startsWith("/care") ||
        pathname.startsWith("/cleaning") ||
        pathname.startsWith("/family") ||
        pathname.startsWith("/wall");

    if (isFullScreenRoute) {
        const showBackButton = pathname.startsWith('/care') && pathname !== '/care';
        return (
            <div className="w-full h-full">
                {showBackButton && <BackToDashboard />}
                {children}
            </div>
        );
    }

    if (loading || !user) return null;

    // Determinar Workspace Activo basado en la ruta interactiva ("Clinical" vs "Corporate")
    const isCorporateWorkspace = pathname.startsWith("/corporate") || pathname.startsWith("/locations") || pathname.startsWith("/hr");

    // Sidebar colors and styles based on workspace
    const sidebarBg = isCorporateWorkspace ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-600";
    const sidebarLogoText = isCorporateWorkspace ? "text-white" : "text-teal-900";
    const sidebarHoverItem = isCorporateWorkspace ? "hover:bg-slate-800 hover:text-white" : "hover:bg-slate-50 hover:text-teal-700";
    const sidebarActiveItem = isCorporateWorkspace ? "bg-slate-800 text-teal-400 font-bold border border-slate-700/50 shadow-sm" : "bg-teal-50 text-teal-700 border border-teal-100 font-bold shadow-sm";

    return (
        <div className="flex w-full h-screen overflow-hidden bg-slate-50 font-sans">
            <ZendiWidget />

            {/* FASE 81: Chat interno staff (oculto para FAMILY) */}
            {user?.role !== 'FAMILY' && (
                <StaffChat
                    open={staffChatOpen}
                    onClose={() => setStaffChatOpen(false)}
                    onUnreadChange={setStaffChatUnread}
                />
            )}

            {/* Unified Sidebar — hidden on mobile, collapsible on tablet */}
            <aside className={`${isSidebarCollapsed ? 'w-14' : 'w-56'} border-r hidden md:flex flex-col h-screen shadow-sm transition-all duration-200 flex-shrink-0 z-50 ${sidebarBg}`}>
                {/* Workspace Switcher / Logo */}
                <div className="h-20 flex items-center justify-between px-4 border-b border-opacity-20 border-current relative">
                    <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                        {isSidebarCollapsed ? (
                            <img 
                                src={isCorporateWorkspace ? "/brand/zendity_icon_white.svg" : "/brand/zendity_icon_primary.svg"} 
                                alt="Zendity Icon" 
                                className="w-11 h-11 object-contain drop-shadow-sm shrink-0" 
                            />
                        ) : (
                            <div className="flex flex-col whitespace-nowrap overflow-hidden min-w-0">
                                <img 
                                    src={isCorporateWorkspace ? "/brand/zendity_logo_white.svg" : "/brand/zendity_logo_primary.svg"} 
                                    alt="Zendity Logo" 
                                    className="h-10 w-auto max-w-[140px] object-contain mb-1 shrink-0" 
                                />
                                <span className="text-[10px] uppercase font-black tracking-widest text-teal-400 pl-1 truncate">
                                    {isCorporateWorkspace ? 'Corporate HQ' : 'Clinical Care'}
                                </span>
                            </div>
                        )}
                    </div>

                </div>

                {/* Navigation Links */}
                <nav className="flex-1 min-h-0 overflow-y-auto py-5 px-3 space-y-1 custom-scrollbar overflow-x-hidden">
                    {isCorporateWorkspace ? (
                        corporateNavigationSections.map((section, idx) => (
                            <div key={idx} className="mb-6">
                                {!isSidebarCollapsed && (
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-3">
                                        {section.title}
                                    </h3>
                                )}
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
                                                    title={isSidebarCollapsed ? link.name : undefined}
                                                    className={`flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${isCurrent ? sidebarActiveItem : sidebarHoverItem} ${isSidebarCollapsed ? 'justify-center px-0 min-w-11 min-h-11' : 'px-3'}`}
                                                >
                                                    <Icon className={`shrink-0 ${isSidebarCollapsed ? 'w-6 h-6' : 'w-[18px] h-[18px]'}`} strokeWidth={isCurrent ? 2.5 : 2} />
                                                    {!isSidebarCollapsed && <span className="truncate">{link.name}</span>}
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
                            // Vitales: solo NURSE, SUPERVISOR, DIRECTOR, ADMIN
                            if (item.href === '/care/vitals' && !['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'].includes(user?.role || '')) return null;

                            const isCurrent = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    title={isSidebarCollapsed ? item.name : undefined}
                                    className={`flex items-center gap-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 mb-1 ${isCurrent ? sidebarActiveItem : sidebarHoverItem} ${isSidebarCollapsed ? 'justify-center px-0 min-w-11 min-h-11' : 'px-3'}`}
                                >
                                    <Icon className={`shrink-0 ${isSidebarCollapsed ? 'w-6 h-6' : 'w-[18px] h-[18px]'}`} strokeWidth={isCurrent ? 2.5 : 2} />
                                    {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                                </Link>
                            )
                        })
                    )}
                </nav>

                {/* User Profile / Logout */}
                <div className="p-4 border-t border-opacity-20 border-current flex flex-col gap-2">
                    <button
                        onClick={() => setSidebarMode(prev => prev === 'expanded' ? 'collapsed' : 'expanded')}
                        className={`flex items-center justify-center p-2 rounded-lg transition-colors border ${isCorporateWorkspace ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                        title={isSidebarCollapsed ? "Expandir Menú" : "Contraer Menú"}
                    >
                        {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                    {!isSidebarCollapsed && (
                        <>
                            <div className="flex items-center space-x-3 mb-2 px-1 text-left">
                                <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center font-bold shadow-sm ${isCorporateWorkspace ? 'bg-slate-800 text-teal-400 border border-slate-700' : 'bg-teal-50 text-teal-700 border border-teal-100'}`}>
                                    {user?.name.substring(0, 2).toUpperCase() || 'HQ'}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-bold truncate">{user?.name || 'Clínico'}</p>
                                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider truncate">{user?.role || 'Staff'}</p>
                                </div>
                            </div>
                            <Link href={isCorporateWorkspace ? `/corporate/hr/staff/${user?.id}` : `/hr/staff/${user?.id}`} className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl transition shadow-sm border bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800">
                                <UserIcon className="w-4 h-4 shrink-0" /> Mi Perfil
                            </Link>
                            <button
                                onClick={logout}
                                className={`w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl transition shadow-sm border ${isCorporateWorkspace ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-rose-900/50 hover:text-rose-400 hover:border-rose-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'}`}
                            >
                                <span></span> Cerrar Sesión
                            </button>
                        </>
                    )}
                    {isSidebarCollapsed && (
                        <>
                            <Link href={isCorporateWorkspace ? `/corporate/hr/staff/${user?.id}` : `/hr/staff/${user?.id}`} title="Mi Perfil" className="w-full flex justify-center py-2 text-xs font-bold rounded-xl transition shadow-sm border bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800">
                                <UserIcon className="w-5 h-5" />
                            </Link>
                            <button
                                onClick={logout}
                                title="Cerrar Sesión"
                                className={`w-full flex justify-center py-2 text-xs font-bold rounded-xl transition shadow-sm border ${isCorporateWorkspace ? 'bg-slate-800 border-slate-700 text-rose-400 hover:bg-rose-900/50 hover:border-rose-900' : 'bg-white border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200'}`}
                            >
                                <span></span>
                            </button>
                        </>
                    )}
                </div>
            </aside>

            {/* Mobile Drawer Overlay */}
            {mobileDrawerOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileDrawerOpen(false)} />
                    <aside className={`absolute left-0 top-0 bottom-0 w-64 border-r flex flex-col shadow-xl animate-in slide-in-from-left duration-200 ${sidebarBg}`}>
                        <div className="h-16 flex items-center justify-between px-4 border-b border-opacity-20 border-current">
                            <div className="flex items-center gap-3">
                                <img
                                    src={isCorporateWorkspace ? "/brand/zendity_logo_white.svg" : "/brand/zendity_logo_primary.svg"}
                                    alt="Zendity"
                                    className="h-8 w-auto object-contain"
                                />
                            </div>
                            <button onClick={() => setMobileDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-black/10 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                            {isCorporateWorkspace ? (
                                corporateNavigationSections.map((section, idx) => (
                                    <div key={idx} className="mb-5">
                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-3">{section.title}</h3>
                                        <ul className="space-y-1">
                                            {section.links.map((link) => {
                                                const isCurrent = pathname === link.href || (link.href !== '/corporate' && pathname?.startsWith(link.href));
                                                const Icon = link.icon;
                                                return (
                                                    <li key={link.name}>
                                                        <Link href={link.href} onClick={() => setMobileDrawerOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isCurrent ? sidebarActiveItem : sidebarHoverItem}`}>
                                                            <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isCurrent ? 2.5 : 2} />
                                                            <span className="truncate">{link.name}</span>
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))
                            ) : (
                                clinicalNavigation.map((item) => {
                                    if (user?.role === "CAREGIVER" && item.href === '/care/supervisor') return null;
                                    if (item.href === '/care/vitals' && !['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'].includes(user?.role || '')) return null;
                                    const isCurrent = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                                    const Icon = item.icon;
                                    return (
                                        <Link key={item.name} href={item.href} onClick={() => setMobileDrawerOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all mb-1 ${isCurrent ? sidebarActiveItem : sidebarHoverItem}`}>
                                            <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isCurrent ? 2.5 : 2} />
                                            <span className="truncate">{item.name}</span>
                                        </Link>
                                    );
                                })
                            )}
                        </nav>
                        <div className="p-3 border-t border-opacity-20 border-current space-y-2">
                            <Link href={isCorporateWorkspace ? `/corporate/hr/staff/${user?.id}` : `/hr/staff/${user?.id}`} onClick={() => setMobileDrawerOpen(false)} className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl shadow-sm border bg-indigo-50 border-indigo-200 text-indigo-700">
                                <UserIcon className="w-4 h-4 shrink-0" /> Mi Perfil
                            </Link>
                            <button onClick={logout} className={`w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl shadow-sm border ${isCorporateWorkspace ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                                <span>🚪</span> Cerrar Sesión
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 relative">
                {/* Unified Topbar */}
                <header className="h-16 md:h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-40 sticky top-0 shadow-sm flex-shrink-0 gap-3">
                    {/* Hamburger — visible on mobile always, on tablet/desktop as extra toggle */}
                    <button onClick={toggleSidebar} className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors shrink-0 lg:hidden">
                        <Menu className="w-5 h-5 text-slate-600" />
                    </button>

                    {/* Workspace Switcher — topbar, siempre accesible */}
                    {(user?.role === "ADMIN" || user?.role === "DIRECTOR" || user?.role === "SUPERVISOR") && (
                        <div ref={workspaceSwitcherRef} className="relative shrink-0">
                            <button
                                onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold border transition-all shadow-sm ${isCorporateWorkspace ? 'bg-slate-900 text-white border-slate-700 hover:bg-slate-800' : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'}`}
                            >
                                {isCorporateWorkspace ? <Building2 className="w-3.5 h-3.5" /> : <Stethoscope className="w-3.5 h-3.5" />}
                                <span className="hidden sm:inline">{isCorporateWorkspace ? 'Corporate HQ' : 'Clinical Care'}</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${workspaceMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {workspaceMenuOpen && (
                                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2 mt-1">Cambiar Entorno</p>
                                    <button
                                        onClick={() => { router.push("/"); setWorkspaceMenuOpen(false); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${!isCorporateWorkspace ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                    >
                                        <Stethoscope className="w-4 h-4" /> {"Entorno Clínico"}
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
                    )}

                    <div className="flex items-center flex-1 max-w-xl">
                        {isCorporateWorkspace && user?.role === "ADMIN" ? (
                            <div className="relative w-full group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-teal-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar residentes, métricas, reportes..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400 text-slate-700"
                                />
                            </div>
                        ) : (
                            <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-4 py-1.5 rounded-full border border-emerald-200/60 flex items-center gap-2 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Sede Activa: {user?.hqName || user?.hqId || 'Principal'}
                            </span>
                        )}
                    </div>

                    {/* Chat interno staff — botón con badge (oculto para FAMILY) */}
                    {user?.role !== 'FAMILY' && (
                        <button
                            onClick={() => setStaffChatOpen(v => !v)}
                            className="relative p-2 text-slate-400 hover:text-teal-600 hover:bg-soft-mist rounded-full transition-all focus:outline-none"
                            title="Chat interno"
                        >
                            <MessageSquare className="w-5 h-5" />
                            {staffChatUnread > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-teal-500 rounded-full border-2 border-white text-[10px] font-bold text-white leading-none px-1">
                                    {staffChatUnread > 9 ? '9+' : staffChatUnread}
                                </span>
                            )}
                        </button>
                    )}

                    <div ref={notifRef} className="relative flex items-center">
                        <button
                            onClick={() => setNotifOpen(!notifOpen)}
                            className="relative p-2 text-slate-400 hover:text-zendity-teal hover:bg-soft-mist rounded-full transition-all focus:outline-none"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 rounded-full border-2 border-white text-[10px] font-bold text-white leading-none px-1">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {notifOpen && (
                            <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                    <h4 className="font-bold text-sm text-slate-800">Notificaciones</h4>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
                                        >
                                            Marcar todas leidas
                                        </button>
                                    )}
                                </div>

                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-sm text-slate-400 font-medium">Sin notificaciones</p>
                                        </div>
                                    ) : (
                                        notifications.map(n => {
                                            const url = getNotifUrl(n);
                                            return (
                                                <div
                                                    key={n.id}
                                                    onClick={() => handleNotifClick(n)}
                                                    className={`px-4 py-3 border-b border-slate-50 flex items-start gap-3 transition-colors cursor-pointer ${!n.isRead ? 'bg-teal-50/60 hover:bg-teal-100/60' : 'hover:bg-slate-50'}`}
                                                >
                                                    <div className="mt-0.5">{notifIcon(n.type)}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm truncate ${!n.isRead ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>{n.title}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
                                                        <span className="text-[10px] text-slate-400 font-medium">{timeAgo(n.createdAt)}</span>
                                                        {url && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                                                    </div>
                                                </div>
                                            );
                                        })

                                    )}
                                </div>
                            </div>
                        )}
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
// cache-bust Tue Mar 31 17:54:26 AST 2026
