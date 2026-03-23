import SaaSInvoiceClient from "./SaaSInvoiceClient";

export const dynamic = 'force-dynamic';

export default function SuperAdminBillingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-teal-500/30">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                            <span className="text-teal-400"></span> Zendity OS
                            <span className="text-xl font-medium text-slate-500 tracking-normal ml-2">SaaS Billing Console</span>
                        </h1>
                        <p className="text-slate-400 mt-2">Gestión Financiera B2B - Recibos por Uso de Plataforma</p>
                    </div>
                    <a href="/superadmin" className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 transition-colors text-sm">
                        ← Volver a Master Console
                    </a>
                </div>

                <SaaSInvoiceClient />
            </div>
        </div>
    );
}
