import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCronSecret } from '@/lib/cron-auth';
import { notifyUser } from '@/lib/notifications';
import { CADENCIA_IDEAL_DIAS, CADENCIA_MINIMA_DIAS } from '@/lib/nursing-update';

/**
 * Resumen SEMANAL de la cadencia de comunicación con las familias.
 *
 * Corre los lunes. Un aviso por semana y no uno por residente: en esta misma
 * app ya vimos a dónde lleva notificar por evento — 286 alertas clínicas que
 * nadie resolvió nunca y una bandeja de la que las cosas salían por vejez.
 * Una lista semanal se lee; catorce avisos sueltos se ignoran.
 *
 * Umbrales pedidos por Celia: ideal cada 15 días, mínimo uno al mes.
 *
 * Los residentes SIN familiares en el sistema quedan fuera del conteo. En
 * Cupey son 19 de 33: reclamar una actualización que no se le puede mandar a
 * nadie convierte el aviso en ruido permanente, que es justo el patrón que
 * hemos estado retirando.
 *
 * No penaliza a nadie. Informa.
 *
 * Auth: Bearer CRON_SECRET.
 */
export const dynamic = 'force-dynamic';

const ROLES_QUE_RECIBEN = ['NURSE', 'DIRECTOR', 'ADMIN'] as const;

export async function GET(req: Request) {
    const denied = requireCronSecret(req);
    if (denied) return denied;

    try {
        const sedes = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        });

        const resumen: any[] = [];

        for (const sede of sedes) {
            const residentes = await prisma.patient.findMany({
                where: {
                    headquartersId: sede.id,
                    status: 'ACTIVE',
                    // Solo los que tienen a quien escribirle.
                    familyMembers: { some: {} },
                },
                select: {
                    id: true,
                    name: true,
                    zendiNursingUpdates: {
                        where: { status: 'SENT' },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { createdAt: true },
                    },
                },
            });

            const ahora = Date.now();
            const conDias = residentes.map(r => {
                const ultima = r.zendiNursingUpdates[0]?.createdAt ?? null;
                return {
                    nombre: r.name,
                    dias: ultima ? Math.floor((ahora - ultima.getTime()) / 86400000) : null,
                };
            });

            const nunca = conDias.filter(r => r.dias === null);
            const vencidos = conDias.filter(r => r.dias !== null && r.dias > CADENCIA_MINIMA_DIAS);
            const porVencer = conDias.filter(r => r.dias !== null && r.dias > CADENCIA_IDEAL_DIAS && r.dias <= CADENCIA_MINIMA_DIAS);

            const pendientes = nunca.length + vencidos.length;

            resumen.push({
                sede: sede.name,
                conFamilia: residentes.length,
                nunca: nunca.length,
                vencidos: vencidos.length,
                porVencer: porVencer.length,
            });

            // Nada que reclamar: no se manda un aviso para decir que todo va
            // bien. Un aviso semanal que casi siempre dice "sin novedad" deja
            // de leerse justo la semana que trae algo.
            if (pendientes === 0) continue;

            const destinatarios = await prisma.user.findMany({
                where: {
                    headquartersId: sede.id,
                    isActive: true,
                    isDeleted: false,
                    OR: [
                        { role: { in: ROLES_QUE_RECIBEN as any } },
                        { secondaryRoles: { hasSome: [...ROLES_QUE_RECIBEN] as any } },
                    ],
                },
                select: { id: true },
            });

            const nombres = [...nunca, ...vencidos]
                .map(r => r.nombre)
                .slice(0, 6)
                .join(', ');
            const resto = pendientes > 6 ? ` y ${pendientes - 6} más` : '';

            for (const d of destinatarios) {
                await notifyUser(d.id, {
                    type: 'FAMILY_VISIT',
                    title: `${pendientes} familias sin noticias`,
                    // Sin PHI: nombres de residentes y nada clinico. Quien
                    // recibe esto ya tiene acceso al expediente.
                    message: `Llevan más de ${CADENCIA_MINIMA_DIAS} días sin una actualización: ${nombres}${resto}.`,
                    link: '/corporate/medical/patients',
                });
            }
        }

        return NextResponse.json({ success: true, resumen });
    } catch (e: any) {
        console.error('[cron/family-update-cadence] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
