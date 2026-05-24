import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';

/**
 * GET /api/family/digest
 *
 * Devuelve el resumen narrativo del día clínico actual ("El día de…")
 * para el residente vinculado al familiar autenticado. Solo lectura.
 * El contenido lo genera el cron /api/cron/family-digest una vez al día.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'FAMILY') {
            return NextResponse.json(
                { success: false, error: 'No autorizado. Acceso exclusivo para familiares.' },
                { status: 401 }
            );
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
        });

        if (!familyMember || !familyMember.patientId) {
            return NextResponse.json(
                { success: false, error: 'Cuenta de familiar no vinculada a ningún residente activo.' },
                { status: 404 }
            );
        }

        const digest = await prisma.dailyDigest.findUnique({
            where: {
                patientId_digestDate: {
                    patientId: familyMember.patientId,
                    digestDate: todayStartAST(),
                },
            },
            select: {
                narrative: true,
                foodBand: true,
                activityNote: true,
                medsOnTrack: true,
                generatedAt: true,
            },
        });

        return NextResponse.json({ success: true, digest: digest ?? null });
    } catch (error: any) {
        console.error('Family Digest API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error Server: ' + (error?.message || 'Desconocido') },
            { status: 500 }
        );
    }
}
