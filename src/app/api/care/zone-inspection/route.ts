import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { todayStartAST } from '@/lib/dates';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

// GET — Obtener rondas de inspección del día actual
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // hqId de la sesión (resolver): rol limitado → su sede (ignora ?hqId).
    const { searchParams } = new URL(req.url);
    const hqId = await resolveEffectiveHqId(session, searchParams.get('hqId'));

    const todayStart = todayStartAST();

    try {
        const inspections = await prisma.zoneInspection.findMany({
            where: {
                headquartersId: hqId,
                createdAt: { gte: todayStart },
            },
            include: {
                supervisor: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, inspections });
    } catch (error: any) {
        console.error('ZoneInspection GET error:', error);
        return NextResponse.json({ success: false, inspections: [] });
    }
}

// POST — Guardar inspección de zona
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const {
            roundType,
            floor,
            zoneName,
            checklistData,
            observations,
        } = body;
        // hqId y supervisor de la sesión (antes: del body → cross-tenant + impersonación).
        const headquartersId = (session.user as any).headquartersId;
        const supervisorId = (session.user as any).id;

        if (!roundType || !floor || !zoneName || !checklistData) {
            return NextResponse.json(
                { success: false, error: 'Faltan campos requeridos.' },
                { status: 400 }
            );
        }

        const inspection = await prisma.zoneInspection.create({
            data: {
                headquartersId,
                supervisorId,
                roundType,
                floor,
                zoneName,
                checklistData,
                observations: observations || null,
                completedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true, inspection });
    } catch (error: any) {
        console.error('ZoneInspection POST error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error guardando inspección.' },
            { status: 500 }
        );
    }
}
