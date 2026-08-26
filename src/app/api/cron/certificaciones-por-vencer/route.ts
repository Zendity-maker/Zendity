import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCronSecret } from '@/lib/cron-auth';
import { notifyUser } from '@/lib/notifications';
import { calcularVencimiento, diasParaVencer } from '@/lib/certificado';

/**
 * Aviso SEMANAL de certificaciones por vencer.
 *
 * Corre los lunes. Un aviso por semana a direccion, no uno por persona: hoy
 * medimos 191 notificaciones diarias en esta app, y a ese volumen lo que
 * importa se entierra. Una lista semanal se lee.
 *
 * Vencer es informativo — decidido con Andres el 26-ago-2026. Nadie deja de
 * trabajar por tener la certificacion caducada; se marca, se avisa, y el curso
 * vuelve a estar disponible para retomarlo.
 *
 * Ventana: 60 dias. Para un curso de 40 minutos sobra, y da margen a dos
 * recordatorios antes de que caduque de verdad.
 *
 * Auth: Bearer CRON_SECRET.
 */
export const dynamic = 'force-dynamic';

const VENTANA_AVISO_DIAS = 60;
const ROLES_QUE_RECIBEN = ['DIRECTOR', 'ADMIN', 'HR_MANAGER'] as const;

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
            const aprobados = await prisma.userCourse.findMany({
                where: {
                    headquartersId: sede.id,
                    status: 'COMPLETED',
                    certificateRevokedAt: null,
                    employee: { isActive: true, isDeleted: false },
                },
                select: {
                    completedAt: true,
                    certificateExpiresAt: true,
                    employee: { select: { name: true } },
                    course: { select: { title: true } },
                },
            });

            const conVencimiento = aprobados
                .map(a => {
                    const vence = a.certificateExpiresAt
                        ?? (a.completedAt ? calcularVencimiento(a.completedAt) : null);
                    return vence ? { nombre: a.employee.name.trim(), curso: a.course.title, dias: diasParaVencer(vence) } : null;
                })
                .filter(Boolean) as { nombre: string; curso: string; dias: number }[];

            const vencidos = conVencimiento.filter(x => x.dias < 0);
            const porVencer = conVencimiento.filter(x => x.dias >= 0 && x.dias <= VENTANA_AVISO_DIAS);

            resumen.push({
                sede: sede.name,
                total: conVencimiento.length,
                vencidos: vencidos.length,
                porVencer: porVencer.length,
            });

            // Nada que reclamar, nada que mandar. Un aviso semanal que casi
            // siempre dice "sin novedad" deja de leerse justo la semana que
            // trae algo.
            if (vencidos.length === 0 && porVencer.length === 0) continue;

            const destinatarios = await prisma.user.findMany({
                where: {
                    headquartersId: sede.id,
                    isActive: true,
                    isDeleted: false,
                    OR: [
                        { role: { in: [...ROLES_QUE_RECIBEN] as any } },
                        { secondaryRoles: { hasSome: [...ROLES_QUE_RECIBEN] as any } },
                    ],
                },
                select: { id: true },
            });

            const partes: string[] = [];
            if (vencidos.length) partes.push(`${vencidos.length} ya vencida${vencidos.length === 1 ? '' : 's'}`);
            if (porVencer.length) partes.push(`${porVencer.length} vence${porVencer.length === 1 ? '' : 'n'} en menos de ${VENTANA_AVISO_DIAS} días`);

            for (const d of destinatarios) {
                await notifyUser(d.id, {
                    type: 'COURSE_COMPLETED',
                    title: 'Certificaciones por renovar',
                    message: partes.join(' · ') + '.',
                    link: '/academy',
                });
            }
        }

        return NextResponse.json({ success: true, resumen });
    } catch (e: any) {
        console.error('[cron/certificaciones-por-vencer] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
