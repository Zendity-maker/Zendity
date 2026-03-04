"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Users, UserCog, GraduationCap,
    Activity, ClipboardList, ShieldAlert, Pill,
    Package, Calendar, UserCheck, Receipt, Settings, Scale
} from 'lucide-react';

const SIDEBAR_SECTIONS = [
    {
        title: "Operaciones y Crecimiento",
        links: [
            { name: "Dashboard Global", href: "/corporate", icon: LayoutDashboard },
            { name: "CRM & Ventas", href: "/corporate/crm", icon: Users },
            { name: "Calendario", href: "/corporate/calendar", icon: Calendar },
            { name: "Supervisor Cabina", href: "/corporate/supervisor", icon: UserCheck },
        ]
    },
    {
        title: "Área Clínica / Médica",
        links: [
            { name: "Handovers", href: "/corporate/medical/handovers", icon: ClipboardList },
            { name: "Prevención de Caídas", href: "/corporate/medical/fall-risk", icon: ShieldAlert },
            { name: "UPPs (Úlceras)", href: "/corporate/medical/upp-dashboard", icon: Activity },
            { name: "eMAR", href: "/corporate/medical/emar", icon: Pill },
            { name: "Catálogo Farmacia", href: "/corporate/medical/catalog", icon: Package },
        ]
    },
    {
        title: "Recursos Humanos",
        links: [
            { name: "Gestor RR.HH", href: "/corporate/hr/staff", icon: UserCog },
            { name: "Evaluaciones", href: "/hr", icon: ClipboardList },
            { name: "Zendity Academy", href: "/academy", icon: GraduationCap },
        ]
    },
    {
        title: "Administración",
        links: [
            { name: "Facturación", href: "/corporate/billing", icon: Receipt },
            { name: "Zendity HQ", href: "/corporate/hq", icon: Scale },
            { name: "Integraciones", href: "/corporate/settings/integrations", icon: Settings },
        ]
    }
];

export default function CorporateSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-teal-950 border-r border-teal-900 flex flex-col h-full flex-shrink-0 transition-all duration-300">
            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-teal-800/50">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-sm mr-3">
                    Z
                </div>
                <span className="text-white text-xl font-bold tracking-tight">Zendity <span className="text-teal-400 font-medium">Corp</span></span>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-teal-800/50 [&::-webkit-scrollbar-track]:bg-transparent">
                {SIDEBAR_SECTIONS.map((section, idx) => (
                    <div key={idx} className="mb-6 px-4">
                        <h3 className="text-[11px] font-bold text-teal-600/80 uppercase tracking-widest mb-3 px-3">
                            {section.title}
                        </h3>
                        <ul className="space-y-1">
                            {section.links.map((link) => {
                                const isExact = pathname === link.href;
                                const isNested = link.href !== '/corporate' && pathname?.startsWith(link.href);
                                const isCurrent = isExact || isNested;

                                return (
                                    <li key={link.name}>
                                        <Link
                                            href={link.href}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium group ${isCurrent
                                                ? 'bg-teal-800/60 text-white shadow-sm ring-1 ring-teal-700/50'
                                                : 'text-teal-200/80 hover:bg-teal-900/40 hover:text-white'
                                                }`}
                                        >
                                            <link.icon className={`w-[18px] h-[18px] ${isCurrent
                                                ? 'text-teal-400'
                                                : 'text-teal-500 group-hover:text-teal-400'
                                                } transition-colors`} strokeWidth={isCurrent ? 2.5 : 2} />
                                            {link.name}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>

            {/* Bottom Footer Area */}
            <div className="p-4 border-t border-teal-800/50 bg-teal-950/80">
                <Link href="/" className="group flex items-center justify-center space-x-2 py-2.5 px-3 bg-gradient-to-r from-teal-900 to-teal-800 border border-teal-700/50 rounded-xl hover:from-teal-800 hover:to-teal-700 transition-all hover:shadow-md hover:border-teal-600/50">
                    <span className="text-amber-400 text-base group-hover:scale-110 transition-transform">🏥</span>
                    <span className="text-teal-100 font-semibold tracking-tight text-sm">Módulos Clínicos</span>
                </Link>
            </div>
        </aside>
    );
}
