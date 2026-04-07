import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PrintButton from './PrintButton';

export default async function VisitsPage() {
    const session = await getServerSession(authOptions);
    if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)) {
        redirect('/login');
    }

    const hqId = session.user.headquartersId;

    const visits = await prisma.familyVisit.findMany({
        where: { headquartersId: hqId },
        orderBy: { visitedAt: 'desc' },
        take: 100
    });

    return (
        <div className="min-h-screen bg-white p-8 print:p-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 print:mb-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">Registro de Visitas</h1>
                        <p className="text-slate-500 text-sm">Vivid Senior Living Cupey · Powered by Zéndity</p>
                    </div>
                    <PrintButton />
                </div>

                {/* Table */}
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-800 text-white">
                            <th className="px-4 py-3 text-left font-bold">#</th>
                            <th className="px-4 py-3 text-left font-bold">Visitante</th>
                            <th className="px-4 py-3 text-left font-bold">Residente visitado</th>
                            <th className="px-4 py-3 text-left font-bold">Fecha</th>
                            <th className="px-4 py-3 text-left font-bold">Hora</th>
                            <th className="px-4 py-3 text-left font-bold print:hidden">Firma</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visits.map((v, i) => (
                            <tr key={v.id} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                <td className="px-4 py-3 text-slate-400 font-bold">{i + 1}</td>
                                <td className="px-4 py-3 font-medium text-slate-800">{v.visitorName}</td>
                                <td className="px-4 py-3 text-slate-600">{v.residentName}</td>
                                <td className="px-4 py-3 text-slate-600">
                                    {new Date(v.visitedAt).toLocaleDateString('es-PR', {
                                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                                    })}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {new Date(v.visitedAt).toLocaleTimeString('es-PR', {
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </td>
                                <td className="px-4 py-3 print:hidden">
                                    {v.signatureData ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={v.signatureData}
                                            alt="Firma"
                                            className="h-8 w-auto"
                                        />
                                    ) : (
                                        <span className="text-slate-300 text-xs">Sin firma</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {visits.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                    No hay visitas registradas todavía.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <div className="mt-6 text-xs text-slate-400 print:mt-4">
                    Total de visitas: {visits.length} · Generado el {new Date().toLocaleDateString('es-PR', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    })}
                </div>
            </div>
        </div>
    );
}
