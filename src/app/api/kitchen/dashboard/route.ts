import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { todayStartAST } from '@/lib/dates';
import { MOTIVOS_DE_COCINA, etiquetaMotivo } from '@/lib/comida';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const hqId = await resolveEffectiveHqId(session, searchParams.get('hqId'));

        const [activePatients, hospitalPatients, observations, todayMenu, rechazos] = await Promise.all([
            prisma.patient.findMany({
                where: { headquartersId: hqId!, status: 'ACTIVE' },
                // Sprint Diet System — exponemos dietTexture + 4 flags como fuente
                // de verdad. `diet` legacy queda incluido para back-compat de
                // consumers viejos durante la transición.
                select: {
                    id: true, name: true, roomNumber: true, colorGroup: true,
                    diet: true,
                    dietTexture: true, dietDiabetic: true, dietLowSodium: true,
                    dietRenal: true, dietVegetarian: true,
                },
                orderBy: { name: 'asc' }
            }),
            prisma.patient.findMany({
                where: { headquartersId: hqId!, status: 'TEMPORARY_LEAVE', leaveType: 'HOSPITAL' },
                select: { id: true, name: true, roomNumber: true }
            }),
            prisma.kitchenObservation.findMany({
                where: { headquartersId: hqId! },
                include: { supervisor: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 20
            }),
            prisma.dailyMenu.findFirst({
                where: {
                    headquartersId: hqId!,
                    date: {
                        gte: todayStartAST(),
                        lt: new Date(new Date().setHours(23, 59, 59, 999))
                    }
                }
            }),
            /**
             * LO QUE NO SE COMIERON, Y POR QUE.
             *
             * Hasta hoy la cocina veia dietas y menus, y nada de como le fue a
             * lo que mando. `MealLog` guardaba 258 registros de "no comio nada"
             * sin una sola causa, asi que no habia nada que ensenar.
             *
             * Ahora hay causa, y la que la cocina puede resolver le llega. Lo
             * clinico —nausea, dolor, agitacion— no: eso va a enfermeria, no se
             * arregla cocinando, y la cocina no necesita saberlo.
             */
            prisma.mealLog.findMany({
                where: {
                    patient: { headquartersId: hqId!, status: 'ACTIVE' },
                    timeLogged: { gte: new Date(Date.now() - 14 * 86400000) },
                    motivoRechazo: { in: MOTIVOS_DE_COCINA },
                },
                select: {
                    patientId: true, mealType: true, motivoRechazo: true,
                    aceptoEnCambio: true, timeLogged: true,
                    patient: { select: { name: true, roomNumber: true } },
                },
                orderBy: { timeLogged: 'desc' },
                take: 200,
            }),
        ]);

        /**
         * Un rechazo suelto es ruido; el mismo rechazo tres veces es una
         * preferencia. Se agrupa por residente para que se vea el patron y no
         * la lista.
         */
        const porResidente = new Map<string, {
            patientId: string; nombre: string; habitacion: string | null;
            veces: number; ultimo: Date;
            motivos: Record<string, number>;
            acepta: string[];
        }>();
        for (const r of rechazos) {
            const e = porResidente.get(r.patientId) ?? {
                patientId: r.patientId,
                nombre: r.patient.name.trim(),
                habitacion: r.patient.roomNumber,
                veces: 0, ultimo: r.timeLogged,
                motivos: {} as Record<string, number>,
                acepta: [] as string[],
            };
            e.veces++;
            const etiqueta = etiquetaMotivo(r.motivoRechazo) ?? 'Sin motivo';
            e.motivos[etiqueta] = (e.motivos[etiqueta] ?? 0) + 1;
            const acepto = (r.aceptoEnCambio ?? '').trim();
            if (acepto && !e.acepta.includes(acepto)) e.acepta.push(acepto);
            if (r.timeLogged > e.ultimo) e.ultimo = r.timeLogged;
            porResidente.set(r.patientId, e);
        }
        const rechazosPorResidente = [...porResidente.values()]
            .sort((a, b) => b.veces - a.veces)
            .map(e => ({
                ...e,
                motivos: Object.entries(e.motivos)
                    .sort((a, b) => b[1] - a[1])
                    .map(([etiqueta, n]) => ({ etiqueta, n })),
            }));

        // KPI del cocinero — últimos 14 días
        const last14Days = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const recentObs = observations.filter(o => new Date(o.createdAt) >= last14Days);
        const avgScore = recentObs.length > 0
            ? Math.round((recentObs.reduce((sum, o) => sum + o.satisfactionScore, 0) / recentObs.length) * 10) / 10
            : null;
        const positiveCount = recentObs.filter(o => o.feedbackType === 'POSITIVE').length;
        const negativeCount = recentObs.filter(o => o.feedbackType === 'NEGATIVE').length;
        const unreadCount = observations.filter(o => !o.isRead).length;

        const lastFeedbackDaysAgo = observations.length > 0
            ? Math.floor((Date.now() - new Date(observations[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : 999;

        return NextResponse.json({
            success: true,
            activePatients,
            hospitalPatients,
            observations,
            todayMenu,
            rechazosPorResidente,
            diasDeRechazos: 14,
            kpi: {
                avgScore,
                positiveCount,
                negativeCount,
                unreadCount,
                lastFeedbackDaysAgo,
                needsReminder: lastFeedbackDaysAgo >= 2
            }
        });
    } catch (error: any) {
        console.error('Kitchen dashboard error:', error);
        return NextResponse.json({ error: 'Error cargando dashboard' }, { status: 500 });
    }
}
