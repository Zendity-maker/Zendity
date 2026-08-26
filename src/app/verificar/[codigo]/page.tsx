import Link from 'next/link';
import { buscarCertificado } from '@/lib/certificado';

/**
 * Resultado de la verificación. Se renderiza en el servidor y sin sesión:
 * quien comprueba un certificado viene de fuera y no tiene cuenta.
 *
 * Muestra lo mínimo para acreditar formación — nombre, curso, fecha y sede.
 * Nada clínico ni ningún identificador interno.
 */
export const dynamic = 'force-dynamic';

const fecha = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export default async function ResultadoVerificacion({
    params,
}: {
    params: Promise<{ codigo: string }>;
}) {
    const { codigo: crudo } = await params;
    const r = await buscarCertificado(decodeURIComponent(crudo || ''));

    const valido = r.valido;
    const revocado = r.motivo === 'REVOCADO';
    const vencido = r.motivo === 'VENCIDO';
    const codigo = r.codigo;

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
                <p className="text-center text-xs font-black tracking-[0.2em] text-teal-700 uppercase mb-6">
                    Zéndity Academy
                </p>

                <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${valido ? 'border-emerald-200' : (revocado || vencido) ? 'border-amber-200' : 'border-slate-200'}`}>
                    <div className={`px-6 py-5 ${valido ? 'bg-emerald-50' : (revocado || vencido) ? 'bg-amber-50' : 'bg-slate-100'}`}>
                        <p className={`font-black text-lg ${valido ? 'text-emerald-800' : (revocado || vencido) ? 'text-amber-800' : 'text-slate-600'}`}>
                            {valido ? 'Certificado auténtico'
                                : vencido ? 'Certificación vencida'
                                : revocado ? 'Certificado revocado'
                                : 'No encontrado'}
                        </p>
                        <p className={`text-sm mt-1 ${valido ? 'text-emerald-700' : (revocado || vencido) ? 'text-amber-700' : 'text-slate-500'}`}>
                            {valido
                                ? 'Este código corresponde a una certificación emitida por Zéndity.'
                                : vencido
                                    // Vencido no es lo mismo que falso. Esta persona SI aprobo el
                                    // curso ese dia; lo que caduco es la acreditacion.
                                    ? 'Esta persona aprobó el curso, pero la certificación caducó y debe renovarse.'
                                    : revocado
                                        ? 'Este certificado existió y fue anulado. Ya no acredita la formación.'
                                        : 'Ningún certificado corresponde a este código.'}
                        </p>
                    </div>

                    {r.nombre && (
                        <div className="px-6 py-6 space-y-5">
                            {[
                                ['Otorgado a', r.nombre],
                                [r.tipo === 'MAESTRO' ? 'Programa' : 'Curso', r.curso ?? '—'],
                                ...(valido ? [
                                    ['Aprobado el', fecha(r.aprobadoEl ?? null)],
                                    ...(r.venceEl ? [['Válido hasta', fecha(r.venceEl)] as [string, string]] : []),
                                    ...(r.duracionMin ? [['Duración', `${r.duracionMin} minutos`] as [string, string]] : []),
                                    ['Sede certificadora', r.sede ?? '—'],
                                ] : vencido ? [
                                    ['Aprobado el', fecha(r.aprobadoEl ?? null)],
                                    ['Venció el', fecha(r.venceEl ?? null)],
                                    ['Sede certificadora', r.sede ?? '—'],
                                ] : [
                                    ['Revocado el', fecha(r.revocadoEl ?? null)],
                                ]),
                            ].map(([k, v]) => (
                                <div key={k as string}>
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">{k}</p>
                                    <p className="font-bold text-slate-800 mt-0.5">{v}</p>
                                </div>
                            ))}
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Código</p>
                                <p className="font-mono font-black text-slate-700 tracking-wider mt-0.5">{codigo}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-center mt-6">
                    <Link href="/verificar" className="text-sm font-bold text-teal-700 hover:text-teal-800">
                        Verificar otro certificado
                    </Link>
                </div>
            </div>
        </div>
    );
}
