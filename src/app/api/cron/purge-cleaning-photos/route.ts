import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/cron-auth';

// Cron: nullifica las fotos base64 inline de CleaningLog y CleaningRequest
// con más de 90 días de antigüedad. Mantiene el log/request (auditoría) pero
// libera el volumen pesado de la imagen.
//
// Pragmatic mitigation mientras el proyecto entero migra a Vercel Blob.
// El módulo Cleaning genera ~50 fotos/día → sin purga, ~75MB/mes en una sola tabla.
// Schedule: 03:00 diario (ver vercel.json).
export async function GET(request: Request) {
    const denied = requireCronSecret(request);
    if (denied) return denied;

    try {
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // hace 90 días

        const [logsResult, requestsResult] = await Promise.all([
            prisma.cleaningLog.updateMany({
                where: {
                    cleanedAt: { lt: cutoff },
                    photoUrl: { not: null },
                },
                data: { photoUrl: null },
            }),
            prisma.cleaningRequest.updateMany({
                where: {
                    createdAt: { lt: cutoff },
                    photoUrl: { not: null },
                },
                data: { photoUrl: null },
            }),
        ]);

        return NextResponse.json({
            success: true,
            cutoffDate: cutoff.toISOString(),
            logsPurged: logsResult.count,
            requestsPurged: requestsResult.count,
        });
    } catch (error) {
        console.error('[CRON purge-cleaning-photos] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error purgando fotos' },
            { status: 500 }
        );
    }
}
