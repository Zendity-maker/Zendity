import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import CreateHqAction from './CreateHqAction';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';



export const dynamic = 'force-dynamic';

export default async function SuperAdminDashboard() {
    const session = await getServerSession(authOptions);
    if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
        redirect('/');
    }

    // 1. Fetch all Headquarters
    const hqs = await prisma.headquarters.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { users: true, patients: true, saasInvoices: true }
            }
        }
    });

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-teal-500/30">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                            <span className="text-teal-400"></span> Zendity OS
                            <span className="text-xl font-medium text-slate-500 tracking-normal ml-2">Master Console</span>
                        </h1>
                        <p className="text-slate-400 mt-2">B2B SaaS Multi-Tenant Management</p>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"></div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Tenants (HQs)</p>
                        <p className="text-4xl font-black text-white mt-2">{hqs.length}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"></div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active Licenses</p>
                        <p className="text-4xl font-black text-teal-400 mt-2">{hqs.filter(h => h.licenseActive).length}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"></div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total End-Users</p>
                        <p className="text-4xl font-black text-indigo-400 mt-2">
                            {hqs.reduce((acc, curr) => acc + curr._count.users, 0)}
                        </p>
                    </div>
                </div>

                {/* HQ Data Table & Client Component for Modal */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                             Clientes Institucionales (Asilos)
                        </h2>
                        {/* Interactive Client Component for the "New HQ" modal */}
                        <CreateHqAction />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-950/50 text-xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800">
                                    <th className="p-4 pl-6">ID / Nombre Institución</th>
                                    <th className="p-4">Staff & Pacientes</th>
                                    <th className="p-4">Licencia Zendity</th>
                                    <th className="p-4">Expira En</th>
                                    <th className="p-4 pr-6 text-right">Facturación SaaS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {hqs.map((hq) => (
                                    <tr key={hq.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="p-4 pl-6">
                                            <div className="font-bold text-white text-base">{hq.name}</div>
                                            <div className="text-xs text-slate-500 font-mono mt-1">{hq.id.split('-')[0]}***</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-3 text-sm">
                                                <span className="flex items-center gap-1 text-teal-400/80 bg-teal-400/10 px-2 py-0.5 rounded-md">
                                                     {hq._count.users}
                                                </span>
                                                <span className="flex items-center gap-1 text-indigo-400/80 bg-indigo-400/10 px-2 py-0.5 rounded-md">
                                                     {hq._count.patients}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${hq.licenseActive
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${hq.licenseActive ? 'bg-emerald-400' : 'bg-red-500'}`}></span>
                                                {hq.licenseActive ? 'ACTIVA' : 'SUSPENDIDA'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm text-slate-300">
                                                {format(new Date(hq.licenseExpiry), "dd MMM yyyy", { locale: es })}
                                            </div>
                                            {hq.licenseExpiry < new Date() && (
                                                <div className="text-xs text-red-400 mt-1 font-bold">¡Vencida!</div>
                                            )}
                                        </td>
                                        <td className="p-4 pr-6 text-right">
                                            <Link href={`/superadmin/billing?hqId=${hq.id}`} className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors border border-slate-700 shadow-sm">
                                                 Ver {hq._count.saasInvoices} Docs
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {hqs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-slate-500">
                                            No hay Asilos registrados. Haz clic en "Añadir Asilo Nuevo" para tu primer cliente.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
