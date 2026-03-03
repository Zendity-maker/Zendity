import { Metadata } from 'next';
import Link from 'next/link';
import {
    FaUserInjured, FaUsers, FaChartPie, FaCogs,
    FaSignOutAlt, FaBrain, FaFileInvoiceDollar, FaLaptopMedical, FaPills
} from "react-icons/fa";

export const metadata: Metadata = {
    title: 'Zendity | Corporate Dashboard',
    description: 'Zendity Global Management Dashboard',
};

export default function CorporateLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Assuming 'pathname' would be available from usePathname() if this were a client component,
    // but for a layout, it's often passed or derived. For this insertion, we'll assume it's
    // meant to be a placeholder for dynamic styling.
    const pathname = ''; // Placeholder for demonstration based on the provided snippet

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Top Corporate Navigation */}
            <header className="bg-teal-950 border-b border-teal-900 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-3">
                            {/* Zendity Isologo */}
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                Z
                            </div>
                            <span className="text-white text-xl font-bold tracking-tight">Zendity <span className="text-teal-400 font-medium">Corporate</span></span>
                        </div>

                        <div className="flex items-center space-x-6 text-sm font-medium">
                            <Link href="/corporate" className="text-teal-400 hover:text-white transition-colors">Dashboard Global</Link>
                            <Link href="/corporate/hq" className="text-teal-200 hover:text-white transition-colors">Zendity HQ (Cumplimiento)</Link>
                            <Link href="/hr" className="text-teal-200 hover:text-white transition-colors">RRHH & Evaluaciones</Link>
                            <Link href="/academy" className="text-teal-200 hover:text-white transition-colors">Zendity Academy</Link>

                            {/* Menu Corporate Navigation Links */}
                            <div className="w-px h-6 bg-teal-800 mx-2"></div> {/* Separator */}

                            <Link href="/corporate/crm" className="text-teal-200 hover:text-teal-400 transition-colors flex items-center gap-1 font-bold">
                                CRM & Ventas
                            </Link>

                            <Link href="/corporate/medical/handovers" className="text-teal-200 hover:text-white transition-colors flex items-center gap-1">
                                <FaUserInjured className="text-base" /> Handovers
                            </Link>
                            <Link href="/corporate/medical/upp-dashboard" className="text-teal-200 hover:text-white transition-colors flex items-center gap-1">
                                <FaLaptopMedical className="text-base" /> UPPs
                            </Link>
                            <Link href="/corporate/medical/fall-risk" className="text-teal-200 hover:text-white transition-colors flex items-center gap-1">
                                <FaUserInjured className="text-base" /> Prev. Caídas
                            </Link>
                            <Link href="/corporate/medical/emar" className="text-teal-200 hover:text-white transition-colors flex items-center gap-1">
                                <FaPills className="text-base" /> eMAR
                            </Link>
                            <Link href="/corporate/medical/catalog" className="text-teal-200 hover:text-teal-400 transition-colors flex items-center gap-1 text-xs">
                                ↳ Catálogo de Farmacia
                            </Link>
                            <Link href="/corporate/hr/staff" className="text-teal-200 hover:text-white transition-colors flex items-center gap-1">
                                <FaUsers className="text-base" /> Gestor RR.HH
                            </Link>
                            <Link href="/corporate/calendar" className="text-teal-200 hover:text-white transition-colors flex items-center gap-1">
                                <FaChartPie className="text-base" /> Calendario
                            </Link>
                            <Link href="/corporate/supervisor" className="text-teal-200 hover:text-white transition-colors flex items-center gap-1">
                                <FaBrain className="text-base" /> Supervisor Cabina
                            </Link>
                            <Link href="/corporate/billing" className="text-teal-200 hover:text-white transition-colors flex items-center gap-1">
                                <FaFileInvoiceDollar className="text-base" /> Facturación
                            </Link>
                            <Link href="/corporate/settings/integrations" className="text-teal-200 hover:text-white transition-colors flex items-center gap-1">
                                <FaCogs className="text-base" /> Integraciones
                            </Link>

                            <div className="w-px h-6 bg-teal-800 mx-2"></div>

                            <Link href="/" className="flex items-center space-x-2 cursor-pointer bg-amber-500/10 py-1.5 px-3 border border-amber-500/20 rounded-full hover:bg-amber-500/20 transition">
                                <span className="text-amber-400 text-lg">🏥</span>
                                <span className="text-amber-100 text-xs font-bold">Ir a Módulos Clínicos</span>
                            </Link>
                            <div className="flex items-center space-x-2 bg-teal-900 py-1.5 px-3 rounded-full border border-teal-800 ml-2">
                                <div className="w-6 h-6 rounded-full bg-teal-700 flex items-center justify-center text-white text-xs">GF</div>
                                <span className="text-white text-xs">Gerencia</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
