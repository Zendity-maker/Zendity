import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'NURSE', 'SUPERVISOR'];

/**
 * GET /api/corporate/intake/documents?patientId=X
 *
 * Lista de documentos analizados por Zendi para un residente. Devuelve
 * solo metadata + análisis estructurado (NO el archivo original — los
 * archivos no se persisten).
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');

        if (!patientId) {
            return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });
        }

        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: hqId },
            select: { id: true },
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente fuera de tu sede' }, { status: 403 });
        }

        const documents = await prisma.patientDocument.findMany({
            where: { patientId, headquartersId: hqId },
            orderBy: { uploadedAt: 'desc' },
            select: {
                id: true,
                category: true,
                title: true,
                fileType: true,
                zendiAnalysis: true,
                analyzedAt: true,
                uploadedAt: true,
                uploadedBy: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ success: true, documents });
    } catch (error: any) {
        console.error('[intake/documents GET]', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error cargando documentos',
        }, { status: 500 });
    }
}
