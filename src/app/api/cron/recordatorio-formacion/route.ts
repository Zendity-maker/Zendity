import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCronSecret } from '@/lib/cron-auth';
import { notifyUser } from '@/lib/notifications';
import { recomendarCurso } from '@/lib/recomendador-cursos';
import { formacionDe } from '@/lib/formacion';

/**
 * Recordatorio MENSUAL de formación, con la recomendación de Zendi dentro.
 *
 * Uno al mes por persona — unas once notificaciones mensuales en Cupey, contra
 * las 191 diarias que ya circulan. Semanal se volvería ruido, y hoy sabemos a
 * dónde lleva eso: STAFF_MESSAGE, que lo escribe una persona a otra, se ignora
 * 3 de cada 4 veces por quedar sepultado entre alertas automáticas.
 *
 * NO se le manda a quien ya aprobó un curso en los últimos 30 días. La meta es
 * uno al mes: quien ya lo hizo no necesita que se lo recuerden, y recordárselo
 * igual es la forma más rápida de que deje de leer estos avisos.
 *
 * El aviso lleva el curso concreto, su duración y su motivo. "Tienes cursos
 * pendientes" no mueve a nadie; "registraste 5 situaciones con medicación,
 * este curso dura 35 minutos" sí.
 *
 * Auth: Bearer CRON_SECRET.
 */
export const dynamic = 'force-dynamic';

const ROLES_CON_FORMACION = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'SOCIAL_WORKER'] as const;

export async function GET(req: Request) {
    const denied = requireCronSecret(req);
    if (denied) return denied;

    try {
        // El cron corre TODOS los lunes: la sintaxis "1-7 * * 1" se interpreta
        // como O en la mayoría de implementaciones (dias 1-7 O lunes), no como
        // "primer lunes". Se filtra aquí, que es explícito y no depende de cómo
        // lo lea el planificador.
        const hoyPR = new Date(Date.now() - 4 * 3600 * 1000);
        const diaDelMes = hoyPR.getUTCDate();
        if (diaDelMes > 7) {
            return NextResponse.json({ success: true, omitido: 'no es el primer lunes del mes' });
        }

        const sedes = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        });

        const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const resumen: any[] = [];

        for (const sede of sedes) {
            const staff = await prisma.user.findMany({
                where: {
                    headquartersId: sede.id,
                    isActive: true,
                    isDeleted: false,
                    role: { in: [...ROLES_CON_FORMACION] as any },
                },
                select: { id: true, name: true },
            });

            let enviados = 0;
            let alDia = 0;

            for (const s of staff) {
                const recienteAprobado = await prisma.userCourse.count({
                    where: { employeeId: s.id, status: 'COMPLETED', completedAt: { gte: hace30 } },
                });
                if (recienteAprobado > 0) { alDia++; continue; }

                const [reco, formacion] = await Promise.all([
                    recomendarCurso(s.id),
                    formacionDe(s.id),
                ]);
                // Sin cursos pendientes no hay nada que recomendar.
                if (!reco) continue;

                const progreso = formacion && formacion.meta > 0
                    ? ` Vas ${formacion.aprobados} de ${formacion.meta} este año.`
                    : '';

                await notifyUser(s.id, {
                    type: 'COURSE_COMPLETED',
                    title: `Zendi te recomienda: ${reco.titulo}`,
                    message: `${reco.motivo} Son ${reco.minutos} minutos.${progreso}`,
                    link: '/academy',
                });
                enviados++;
            }

            resumen.push({ sede: sede.name, staff: staff.length, enviados, alDia });
        }

        return NextResponse.json({ success: true, resumen });
    } catch (e: any) {
        console.error('[cron/recordatorio-formacion] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
