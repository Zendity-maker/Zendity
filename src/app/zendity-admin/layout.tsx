import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HomeIcon, ArrowRightOnRectangleIcon, ChartPieIcon, BuildingOfficeIcon } from "@heroicons/react/24/outline";
import Link from 'next/link';

// Correos electrónicos del Fundador autorizados a entrar a "La Nave Nodriza"
const SUPER_ADMIN_EMAILS = ['andresfloressrpa@gmail.com', 'admin@vividcupey.com'];

export default async function ZendityAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

    // BARRERA DE TITANIO: Redirigir si no hay sesión o si el email NO pertenece a los fundadores
    if (!session || !session.user || !session.user.email) {
        redirect("/login");
    }

    if (!SUPER_ADMIN_EMAILS.includes(session.user.email)) {
        redirect("/corporate/hq"); // Ckikar out a usuarios regulares a su propia Sede
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-blue-500/30">
            {/* Sidebar Dark Mode (Zendity Admin Control Panel) */}
            <aside className="fixed left-0 top-0 w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-2xl shadow-black">
                <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                        Z
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg tracking-tight">Zendity <span className="text-blue-400 font-normal">Cloud</span></h1>
                        <p className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mt-0.5">God Mode</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 px-3">SaaS Management</div>
                    <Link href="/zendity-admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner group transition-all">
                        <BuildingOfficeIcon className="w-5 h-5" />
                        <span className="font-medium text-sm">Sedes (Tenants)</span>
                    </Link>
                    <Link href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all cursor-not-allowed opacity-50">
                        <ChartPieIcon className="w-5 h-5" />
                        <span className="font-medium text-sm">Zendity Billing</span>
                        <span className="ml-auto text-[9px] uppercase tracking-wider bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">Pronto</span>
                    </Link>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl bg-slate-950/50 border border-slate-800">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-700">
                            {session.user.name?.charAt(0) || 'D'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{session.user.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{session.user.email}</p>
                        </div>
                    </div>
                    
                    <Link href="/corporate/hq" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white text-sm font-medium transition-colors">
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                        Regresar a mi Sede
                    </Link>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="pl-64 min-h-screen relative">
                {/* Estético Glow Background */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none z-0" />
                <div className="relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
