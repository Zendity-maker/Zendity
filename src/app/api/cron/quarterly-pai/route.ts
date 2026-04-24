import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron trimestral — 1 de Enero, Abril, Julio, Octubre a las 12:00 UTC
 * Crea borradores de PAI trimestral para todos los residentes ACTIVOS
 * y notifica al DIRECTOR/NURSE de cada sede.
 */
export async function GET(req: Request) {
    // Verificar cron secret de Vercel
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const results: { hqId: string; created: number; errors: number }[] = [];

        // Obtener todas las sedes activas
        const headquarters = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true, name: true }
        });

        for (const hq of headquarters) {
            let created = 0;
            let errors = 0;

            // Residentes activos de esta sede
            const patients = await prisma.patient.findMany({
                where: { headquartersId: hq.id, status: 'ACTIVE' },
                select: { id: true, name: true }
            });

            for (const patient of patients) {
                try {
                    // Verificar que no haya ya un PAI DRAFT trimestral reciente (evitar duplicados)
                    const existingDraft = await prisma.lifePlan.findFirst({
                        where: {
                            patientId: patient.id,
                            status: 'DRAFT',
                            type: 'QUARTERLY',
                            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // últimos 7 días
                        },
                        select: { id: true }
                    });

                    if (!existingDraft) {
                        await prisma.lifePlan.create({
                            data: {
                                patientId: patient.id,
                                type: 'QUARTERLY',
                                status: 'DRAFT',
                            }
                        });
                        created++;
                    }
                } catch (patientErr) {
                    console.error(`Error creando PAI trimestral para ${patient.name}:`, patientErr);
                    errors++;
                }
            }

            // Notificar a DIRECTOR y NURSE de esta sede
            try {
                const staffToNotify = await prisma.user.findMany({
                    where: {
                        headquartersId: hq.id,
                        role: { in: ['DIRECTOR', 'NURSE'] },
                        isDeleted: false,
                    },
                    select: { id: true }
                });

                for (const staff of staffToNotify) {
                    await notifyUser(staff.id, {
                        type: 'EMAR_ALERT',
                        title: '📋 PAIs Trimestrales Pendientes',
                        message: `Se generaron ${created} borradores de Plan Asistencial trimestral. Accede a cada residente para completar y aprobar.`,
                        link: '/corporate/medical',
                    }).catch(() => { /* silenciar errores individuales */ });
                }
            } catch (notifyErr) {
                console.error(`Error notificando staff de HQ ${hq.name}:`, notifyErr);
            }

            results.push({ hqId: hq.id, created, errors });
        }

        return NextResponse.json({
            success: true,
            message: 'Cron PAI trimestral ejecutado',
            results,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Cron quarterly-pai error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
