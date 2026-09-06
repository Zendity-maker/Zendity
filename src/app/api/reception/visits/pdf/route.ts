/**
 * EL REGISTRO DE VISITAS EN PDF
 * ─────────────────────────────
 * Un documento de verdad, no la pantalla impresa. El porqué está en
 * src/lib/visitas-pdf.ts.
 *
 * Mismo rango de fechas y mismo tope que la pantalla — si los dos caminos
 * dieran resultados distintos, tendríamos dos versiones del mismo registro
 * oficial y ninguna forma de saber cuál enseñar.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logPhiAccess } from '@/lib/phi-audit';
import { generarRegistroVisitasPDF, type VisitaPDF } from '@/lib/visitas-pdf';

export const dynamic = 'force-dynamic';

/** Mismos roles que la pantalla del registro. */
const VEN_REGISTRO = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

/** El mismo tope que la pantalla. Ver el comentario en /reception/visits. */
const TOPE = 1000;

export async function GET(req: Request) {
    const auth = await requireRole(VEN_REGISTRO);
    if (auth instanceof NextResponse) return auth;

    try {
        const url = new URL(req.url);
        const desde = url.searchParams.get('from');
        const hasta = url.searchParams.get('to');

        const where: Record<string, unknown> = { headquartersId: auth.headquartersId };
        if (desde || hasta) {
            where.visitedAt = {
                ...(desde ? { gte: new Date(desde + 'T00:00:00') } : {}),
                ...(hasta ? { lte: new Date(hasta + 'T23:59:59') } : {}),
            };
        }

        const [hq, totalEnRango, visitas] = await Promise.all([
            prisma.headquarters.findUnique({
                where: { id: auth.headquartersId },
                select: { name: true, phone: true, logoUrl: true },
            }),
            prisma.familyVisit.count({ where }),
            prisma.familyVisit.findMany({
                where,
                orderBy: { visitedAt: 'desc' },
                take: TOPE,
                select: {
                    tipo: true, visitorName: true, profesion: true,
                    residentName: true, entidad: true, futuroResidente: true,
                    visitedAt: true, departedAt: true, salidaCerradaAt: true,
                    retenida: true, fueraDeHorario: true, signatureData: true,
                },
            }),
        ]);

        const pdf = generarRegistroVisitasPDF({
            hqName: hq?.name ?? 'Hogar',
            hqPhone: hq?.phone ?? null,
            hqLogo: hq?.logoUrl ?? null,
            generadoAt: new Date(),
            desde, hasta,
            totalEnRango,
            visitas: visitas as VisitaPDF[],
        });

        /**
         * El registro lleva nombres de visitantes y de residentes. Sacarlo del
         * sistema es una divulgación y queda registrada como tal — igual que el
         * paquete de continuidad y los reportes semanales.
         */
        logPhiAccess({
            action: 'EXPORT',
            resourceType: 'RegistroVisitas',
            hqId: auth.headquartersId,
            userId: auth.id,
            routePath: '/api/reception/visits/pdf',
            context: { visitas: visitas.length, totalEnRango, desde, hasta },
        });

        const sufijo = desde || hasta ? `${desde ?? 'inicio'}_${hasta ?? 'hoy'}` : new Date().toISOString().slice(0, 10);
        return new NextResponse(Buffer.from(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="registro-visitas-${sufijo}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('PDF de visitas:', error);
        return NextResponse.json({ success: false, error: 'No se pudo generar el registro' }, { status: 500 });
    }
}
