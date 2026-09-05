import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PrintButton from './PrintButton';
import CerrarSalidas from './CerrarSalidas';
import DateFilter from './DateFilter';

/** Como se lee cada tipo en un documento que ve un inspector. */
const TIPO_LABEL: Record<string, { texto: string; icono: string }> = {
    FAMILIAR:         { texto: 'Familiar',  icono: '👋' },
    TOUR:             { texto: 'Recorrido', icono: '🏡' },
    OFICIAL:          { texto: 'Oficial',   icono: '📋' },
    SERVICIO_EXTERNO: { texto: 'Servicio',  icono: '🩺' },
};

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

    /**
     * Tope y aviso de recorte.
     *
     * Antes esto era `take: 200` a secas. Un rango con más de 200 visitas se
     * imprimía recortado SIN decirlo: el papel parecía el registro completo del
     * periodo y no lo era. En un documento que se le enseña a un inspector eso
     * es peor que no imprimirlo — nadie duda de una lista que no avisa.
     *
     * Se sube el tope y, si aun así sobran, el aviso sale IMPRESO, no en una
     * barra de pantalla que el papel no recoge.
     */
    const TOPE = 1000;
    const [totalEnRango, visits] = await Promise.all([
        prisma.familyVisit.count({ where }),
        prisma.familyVisit.findMany({ where, orderBy: { visitedAt: 'desc' }, take: TOPE }),
    ]);
    const recortado = totalEnRango > visits.length;

    /**
     * Visitas de hoy sin salida y sin cerrar. Se buscan aparte del rango que
     * mire el usuario: quien esta revisando marzo tambien deberia poder cerrar
     * las de hoy, y quien mira hoy no deberia poder cerrar las de marzo — una
     * visita de hace tres meses no se cierra "porque se fue", se cierra porque
     * alguien lo decidio, y eso es otra conversacion.
     */
    const inicioDeHoy = new Date(); inicioDeHoy.setHours(0, 0, 0, 0);
    const abiertas = await prisma.familyVisit.findMany({
        where: { headquartersId: hqId, departedAt: null, salidaCerradaAt: null, visitedAt: { gte: inicioDeHoy }, retenida: false },
        select: { id: true, visitorName: true },
        orderBy: { visitedAt: 'asc' },
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
                    <CerrarSalidas abiertas={abiertas} />
                    <DateFilter />
                    <PrintButton />
                </div>
            </div>

            {/* Contenido imprimible */}
            <div className="print-page max-w-5xl mx-auto p-8">

                {recortado && (
                    <div className="mb-6 border-2 border-amber-500 bg-amber-50 rounded-lg px-5 py-4">
                        <p className="font-black text-amber-900 text-sm uppercase tracking-wider mb-1">
                            Registro parcial
                        </p>
                        <p className="text-amber-900 text-sm leading-relaxed">
                            En este periodo hay <strong>{totalEnRango}</strong> visitas y aquí salen las{' '}
                            <strong>{visits.length}</strong> más recientes. Reduce el rango de fechas para
                            obtener el registro completo.
                        </p>
                    </div>
                )}

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
                            <th className="px-3 py-3 text-left font-bold text-xs">Tipo</th>
                            <th className="px-3 py-3 text-left font-bold text-xs">Visitante / Visitor</th>
                            <th className="px-3 py-3 text-left font-bold text-xs">Residente / Entidad</th>
                            <th className="px-3 py-3 text-left font-bold text-xs">Fecha / Date</th>
                            <th className="px-3 py-3 text-left font-bold text-xs">Entrada / In</th>
                            <th className="px-3 py-3 text-left font-bold text-xs">Salida / Out</th>
                            <th className="px-3 py-3 text-left font-bold text-xs">Firma / Signature</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visits.map((v, i) => (
                            <tr key={v.id} style={{background: i % 2 === 0 ? '#F8FAFC' : 'white', borderBottom: '1px solid #E2E8F0'}}>
                                <td className="px-3 py-2.5 text-slate-500 font-bold text-xs">{i + 1}</td>
                                <td className="px-3 py-2.5 text-slate-700 text-xs whitespace-nowrap">
                                    {TIPO_LABEL[v.tipo]?.icono ?? ''} {TIPO_LABEL[v.tipo]?.texto ?? v.tipo}
                                </td>
                                <td className="px-3 py-2.5 font-medium text-slate-800">
                                    {v.visitorName}
                                    {v.profesion && <span className="block text-xs text-slate-500">{v.profesion}</span>}
                                    {/* Las marcas van AQUI, no en una columna
                                        aparte: son excepciones y merecen verse
                                        junto a quien las provoco, no perdidas
                                        al final de la fila. */}
                                    {v.retenida && (
                                        <span className="block text-xs font-bold text-amber-700 mt-0.5">
                                            Esperó asistencia — no pasó
                                        </span>
                                    )}
                                    {v.fueraDeHorario && (
                                        <span className="block text-xs font-bold text-amber-700 mt-0.5">
                                            Fuera de horario — autorizada
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600">
                                    {v.residentName || v.entidad || '—'}
                                    {v.residentName && v.entidad && (
                                        <span className="block text-xs text-slate-500">{v.entidad}</span>
                                    )}
                                    {v.tipo === 'TOUR' && v.futuroResidente && (
                                        <span className="block text-xs text-slate-500">Pregunta por {v.futuroResidente}</span>
                                    )}
                                </td>
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
                                {/* El hueco se ENSEÑA. Una visita sin salida no
                                    se rellena por nuestra cuenta —seria falsear
                                    un documento firmado— pero tampoco se
                                    disimula: asi alguien puede cerrarla o
                                    corregir el habito. */}
                                <td className="px-3 py-2.5 text-xs font-medium">
                                    {v.departedAt ? (
                                        <span className="text-slate-600">
                                            {new Date(v.departedAt).toLocaleTimeString('es-PR', {
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    ) : v.salidaCerradaAt ? (
                                        // Cerrada por personal NO es lo mismo que
                                        // firmada por quien se fue, y el documento
                                        // no puede fingir que si.
                                        <span className="text-slate-600">
                                            Cerrada por personal
                                            <span className="block text-[10px] text-slate-500 italic">el visitante no registró salida</span>
                                        </span>
                                    ) : (
                                        <span className="text-amber-700 italic">Sin registrar</span>
                                    )}
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
                                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
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
