import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PrintButton from './PrintButton';
import DateFilter from './DateFilter';

export default async function VisitsPage({
    searchParams
}: {
    searchParams: { from?: string; to?: string }
}) {
    const session = await getServerSession(authOptions);
    if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)) {
        redirect('/login');
    }

    const hqId = session.user.headquartersId;

    const hq = await prisma.headquarters.findUnique({
        where: { id: hqId },
        select: { name: true, logoUrl: true, phone: true }
    });

    const from = searchParams.from ? new Date(searchParams.from + 'T00:00:00') : null;
    const to = searchParams.to ? new Date(searchParams.to + 'T23:59:59') : null;

    const where: Record<string, unknown> = { headquartersId: hqId };
    if (from || to) {
        where.visitedAt = {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {})
        };
    }

    const visits = await prisma.familyVisit.findMany({
        where,
        orderBy: { visitedAt: 'desc' },
        take: 200
    });

    const today = new Date().toLocaleDateString('es-PR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return (
        <div className="min-h-screen bg-white">
            {/* Print styles */}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { margin: 0; }
                    .print-page { padding: 0.5in; }
                }
            `}</style>

            {/* Toolbar — no imprime */}
            <div className="no-print bg-slate-800 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <a href="/reception" className="text-slate-500 hover:text-white text-sm transition-colors">
                        ← Kiosco
                    </a>
                    <span className="text-slate-600">|</span>
                    <span className="text-white font-medium text-sm">Historial de Visitas</span>
                    {(searchParams.from || searchParams.to) && (
                        <span className="bg-teal-900 text-teal-400 text-xs px-2 py-0.5 rounded-full">
                            {searchParams.from || '...'} → {searchParams.to || 'hoy'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <DateFilter />
                    <PrintButton />
                </div>
            </div>

            {/* Contenido imprimible */}
            <div className="print-page max-w-5xl mx-auto p-8">

                {/* Header de la sede */}
                <div className="border-b-2 border-slate-800 pb-6 mb-6">
                    <div className="flex items-start justify-between">
                        <div>
                            {hq?.logoUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={hq.logoUrl} alt="Logo" className="h-14 mb-3 object-contain" />
                            )}
                            <h1 className="text-2xl font-black text-slate-800">{hq?.name || 'Vivid Senior Living Cupey'}</h1>
                            {hq?.phone && <p className="text-slate-500 text-sm mt-1">{hq.phone}</p>}
                        </div>
                        <div className="text-right">
                            <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Powered by</p>
                            <p className="text-teal-600 font-black text-xl tracking-widest">ZÉNDITY</p>
                            <p className="text-slate-500 text-xs mt-2">Generado el {today}</p>
                            <p className="text-slate-500 text-xs">Total: {visits.length} visitas</p>
                            {(searchParams.from || searchParams.to) && (
                                <p className="text-teal-500 text-xs mt-1 font-medium">
                                    Período: {searchParams.from || '...'} → {searchParams.to || 'hoy'}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="mt-4 bg-slate-50 rounded-lg px-4 py-2 flex items-center justify-between">
                        <h2 className="text-base font-bold text-slate-700">Registro Oficial de Visitas Familiares</h2>
                        <p className="text-slate-500 text-xs">Official Family Visit Log</p>
                    </div>
                </div>

                {/* Tabla */}
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr style={{background: '#1E293B', color: 'white'}}>
                            <th className="px-3 py-3 text-left font-bold text-xs">#</th>
                            <th className="px-3 py-3 text-left font-bold text-xs">Visitante / Visitor</th>
                            <th className="px-3 py-3 text-left font-bold text-xs">Residente visitado</th>
                            <th className="px-3 py-3 text-left font-bold text-xs">Fecha / Date</th>
                            <th className="px-3 py-3 text-left font-bold text-xs">Hora / Time</th>
                            <th className="px-3 py-3 text-left font-bold text-xs">Firma / Signature</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visits.map((v, i) => (
                            <tr key={v.id} style={{background: i % 2 === 0 ? '#F8FAFC' : 'white', borderBottom: '1px solid #E2E8F0'}}>
                                <td className="px-3 py-2.5 text-slate-500 font-bold text-xs">{i + 1}</td>
                                <td className="px-3 py-2.5 font-medium text-slate-800">{v.visitorName}</td>
                                <td className="px-3 py-2.5 text-slate-600">{v.residentName}</td>
                                <td className="px-3 py-2.5 text-slate-600 text-xs">
                                    {new Date(v.visitedAt).toLocaleDateString('es-PR', {
                                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                                    })}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 text-xs font-medium">
                                    {new Date(v.visitedAt).toLocaleTimeString('es-PR', {
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </td>
                                <td className="px-3 py-2.5">
                                    {v.signatureData ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={v.signatureData} alt="Firma" className="h-8 w-auto" />
                                    ) : (
                                        <span className="text-slate-500 text-xs italic">Sin firma</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {visits.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                    No hay visitas registradas para este período.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Footer imprimible */}
                <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <p className="text-slate-500 text-xs">
                        {hq?.name} · Registro de Visitas Familiares · {today}
                    </p>
                    <p className="text-teal-500 text-xs font-bold">ZÉNDITY · app.zendity.com</p>
                </div>
            </div>
        </div>
    );
}
