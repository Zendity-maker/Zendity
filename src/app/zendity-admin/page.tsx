import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from "next/link";
import SedesHeader from "./SedesHeader";
import { 
    UsersIcon, 
    BuildingOfficeIcon, 
    CurrencyDollarIcon,
    ArrowTrendingUpIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon
} from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

export default async function ZendityAdminPage() {
    const session = await getServerSession(authOptions);
    if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
        redirect('/');
    }
    const sedes = await prisma.headquarters.findMany({
        include: {
            _count: {
                select: {
                    users: true,
                    patients: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    // SaaS Analytics (Mockup Pricing Logic for B2B Pitch)
    const planPricing: Record<string, number> = {
        'LITE': 299,
        'PRO': 599,
        'ENTERPRISE': 999
    };

    let totalMRR = 0;
    let activeSedes = 0;
    let totalPatients = 0;

    sedes.forEach((s: any) => {
        if (s.isActive) {
            activeSedes++;
            totalMRR += planPricing[s.subscriptionPlan] || 299;
            totalPatients += s._count.patients;
        }
    });

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <SedesHeader />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                            <BuildingOfficeIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-slate-400 font-medium">Sedes Activas</h3>
                    </div>
                    <p className="text-4xl font-bold text-white relative z-10">{activeSedes}</p>
                    <div className="mt-2 text-sm text-emerald-400 flex items-center gap-1">
                        <ArrowTrendingUpIcon className="w-3 h-3" /> +1 este mes
                    </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                            <CurrencyDollarIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-slate-400 font-medium">Est. Monthly Recurring (MRR)</h3>
                    </div>
                    <p className="text-4xl font-bold text-white relative z-10">${totalMRR.toLocaleString()}</p>
                    <div className="mt-2 text-sm text-slate-500">Facturación SaaS Proyectada</div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                            <UsersIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-slate-400 font-medium">Pacientes bajo Gestión</h3>
                    </div>
                    <p className="text-4xl font-bold text-white relative z-10">{totalPatients}</p>
                    <div className="mt-2 text-sm text-slate-500">En todo el ecosistema Zendity</div>
                </div>
            </div>

            {/* Sedes Table */}
            <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Directorio de Sedes (Tenants)</h2>
                    <div className="relative">
                        <input type="text" placeholder="Buscar sede o dueño..." className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-64" />
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-950/50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-800/80">
                            <tr>
                                <th className="px-6 py-4">Facilidad (Sede)</th>
                                <th className="px-6 py-4">Contacto (Dueño)</th>
                                <th className="px-6 py-4 text-center">Plan SaaS</th>
                                <th className="px-6 py-4 text-center">Uso (Camas)</th>
                                <th className="px-6 py-4 text-center">Estatus</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {sedes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No hay sedes registradas en la nave nodriza.
                                    </td>
                                </tr>
                            ) : sedes.map((sede: any) => (
                                <tr key={sede.id} className="hover:bg-slate-800/20 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700 font-bold text-slate-300">
                                                {sede.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-200">{sede.name}</div>
                                                <div className="text-xs text-slate-500 font-mono mt-0.5" title={sede.id}>ID: {sede.id.split('-')[0]}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-300">{sede.ownerName || 'Sin asignar'}</div>
                                        <div className="text-xs text-slate-500">{sede.ownerEmail || 'Email no registrado'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${
                                            sede.subscriptionPlan === 'ENTERPRISE' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                            sede.subscriptionPlan === 'PRO' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                            'bg-slate-800 text-slate-400 border border-slate-700'
                                        }`}>
                                            {sede.subscriptionPlan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-slate-300 font-medium">{sede._count.patients} <span className="text-slate-600 font-normal">/ {sede.capacity}</span></span>
                                            <div className="w-16 h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${sede._count.patients / (sede.capacity || 50) > 0.9 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                    style={{ width: Math.min(100, (sede._count.patients / (sede.capacity || 50)) * 100) + '%' }}
                                                ></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {sede.isActive && sede.subscriptionStatus === 'ACTIVE' ? (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                                Online
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
                                                <ExclamationTriangleIcon className="w-3 h-3" />
                                                {sede.subscriptionStatus === 'SUSPENDED' ? 'Suspendida' : 'Offline'}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <a href={`/superadmin/billing?hqId=${sede.id}`} className="text-blue-400 hover:text-blue-300 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            Administrar &rarr;
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
