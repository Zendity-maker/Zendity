/**
 * PLANES DE CUIDO QUE NECESITAN ACCIÓN
 * ────────────────────────────────────
 * El número que va junto a "Life Plan (PAI)" en el menú.
 *
 * POR QUÉ HACÍA FALTA. Medido en producción el 05-sep-2026: 16 de los 32
 * residentes activos de Cupey tenían su PAI COMPLETO —versión familiar,
 * resumen interdisciplinario, riesgos, objetivos, movilidad correcta, todos
 * editados a mano— y sin firmar. Doce de ellos llevaban 106 días así.
 *
 * No faltaba trabajo clínico ni había nada roto: faltaba una firma, y nada se
 * lo decía a nadie. El resumen ya se calculaba en /api/cuidadores/lifeplans,
 * pero había que ABRIR la pantalla para verlo — y quien no sabe que hay algo
 * pendiente no abre la pantalla a comprobarlo.
 *
 * Mismo patrón que las observaciones de personal, medido el mismo fin de
 * semana: dos llevaban 56 y 45 días esperando una decisión que sí había
 * disparado su notificación. Una notificación se lee una vez y se va; un
 * contador insiste hasta que alguien resuelve.
 *
 * Se cuenta lo ACCIONABLE, no lo pendiente en abstracto: un borrador (falta
 * firmar), un residente sin ningún plan (falta hacerlo), un aprobado que nunca
 * salió a la familia, y uno con la revisión vencida. Los cuatro se arreglan
 * haciendo algo; ninguno se arregla esperando.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const VEN_PAI = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET() {
    const auth = await requireRole(VEN_PAI);
    if (auth instanceof NextResponse) return auth;

    try {
        const activos = await prisma.patient.findMany({
            where: { headquartersId: auth.headquartersId, status: 'ACTIVE' },
            select: {
                lifePlans: {
                    select: { status: true, emailSentAt: true, nextReview: true },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        const ahora = new Date();
        const r = { total: activos.length, alDia: 0, borrador: 0, sinPlan: 0, sinEnviar: 0, vencidos: 0 };

        for (const p of activos) {
            const aprobado = p.lifePlans.find(l => l.status === 'APPROVED');
            if (p.lifePlans.length === 0) { r.sinPlan++; continue; }
            if (!aprobado) { r.borrador++; continue; }
            if (!aprobado.emailSentAt) { r.sinEnviar++; continue; }
            if (aprobado.nextReview && aprobado.nextReview < ahora) { r.vencidos++; continue; }
            r.alDia++;
        }

        return NextResponse.json({
            success: true,
            pendientes: r.borrador + r.sinPlan + r.sinEnviar + r.vencidos,
            ...r,
        });
    } catch (error) {
        console.error('Life plans pending-count error:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
